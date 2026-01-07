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


def calculate_nizami_cedid_indicators(df: pd.DataFrame,
                                     fast_length: int = 120,
                                     slow_length: int = 260,
                                     signal_length: int = 50,
                                     vwma_length: int = 185,
                                     ema_long1: int = 377,
                                     ema_long2: int = 610) -> Dict[str, pd.Series]:
    """NizamiCedid indikatör değerlerini hesaplar (Dinamik Parametreler)"""
    # En uzun periyodu bulup veri kontrolü yapalım
    max_period = max(fast_length, slow_length, signal_length, vwma_length, ema_long1, ema_long2)
    if df is None or df.empty or len(df) < max_period:
        return {}

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
    ema_l1 = close.ewm(span=ema_long1, adjust=False).mean()
    ema_l2 = close.ewm(span=ema_long2, adjust=False).mean()

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
        'ema_long1': ema_l1,
        'ema_long2': ema_l2,
        'fast_ma': fast_ma,
        'close': close
    }


def analyze_single_stock(df: pd.DataFrame, symbol: str,
                         price: Optional[float] = None,
                         change_percent: Optional[float] = None,
                         params: Dict = None) -> Optional[NizamiCedidResult]:
    """Tek bir hisse için NizamiCedid analizi yapar"""
    params = params or {}
    indicators = calculate_nizami_cedid_indicators(df, **params)

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

    ema_l1_now = indicators['ema_long1'].iloc[-1]
    ema_l2_now = indicators['ema_long2'].iloc[-1]

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

    # 5. Uzun vadeli trend (EMA L1 vs EMA L2)
    long_term_trend = "Boğa" if ema_l1_now > ema_l2_now else "Ayı"

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
        parts.append("Uzun vadeli trend yukarı yönlü (Uzun EMA > En Uzun EMA).")
    else:
        parts.append("Uzun vadeli trend aşağı yönlü (Uzun EMA < En Uzun EMA).")

    return " ".join(parts)


def backtest_nizami_cedid(df: pd.DataFrame, params: Dict = None) -> Dict:
    """Geçmiş veriler üzerinde stratejiyi test eder"""
    params = params or {}
    indicators = calculate_nizami_cedid_indicators(df, **params)

    if not indicators:
        return {}

    macd_norm = indicators['macd_norm']

    # Basit bir backtest mantığı:
    # +40 gücü geçtiğinde (kabaca MACD pozitife döndüğünde ve trend varken) AL
    # -40 altına indiğinde SAT
    # Bu tam olarak 'Strength' hesaplamasını simüle etmiyor ama yakınsamaya çalışalım.
    # Daha basit: MACD sıfır yukarı kesince AL, aşağı kesince SAT.
    # Ama Nizami Cedid stratejisi daha karmaşık.
    # Şimdilik basit MACD Cross stratejisi uygulayalım (Nizami Cedid parametreleri ile)

    macd = indicators['macd']
    signal = indicators['signal']

    signals = pd.Series(0, index=df.index)
    # Al sinyali: MACD > Signal
    signals[macd > signal] = 1
    # Sat sinyali: MACD < Signal
    signals[macd < signal] = -1

    # Pozisyon değişimi
    positions = signals.diff()

    trades = []
    current_position = 0 # 0: yok, 1: var
    entry_price = 0
    entry_date = None

    for i in range(len(positions)):
        if positions.iloc[i] == 0:
            continue

        date = positions.index[i]
        price = df.loc[date]['Close']

        # Alış Sinyali (Pozisyon yoksa al)
        if signals.iloc[i] == 1 and current_position == 0:
            current_position = 1
            entry_price = price
            entry_date = date
            trades.append({
                'Tarih': date,
                'İşlem': 'AL',
                'Fiyat': price,
                'Kar/Zarar %': 0
            })

        # Satış Sinyali (Pozisyon varsa sat)
        elif signals.iloc[i] == -1 and current_position == 1:
            current_position = 0
            pnl = ((price - entry_price) / entry_price) * 100
            trades.append({
                'Tarih': date,
                'İşlem': 'SAT',
                'Fiyat': price,
                'Kar/Zarar %': pnl
            })

    # Sonuçları hesapla
    total_trades = len([t for t in trades if t['İşlem'] == 'SAT'])
    winning_trades = len([t for t in trades if t['İşlem'] == 'SAT' and t['Kar/Zarar %'] > 0])
    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
    total_return = sum([t['Kar/Zarar %'] for t in trades if t['İşlem'] == 'SAT'])

    return {
        'trades': pd.DataFrame(trades),
        'total_trades': total_trades,
        'win_rate': win_rate,
        'total_return': total_return
    }


def analyze_multiple_stocks(symbols: List[str], get_data_func=None,
                           get_price_func=None, params: Dict = None) -> List[NizamiCedidResult]:
    """Birden fazla hisse için analiz yapar (Optimize edilmiş)"""
    # Circular import önlemek için fonksiyon içinde import
    from services.market_data import get_batch_stock_data, get_multiple_prices, adjust_bist_data

    results = []

    # Batch veri çekme (en az 610 gün gerekli, max alıyoruz)
    batch_df = get_batch_stock_data(symbols, period="max", interval="1d")

    # Analiz
    # yf.download group_by='ticker' ile her zaman MultiIndex dönebilir (Ticker, Price)
    is_multi_index = isinstance(batch_df.columns, pd.MultiIndex)

    for symbol in symbols:
        try:
            # Veriyi al
            df = None
            if is_multi_index:
                 # MultiIndex ise (Ticker, Price) yapısındadır
                 # columns.levels[0] Ticker'ları içerir
                 if symbol in batch_df.columns.get_level_values(0):
                     df = batch_df[symbol].copy()
                 # Bazen tek sembolde levels[0] yerine direkt column isimleri gelebilir mi?
                 # yfinance son sürümlerde tek sembolde de MultiIndex dönebilir.
                 # Eğer batch_df[(symbol, 'Close')] erişimi gerekirse:
                 elif (symbol, 'Close') in batch_df.columns:
                     df = batch_df[symbol].copy()
            else:
                 # MultiIndex değilse, tek sembol verisidir
                 # Ancak birden fazla sembol isteyip tek bir tane geldiyse (diğerleri hata verdiyse),
                 # bu verinin kime ait olduğunu bilemeyebiliriz (yfinance bazen ticker bilgisini kaybeder).
                 # Bu yüzden sadece tek sembol istendiyse bu veriyi kullanıyoruz.
                 if len(symbols) == 1:
                     df = batch_df.copy()
                 else:
                     # Çoklu sembol isteyip flat dataframe döndüyse ve bu sembol içinde değilse
                     # (veya hangisi olduğunu bilmiyorsak) riske girmeyip atlıyoruz.
                     # Ticker'ı index'ten veya column'dan kurtarmaya çalışabiliriz ama garanti değil.
                     continue

            if df is None or df.empty:
                continue

            # NA temizle
            df = df.dropna(how='all')
            if df.empty:
                continue

            # BIST düzeltmesi
            df = adjust_bist_data(df, symbol)

            # Fiyat ve değişim bilgisini df'den hesapla
            try:
                latest = df.iloc[-1]
                prev = df.iloc[-2] if len(df) > 1 else latest

                price = float(latest['Close'])
                prev_close = float(prev['Close'])

                if prev_close != 0:
                    change_percent = ((price - prev_close) / prev_close) * 100
                else:
                    change_percent = 0.0
            except:
                price = 0.0
                change_percent = 0.0

            result = analyze_single_stock(df, symbol, price, change_percent, params=params)
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
