"""yfinance ile piyasa verisi servisi"""

import yfinance as yf
import pandas as pd
from datetime import datetime
from typing import Optional, Dict, Any
import streamlit as st

# BIST 6 sıfır atılma tarihi (1 Ocak 2005 - yeni TL'ye geçiş)
BIST_REDENOMINATION_DATE = datetime(2005, 1, 1)


def adjust_bist_data(df: pd.DataFrame, symbol: str) -> pd.DataFrame:
    """BIST hisselerinde 6 sıfır atılması öncesi verileri düzeltir"""
    if not symbol.upper().endswith('.IS'):
        return df

    if df.empty:
        return df

    # Timezone-aware index'i naive'e çevir karşılaştırma için
    df = df.copy()

    # 12 Haziran 2024 öncesi verileri 1.000.000'a böl
    price_columns = ['Open', 'High', 'Low', 'Close']

    for col in price_columns:
        if col in df.columns:
            # Her satır için tarih kontrolü yap
            mask = df.index.tz_localize(None) < BIST_REDENOMINATION_DATE if df.index.tz is not None else df.index < BIST_REDENOMINATION_DATE
            df.loc[mask, col] = df.loc[mask, col] / 1_000_000

    return df


@st.cache_data(ttl=60)
def get_stock_data(symbol: str, period: str = "1y", interval: str = "1d") -> Optional[pd.DataFrame]:
    """Hisse senedi geçmiş verilerini çeker"""
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty:
            return None

        # BIST hisseleri için 6 sıfır düzeltmesi
        df = adjust_bist_data(df, symbol)

        return df
    except Exception as e:
        st.error(f"Veri çekilemedi: {e}")
        return None


@st.cache_data(ttl=30)
def get_stock_info(symbol: str) -> Optional[Dict[str, Any]]:
    """Hisse senedi bilgilerini çeker"""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return info
    except Exception:
        return None


@st.cache_data(ttl=30)
def get_current_price(symbol: str) -> Optional[Dict[str, Any]]:
    """Anlık fiyat bilgisi (Robust)"""
    try:
        ticker = yf.Ticker(symbol)

        # 1. Yöntem: fast_info (Daha hızlı ve güvenilir)
        try:
            fast_info = ticker.fast_info
            price = fast_info.last_price
            prev_close = fast_info.previous_close

            if price and prev_close:
                change = price - prev_close
                change_percent = (change / prev_close) * 100
            else:
                change = 0
                change_percent = 0

            return {
                'price': price,
                'previous_close': prev_close,
                'change': change,
                'change_percent': change_percent,
                'volume': getattr(fast_info, 'last_volume', 0),
                'market_cap': getattr(fast_info, 'market_cap', 0),
                'day_high': getattr(fast_info, 'day_high', price),
                'day_low': getattr(fast_info, 'day_low', price),
                'fifty_two_week_high': getattr(fast_info, 'year_high', price),
                'fifty_two_week_low': getattr(fast_info, 'year_low', price),
                'name': symbol, # fast_info'da isim olmayabilir
                'currency': getattr(fast_info, 'currency', 'USD')
            }
        except Exception:
            pass

        # 2. Yöntem: info (Klasik, detaylı ama yavaş/flaky)
        info = ticker.info
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        previous_close = info.get('previousClose') or info.get('regularMarketPreviousClose')

        if current_price:
            if previous_close:
                change = current_price - previous_close
                change_percent = (change / previous_close) * 100
            else:
                change = 0
                change_percent = 0

            return {
                'price': current_price,
                'previous_close': previous_close,
                'change': change,
                'change_percent': change_percent,
                'volume': info.get('volume') or info.get('regularMarketVolume'),
                'market_cap': info.get('marketCap'),
                'day_high': info.get('dayHigh') or info.get('regularMarketDayHigh'),
                'day_low': info.get('dayLow') or info.get('regularMarketDayLow'),
                'fifty_two_week_high': info.get('fiftyTwoWeekHigh'),
                'fifty_two_week_low': info.get('fiftyTwoWeekLow'),
                'name': info.get('shortName') or info.get('longName') or symbol,
                'currency': info.get('currency', 'USD')
            }

        # 3. Yöntem: History (Son çare)
        hist = ticker.history(period="1d")
        if not hist.empty:
            row = hist.iloc[-1]
            price = float(row['Close'])
            # Previous close için 2 günlük almamız lazımdı ama 1d en azından fiyatı kurtarır
            # 2 günlük deneyelim
            hist2 = ticker.history(period="5d")
            if len(hist2) > 1:
                prev_close = float(hist2.iloc[-2]['Close'])
                change = price - prev_close
                change_percent = (change / prev_close) * 100
            else:
                prev_close = price
                change = 0
                change_percent = 0

            return {
                'price': price,
                'previous_close': prev_close,
                'change': change,
                'change_percent': change_percent,
                'volume': int(row['Volume']),
                'market_cap': 0,
                'day_high': float(row['High']),
                'day_low': float(row['Low']),
                'fifty_two_week_high': 0,
                'fifty_two_week_low': 0,
                'name': symbol,
                'currency': 'USD'
            }

        return None
    except Exception:
        return None


@st.cache_data(ttl=300)
def get_financials(symbol: str) -> Optional[Dict[str, pd.DataFrame]]:
    """Finansal tabloları çeker"""
    try:
        ticker = yf.Ticker(symbol)
        return {
            'income_statement': ticker.financials,
            'balance_sheet': ticker.balance_sheet,
            'cash_flow': ticker.cashflow
        }
    except Exception:
        return None


@st.cache_data(ttl=60)
def get_batch_stock_data(symbols: list, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """Birden fazla hisse için geçmiş verileri çeker"""
    try:
        if not symbols:
            return pd.DataFrame()
        # Tickers string'e çevir
        # yf.download list kabul eder ama string daha güvenli olabilir bazı versiyonlarda
        # threads=True varsayılandır ama explicit olalım
        df = yf.download(symbols, period=period, interval=interval, group_by='ticker', progress=False, threads=True)
        return df
    except Exception as e:
        st.error(f"Toplu veri çekilemedi: {e}")
        return pd.DataFrame()


@st.cache_data(ttl=60)
def get_multiple_prices(symbols: list) -> pd.DataFrame:
    """Birden fazla sembol için fiyat bilgisi (Optimize edilmiş)"""
    if not symbols:
        return pd.DataFrame()

    try:
        # Son 5 günlük veriyi çek (garanti olsun diye haftasonları vs)
        df = yf.download(symbols, period="5d", interval="1d", group_by='ticker', progress=False, threads=True)

        data = []
        is_multi = len(symbols) > 1 and isinstance(df.columns, pd.MultiIndex)

        for symbol in symbols:
            try:
                stock_df = None
                if is_multi:
                    if symbol in df.columns.levels[0]:
                        stock_df = df[symbol]
                elif len(symbols) == 1:
                     stock_df = df
                # Tek sembol girilip multiindex dönmediği durum (ama liste verdiysek ve 1 tane ise genelde düz döner)
                # Eğer birden fazla sembol varsa ama sadece 1 tanesi başarılı olduysa yfinance bazen düz dönebilir.
                # Bunu handle etmek karmaşık olabilir, şimdilik basit tutuyoruz.

                if stock_df is None or stock_df.empty:
                    continue

                # Drop NA (son günler boş gelebilir bazen)
                stock_df = stock_df.dropna(how='all')

                if stock_df.empty:
                    continue

                # Son veriyi al
                latest = stock_df.iloc[-1]

                if len(stock_df) > 1:
                    prev = stock_df.iloc[-2]
                    price = float(latest['Close'])
                    prev_close = float(prev['Close'])
                    change = price - prev_close
                    change_percent = (change / prev_close) * 100 if prev_close != 0 else 0
                else:
                    price = float(latest['Close'])
                    change = 0.0
                    change_percent = 0.0

                volume = int(latest['Volume']) if 'Volume' in latest else 0

                data.append({
                    'Sembol': symbol,
                    'İsim': symbol,  # İsim bilgisi için ekstra API çağrısı yapmıyoruz
                    'Fiyat': price,
                    'Değişim': change,
                    'Değişim %': change_percent,
                    'Hacim': volume
                })
            except Exception:
                continue

        return pd.DataFrame(data)
    except Exception as e:
        print(f"Hata: {e}")
        return pd.DataFrame()


def search_symbol(query: str) -> list:
    """Sembol arama"""
    try:
        ticker = yf.Ticker(query)
        info = ticker.info
        if info and info.get('symbol'):
            return [{
                'symbol': info.get('symbol'),
                'name': info.get('shortName') or info.get('longName'),
                'type': info.get('quoteType')
            }]
    except Exception:
        pass
    return []


def validate_symbol(symbol: str) -> bool:
    """Sembolün geçerli olup olmadığını kontrol eder"""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return info is not None and info.get('symbol') is not None
    except Exception:
        return False
