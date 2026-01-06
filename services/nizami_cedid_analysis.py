"""NizamiCedid (MACD Paşa) İndikatör Analizi"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class Signal(Enum):
    STRONG_BUY = "Güçlü Al"
    BUY = "Al"
    WEAK_BUY = "Zayıf Al"
    NEUTRAL = "Nötr"
    WEAK_SELL = "Zayıf Sat"
    SELL = "Sat"
    STRONG_SELL = "Güçlü Sat"


@dataclass
class NizamiCedidResult:
    """İndikatör analiz sonucu"""
    symbol: str
    signal: Signal
    strength: float  # -100 ile +100 arası
    macd_position: str  # "Sıfır üstü" / "Sıfır altı"
    macd_trend: str  # "Yükseliyor" / "Düşüyor" / "Yatay"
    emacd_cross: str  # "MACD > eMacD" / "MACD < eMacD"
    histogram_trend: str  # "Genişliyor" / "Daralıyor"
    long_term_trend: str  # "Boğa" / "Ayı" (EMA377 vs EMA610)
    description: str
    price: Optional[float] = None
    change_percent: Optional[float] = None


def calculate_nizami_cedid_indicators(df: pd.DataFrame) -> Dict[str, pd.Series]:
    """NizamiCedid indikatör değerlerini hesaplar"""
    if df is None or df.empty or len(df) < 610:
        return {}

    # Parametreler
    fast_length = 120
    slow_length = 260
    signal_length = 50
    vwma_length = 185
    ema377_length = 377
    ema610_length = 610

    close = df['Close']

    # EMA hesaplamaları
    fast_ma = close.ewm(span=fast_length, adjust=False).mean()
    slow_ma = close.ewm(span=slow_length, adjust=False).mean()
    macd = fast_ma - slow_ma
    signal = macd.ewm(span=signal_length, adjust=False).mean()
    hist = macd - signal

    # VWMA hesaplama
    if 'Volume' in df.columns and df['Volume'].sum() > 0:
        volume = df['Volume']
        eMacD = (macd * volume).rolling(window=vwma_length).sum() / volume.rolling(window=vwma_length).sum()
    else:
        eMacD = macd.rolling(window=vwma_length).mean()

    # Uzun vadeli EMA'lar
    ema377 = close.ewm(span=ema377_length, adjust=False).mean()
    ema610 = close.ewm(span=ema610_length, adjust=False).mean()

    # Normalize değerler
    hist_norm = hist / fast_ma
    macd_norm = macd / fast_ma
    signal_norm = signal / fast_ma
    eMacD_norm = eMacD / fast_ma

    return {
        'macd': macd,
        'signal': signal,
        'histogram': hist,
        'eMacD': eMacD,
        'macd_norm': macd_norm,
        'signal_norm': signal_norm,
        'hist_norm': hist_norm,
        'eMacD_norm': eMacD_norm,
        'ema377': ema377,
        'ema610': ema610,
        'fast_ma': fast_ma,
        'close': close
    }


def analyze_single_stock(df: pd.DataFrame, symbol: str,
                         price: Optional[float] = None,
                         change_percent: Optional[float] = None) -> Optional[NizamiCedidResult]:
    """Tek bir hisse için NizamiCedid analizi yapar"""
    indicators = calculate_nizami_cedid_indicators(df)

    if not indicators:
        return None

    # Son değerleri al
    macd_now = indicators['macd_norm'].iloc[-1]
    macd_prev = indicators['macd_norm'].iloc[-2]
    macd_prev5 = indicators['macd_norm'].iloc[-5] if len(indicators['macd_norm']) >= 5 else macd_prev

    signal_now = indicators['signal_norm'].iloc[-1]
    emacd_now = indicators['eMacD_norm'].iloc[-1]
    emacd_prev = indicators['eMacD_norm'].iloc[-2]

    hist_now = indicators['hist_norm'].iloc[-1]
    hist_prev = indicators['hist_norm'].iloc[-2]
    hist_prev5 = indicators['hist_norm'].iloc[-5] if len(indicators['hist_norm']) >= 5 else hist_prev

    ema377_now = indicators['ema377'].iloc[-1]
    ema610_now = indicators['ema610'].iloc[-1]

    close_now = indicators['close'].iloc[-1]

    # Analiz
    # 1. MACD pozisyonu
    macd_position = "Sıfır üstü" if macd_now > 0 else "Sıfır altı"

    # 2. MACD trendi (son 5 bar)
    macd_change = macd_now - macd_prev5
    if abs(macd_change) < 0.0001:
        macd_trend = "Yatay"
    elif macd_change > 0:
        macd_trend = "Yükseliyor"
    else:
        macd_trend = "Düşüyor"

    # 3. MACD vs eMacD kesişimi
    if macd_now > emacd_now:
        emacd_cross = "MACD > eMacD (Pozitif)"
    else:
        emacd_cross = "MACD < eMacD (Negatif)"

    # 4. Histogram trendi
    hist_change = abs(hist_now) - abs(hist_prev5)
    if hist_change > 0.0001:
        histogram_trend = "Genişliyor"
    elif hist_change < -0.0001:
        histogram_trend = "Daralıyor"
    else:
        histogram_trend = "Sabit"

    # 5. Uzun vadeli trend (EMA377 vs EMA610)
    long_term_trend = "Boğa" if ema377_now > ema610_now else "Ayı"

    # Sinyal gücü hesaplama (-100 ile +100 arası)
    strength = 0

    # MACD pozisyonu (+/- 20)
    strength += 20 if macd_now > 0 else -20

    # MACD trendi (+/- 20)
    if macd_trend == "Yükseliyor":
        strength += 20
    elif macd_trend == "Düşüyor":
        strength -= 20

    # MACD vs eMacD (+/- 25)
    if macd_now > emacd_now:
        strength += 25
    else:
        strength -= 25

    # MACD-eMacD yakınlaşma/uzaklaşma (+/- 15)
    delta_now = macd_now - emacd_now
    delta_prev = macd_prev - emacd_prev
    if delta_now > delta_prev:
        strength += 15
    else:
        strength -= 15

    # Uzun vadeli trend (+/- 20)
    if long_term_trend == "Boğa":
        strength += 20
    else:
        strength -= 20

    # Sinyali belirle
    if strength >= 70:
        signal = Signal.STRONG_BUY
    elif strength >= 40:
        signal = Signal.BUY
    elif strength >= 15:
        signal = Signal.WEAK_BUY
    elif strength >= -15:
        signal = Signal.NEUTRAL
    elif strength >= -40:
        signal = Signal.WEAK_SELL
    elif strength >= -70:
        signal = Signal.SELL
    else:
        signal = Signal.STRONG_SELL

    # Açıklama oluştur
    description = generate_description(
        signal, macd_position, macd_trend, emacd_cross,
        histogram_trend, long_term_trend, strength
    )

    return NizamiCedidResult(
        symbol=symbol,
        signal=signal,
        strength=strength,
        macd_position=macd_position,
        macd_trend=macd_trend,
        emacd_cross=emacd_cross,
        histogram_trend=histogram_trend,
        long_term_trend=long_term_trend,
        description=description,
        price=price,
        change_percent=change_percent
    )


def generate_description(signal: Signal, macd_position: str, macd_trend: str,
                        emacd_cross: str, histogram_trend: str,
                        long_term_trend: str, strength: float) -> str:
    """İndikatör durumuna göre açıklama oluşturur"""

    parts = []

    # Ana sinyal
    if signal in [Signal.STRONG_BUY, Signal.BUY]:
        parts.append("Alım sinyali aktif.")
    elif signal in [Signal.STRONG_SELL, Signal.SELL]:
        parts.append("Satım sinyali aktif.")
    else:
        parts.append("Bekleme pozisyonunda.")

    # MACD durumu
    if macd_position == "Sıfır üstü":
        if macd_trend == "Yükseliyor":
            parts.append("MACD sıfır üstünde ve yükseliyor - momentum güçlü.")
        elif macd_trend == "Düşüyor":
            parts.append("MACD sıfır üstünde ama düşüyor - dikkatli olun.")
        else:
            parts.append("MACD sıfır üstünde yatay seyrediyor.")
    else:
        if macd_trend == "Yükseliyor":
            parts.append("MACD sıfır altında ama yükseliyor - toparlanma işareti.")
        elif macd_trend == "Düşüyor":
            parts.append("MACD sıfır altında ve düşüyor - satış baskısı devam ediyor.")
        else:
            parts.append("MACD sıfır altında yatay seyrediyor.")

    # eMacD kesişimi
    if "Pozitif" in emacd_cross:
        parts.append("Kısa vadeli momentum uzun vadeli ortalamanın üstünde.")
    else:
        parts.append("Kısa vadeli momentum uzun vadeli ortalamanın altında.")

    # Uzun vadeli trend
    if long_term_trend == "Boğa":
        parts.append("Uzun vadeli trend yukarı yönlü (EMA377 > EMA610).")
    else:
        parts.append("Uzun vadeli trend aşağı yönlü (EMA377 < EMA610).")

    return " ".join(parts)


def analyze_multiple_stocks(symbols: List[str], get_data_func,
                           get_price_func=None) -> List[NizamiCedidResult]:
    """Birden fazla hisse için analiz yapar"""
    results = []

    for symbol in symbols:
        try:
            df = get_data_func(symbol, "max", "1d")
            if df is None or df.empty:
                continue

            price = None
            change_percent = None
            if get_price_func:
                price_info = get_price_func(symbol)
                if price_info:
                    price = price_info.get('price')
                    change_percent = price_info.get('change_percent')

            result = analyze_single_stock(df, symbol, price, change_percent)
            if result:
                results.append(result)
        except Exception as e:
            print(f"Hata ({symbol}): {e}")
            continue

    # Güce göre sırala (en güçlü al sinyali en üstte)
    results.sort(key=lambda x: x.strength, reverse=True)

    return results


def get_signal_summary_table(results: List[NizamiCedidResult]) -> pd.DataFrame:
    """Sonuçları DataFrame olarak döndürür"""
    if not results:
        return pd.DataFrame()

    data = []
    for r in results:
        data.append({
            'Sembol': r.symbol,
            'Sinyal': r.signal.value,
            'Güç': f"{r.strength:+.0f}",
            'MACD': r.macd_position,
            'Trend': r.macd_trend,
            'eMacD': "Üstünde" if "Pozitif" in r.emacd_cross else "Altında",
            'Uzun Vade': r.long_term_trend,
            'Fiyat': f"{r.price:.2f}" if r.price else "-",
            'Değişim': f"{r.change_percent:+.2f}%" if r.change_percent else "-"
        })

    return pd.DataFrame(data)


def get_signal_color(signal: Signal) -> str:
    """Sinyal için renk döndürür"""
    colors = {
        Signal.STRONG_BUY: "#00C853",
        Signal.BUY: "#4CAF50",
        Signal.WEAK_BUY: "#8BC34A",
        Signal.NEUTRAL: "#9E9E9E",
        Signal.WEAK_SELL: "#FF9800",
        Signal.SELL: "#F44336",
        Signal.STRONG_SELL: "#B71C1C"
    }
    return colors.get(signal, "#9E9E9E")


def categorize_results(results: List[NizamiCedidResult]) -> Dict[str, List[NizamiCedidResult]]:
    """Sonuçları kategorilere ayırır"""
    categories = {
        "Güçlü Al": [],
        "Al": [],
        "Zayıf Al": [],
        "Nötr": [],
        "Zayıf Sat": [],
        "Sat": [],
        "Güçlü Sat": []
    }

    for r in results:
        categories[r.signal.value].append(r)

    return categories
