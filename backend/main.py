import asyncio
import json
from datetime import datetime
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import borsapy as bp

# Load all BIST symbols from JSON file
_symbols_file = Path(__file__).parent / "bist_symbols.json"
with open(_symbols_file, "r", encoding="utf-8") as _f:
    _symbols_data = json.load(_f)

BIST_SYMBOLS = _symbols_data["stocks"]
BIST_INDICES = _symbols_data["indices"]

# Active WebSocket connections for streaming
active_connections: dict[str, set[WebSocket]] = {}
stream_tasks: dict[str, asyncio.Task] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Cleanup stream tasks on shutdown
    for task in stream_tasks.values():
        task.cancel()


app = FastAPI(title="Borsa API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/symbols")
def get_symbols():
    return {"stocks": BIST_SYMBOLS, "indices": BIST_INDICES}


@app.get("/api/history/{symbol}")
def get_history(
    symbol: str,
    period: str = Query(default="1y", description="1d,5d,1mo,3mo,6mo,1y,2y,5y,max"),
    interval: str = Query(default="1d", description="1m,5m,15m,30m,1h,1d,1wk,1mo"),
):
    try:
        t = bp.Ticker(symbol)
        df = t.history(period=period, interval=interval)

        if df is None or df.empty:
            return {"error": f"No data for {symbol}", "data": []}

        records = []
        for idx, row in df.iterrows():
            ts = idx
            if hasattr(ts, 'isoformat'):
                date_str = ts.strftime('%Y-%m-%d')
            else:
                date_str = str(ts)

            records.append({
                "date": date_str,
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
            })

        return {"symbol": symbol, "data": records}

    except Exception as e:
        return {"error": str(e), "data": []}


@app.get("/api/search")
def search_symbol(q: str = Query(..., min_length=1)):
    try:
        results = bp.search_bist(q)
        if results is None:
            return {"results": []}
        if hasattr(results, 'to_dict'):
            return {"results": results.to_dict('records')}
        return {"results": list(results) if results else []}
    except Exception:
        return {"results": []}


_tv_stream = None
_tv_stream_lock = asyncio.Lock()


async def _get_shared_stream():
    """Get or create a shared TradingViewStream instance."""
    global _tv_stream
    async with _tv_stream_lock:
        if _tv_stream is None or not _tv_stream.is_connected:
            _tv_stream = bp.create_stream()
            _tv_stream.connect(timeout=10)
            print("TradingView stream connected")
        return _tv_stream


async def stream_symbol_data(symbol: str):
    """Background task that streams realtime data for a symbol via borsapy."""
    try:
        loop = asyncio.get_event_loop()
        stream = await _get_shared_stream()

        def on_quote_cb(sym, quote):
            """Callback when new quote arrives from TradingView stream."""
            if symbol not in active_connections or not active_connections[symbol]:
                return

            price = quote.get("last") or 0
            msg = json.dumps({
                "type": "quote",
                "symbol": symbol,
                "data": {
                    "price": price,
                    "change": quote.get("change") or 0,
                    "changePercent": quote.get("change_percent") or 0,
                    "volume": quote.get("volume") or 0,
                    "high": quote.get("high") or 0,
                    "low": quote.get("low") or 0,
                    "open": quote.get("open") or 0,
                    "time": datetime.now().isoformat(),
                },
            })

            # Schedule sending from the callback thread into the asyncio loop
            for ws in list(active_connections.get(symbol, set())):
                loop.call_soon_threadsafe(asyncio.ensure_future, safe_send(ws, msg, symbol))

        stream.on_quote(symbol, on_quote_cb)
        stream.subscribe(symbol)
        print(f"Subscribed to realtime quotes for {symbol}")

        # Keep the task running
        while True:
            await asyncio.sleep(1)

    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"Stream error for {symbol}: {e}")
        import traceback
        traceback.print_exc()


async def safe_send(ws: WebSocket, msg: str, symbol: str):
    try:
        await ws.send_text(msg)
    except Exception:
        active_connections.get(symbol, set()).discard(ws)


@app.websocket("/ws/stream/{symbol}")
async def websocket_stream(websocket: WebSocket, symbol: str):
    await websocket.accept()

    if symbol not in active_connections:
        active_connections[symbol] = set()
    active_connections[symbol].add(websocket)

    # Start stream task if not already running
    if symbol not in stream_tasks or stream_tasks[symbol].done():
        stream_tasks[symbol] = asyncio.create_task(stream_symbol_data(symbol))

    try:
        # Send initial quote data
        try:
            t = bp.Ticker(symbol)
            h = t.history(period="1d", interval="1m")
            if h is not None and not h.empty:
                last = h.iloc[-1]
                first = h.iloc[0]
                await websocket.send_text(json.dumps({
                    "type": "snapshot",
                    "symbol": symbol,
                    "data": {
                        "price": round(float(last["Close"]), 2),
                        "open": round(float(first["Open"]), 2),
                        "high": round(float(h["High"].max()), 2),
                        "low": round(float(h["Low"].min()), 2),
                        "volume": int(h["Volume"].sum()) if h["Volume"].sum() == h["Volume"].sum() else 0,
                        "time": datetime.now().isoformat(),
                    },
                }))
        except Exception:
            pass

        # Keep connection alive
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if msg == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "heartbeat"}))

    except WebSocketDisconnect:
        pass
    finally:
        active_connections.get(symbol, set()).discard(websocket)
        # If no more connections for this symbol, cancel the stream
        if not active_connections.get(symbol):
            task = stream_tasks.pop(symbol, None)
            if task:
                task.cancel()
            active_connections.pop(symbol, None)


# Symbols that use UFRS/IFRS financial group (banks, insurance, leasing etc.)
BANK_SYMBOLS = {
    "GARAN", "AKBNK", "YKBNK", "HALKB", "VAKBN", "ISCTR", "TSKB", "ALBRK",
    "SKBNK", "ICBCT", "QNBFK", "QNBTR", "KLNMA", "ISATR", "ISBTR", "ISKUR",
    "ISFIN", "SEKFK", "VAKFN",
}

import pickle
from isyatirimhisse import fetch_financials as isy_fetch_financials

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
# Cache validity: 1 day (86400 seconds)
CACHE_TTL = 86400


def _get_cached_financials(symbol: str, fg: str):
    """Return cached DataFrame if fresh, else fetch from API and cache."""
    cache_file = CACHE_DIR / f"{symbol}_{fg}.pkl"

    # Check if cache exists and is fresh
    if cache_file.exists():
        age = datetime.now().timestamp() - cache_file.stat().st_mtime
        if age < CACHE_TTL:
            try:
                with open(cache_file, "rb") as f:
                    df = pickle.load(f)
                print(f"Cache hit: {symbol} (age {int(age)}s)")
                return df
            except Exception:
                pass  # corrupted cache, re-fetch

    # Fetch from API
    print(f"Fetching financials for {symbol} from API...")
    df = isy_fetch_financials(
        symbols=symbol,
        start_year=2005,
        end_year=2025,
        exchange="TRY",
        financial_group=fg,
    )

    # Save to cache
    if df is not None and not df.empty:
        try:
            with open(cache_file, "wb") as f:
                pickle.dump(df, f)
            print(f"Cached: {symbol} ({len(df)} rows)")
        except Exception as e:
            print(f"Cache write error: {e}")

    return df


@app.get("/api/financials/{symbol}")
def get_financials(
    symbol: str,
    report: str = Query(default="income_stmt", description="income_stmt, balance_sheet, cashflow"),
    quarterly: bool = Query(default=False),
):
    """Fetch financial statements with local file cache."""
    try:
        is_bank = symbol.upper() in BANK_SYMBOLS
        fg = "2" if is_bank else "1"

        df = _get_cached_financials(symbol, fg)

        if df is None or df.empty:
            return {"symbol": symbol, "report": report, "quarterly": quarterly, "periods": [], "data": []}

        # Period columns are like '2010/3', '2010/6', '2010/9', '2010/12'
        period_cols = [c for c in df.columns if "/" in str(c)]

        if not quarterly:
            period_cols = [c for c in period_cols if str(c).endswith("/12")]

        def sort_key(col):
            parts = str(col).split("/")
            return (int(parts[0]), int(parts[1]))
        period_cols.sort(key=sort_key)

        records = []
        for _, row in df.iterrows():
            item_name = str(row.get("FINANCIAL_ITEM_NAME_TR", ""))
            if not item_name:
                continue
            rec = {"item": item_name}
            for col in period_cols:
                val = row.get(col)
                if val is None or (isinstance(val, float) and val != val):
                    rec[str(col)] = None
                else:
                    try:
                        rec[str(col)] = float(val)
                    except (ValueError, TypeError):
                        rec[str(col)] = None
            records.append(rec)

        periods = [str(c) for c in period_cols]

        return {
            "symbol": symbol,
            "report": report,
            "quarterly": quarterly,
            "periods": periods,
            "data": records,
        }

    except Exception as e:
        print(f"Financials error: {e}")
        return {"error": str(e), "symbol": symbol, "report": report, "data": [], "periods": []}


@app.delete("/api/financials/cache")
def clear_cache():
    """Clear all cached financial data."""
    count = 0
    for f in CACHE_DIR.glob("*.pkl"):
        f.unlink()
        count += 1
    return {"cleared": count}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
