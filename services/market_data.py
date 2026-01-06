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
    """Anlık fiyat bilgisi"""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        previous_close = info.get('previousClose') or info.get('regularMarketPreviousClose')

        if current_price and previous_close:
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
def get_multiple_prices(symbols: list) -> pd.DataFrame:
    """Birden fazla sembol için fiyat bilgisi"""
    data = []
    for symbol in symbols:
        price_info = get_current_price(symbol)
        if price_info:
            data.append({
                'Sembol': symbol,
                'İsim': price_info['name'],
                'Fiyat': price_info['price'],
                'Değişim': price_info['change'],
                'Değişim %': price_info['change_percent'],
                'Hacim': price_info['volume']
            })
    return pd.DataFrame(data)


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
