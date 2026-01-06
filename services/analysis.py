"""Teknik analiz hesaplamaları"""

import pandas as pd
import numpy as np
from typing import Dict, Any


def calculate_sma(df: pd.DataFrame, period: int = 20, column: str = 'Close') -> pd.Series:
    """Basit Hareketli Ortalama (SMA)"""
    return df[column].rolling(window=period).mean()


def calculate_ema(df: pd.DataFrame, period: int = 20, column: str = 'Close') -> pd.Series:
    """Üstel Hareketli Ortalama (EMA)"""
    return df[column].ewm(span=period, adjust=False).mean()


def calculate_rsi(df: pd.DataFrame, period: int = 14, column: str = 'Close') -> pd.Series:
    """Relative Strength Index (RSI)"""
    delta = df[column].diff()

    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()

    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))

    return rsi


def calculate_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9,
                   column: str = 'Close') -> Dict[str, pd.Series]:
    """MACD Göstergesi"""
    ema_fast = df[column].ewm(span=fast, adjust=False).mean()
    ema_slow = df[column].ewm(span=slow, adjust=False).mean()

    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line

    return {
        'macd': macd_line,
        'signal': signal_line,
        'histogram': histogram
    }


def calculate_bollinger_bands(df: pd.DataFrame, period: int = 20, std_dev: int = 2,
                              column: str = 'Close') -> Dict[str, pd.Series]:
    """Bollinger Bantları"""
    sma = df[column].rolling(window=period).mean()
    std = df[column].rolling(window=period).std()

    upper_band = sma + (std * std_dev)
    lower_band = sma - (std * std_dev)

    return {
        'middle': sma,
        'upper': upper_band,
        'lower': lower_band
    }


def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range (ATR)"""
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())

    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    atr = true_range.rolling(window=period).mean()

    return atr


def calculate_stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3) -> Dict[str, pd.Series]:
    """Stochastic Oscillator"""
    low_min = df['Low'].rolling(window=k_period).min()
    high_max = df['High'].rolling(window=k_period).max()

    k = 100 * ((df['Close'] - low_min) / (high_max - low_min))
    d = k.rolling(window=d_period).mean()

    return {'k': k, 'd': d}


def calculate_obv(df: pd.DataFrame) -> pd.Series:
    """On-Balance Volume (OBV)"""
    obv = (np.sign(df['Close'].diff()) * df['Volume']).fillna(0).cumsum()
    return obv


def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Tüm göstergeleri DataFrame'e ekler"""
    df = df.copy()

    # Hareketli ortalamalar
    df['SMA_20'] = calculate_sma(df, 20)
    df['SMA_50'] = calculate_sma(df, 50)
    df['SMA_200'] = calculate_sma(df, 200)
    df['EMA_12'] = calculate_ema(df, 12)
    df['EMA_26'] = calculate_ema(df, 26)

    # RSI
    df['RSI'] = calculate_rsi(df)

    # MACD
    macd = calculate_macd(df)
    df['MACD'] = macd['macd']
    df['MACD_Signal'] = macd['signal']
    df['MACD_Histogram'] = macd['histogram']

    # Bollinger Bands
    bb = calculate_bollinger_bands(df)
    df['BB_Upper'] = bb['upper']
    df['BB_Middle'] = bb['middle']
    df['BB_Lower'] = bb['lower']

    # ATR
    df['ATR'] = calculate_atr(df)

    # Stochastic
    stoch = calculate_stochastic(df)
    df['Stoch_K'] = stoch['k']
    df['Stoch_D'] = stoch['d']

    # OBV
    df['OBV'] = calculate_obv(df)

    return df


def get_signal_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """Teknik analiz sinyallerinin özeti"""
    if df.empty:
        return {}

    latest = df.iloc[-1]
    signals = {
        'bullish': [],
        'bearish': [],
        'neutral': []
    }

    # RSI sinyalleri
    rsi = latest.get('RSI')
    if rsi:
        if rsi < 30:
            signals['bullish'].append('RSI aşırı satım bölgesinde')
        elif rsi > 70:
            signals['bearish'].append('RSI aşırı alım bölgesinde')
        else:
            signals['neutral'].append(f'RSI: {rsi:.1f}')

    # MACD sinyalleri
    macd = latest.get('MACD')
    macd_signal = latest.get('MACD_Signal')
    if macd and macd_signal:
        if macd > macd_signal:
            signals['bullish'].append('MACD sinyal çizgisinin üstünde')
        else:
            signals['bearish'].append('MACD sinyal çizgisinin altında')

    # SMA sinyalleri
    close = latest.get('Close')
    sma_50 = latest.get('SMA_50')
    sma_200 = latest.get('SMA_200')

    if close and sma_50:
        if close > sma_50:
            signals['bullish'].append('Fiyat 50 günlük SMA üstünde')
        else:
            signals['bearish'].append('Fiyat 50 günlük SMA altında')

    if sma_50 and sma_200:
        if sma_50 > sma_200:
            signals['bullish'].append('Golden Cross (SMA50 > SMA200)')
        else:
            signals['bearish'].append('Death Cross (SMA50 < SMA200)')

    # Bollinger sinyalleri
    bb_upper = latest.get('BB_Upper')
    bb_lower = latest.get('BB_Lower')

    if close and bb_upper and bb_lower:
        if close >= bb_upper:
            signals['bearish'].append('Fiyat üst Bollinger bandında')
        elif close <= bb_lower:
            signals['bullish'].append('Fiyat alt Bollinger bandında')

    return signals
