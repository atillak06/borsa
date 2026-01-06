"""Yardımcı fonksiyonlar"""

from datetime import datetime, timedelta
from typing import Optional


def get_market_status() -> dict:
    """Piyasa durumunu kontrol eder (basit)"""
    now = datetime.now()
    hour = now.hour
    weekday = now.weekday()

    # Hafta sonu
    if weekday >= 5:
        return {"open": False, "message": "Piyasalar kapalı (Hafta sonu)"}

    # BIST saatleri (10:00 - 18:00 TR)
    bist_open = 10 <= hour < 18

    # ABD saatleri (16:30 - 23:00 TR)
    us_open = 16.5 <= hour < 23

    # Kripto 7/24
    crypto_open = True

    return {
        "bist": bist_open,
        "us": us_open,
        "crypto": crypto_open,
        "message": "Piyasalar açık" if (bist_open or us_open) else "Bazı piyasalar kapalı"
    }


def detect_market_type(symbol: str) -> str:
    """Sembolün piyasa türünü tespit eder"""
    symbol = symbol.upper()

    if symbol.endswith('.IS'):
        return 'BIST'
    elif '-USD' in symbol or '-EUR' in symbol:
        return 'Kripto'
    else:
        return 'ABD'


def get_currency_symbol(market_type: str) -> str:
    """Piyasa türüne göre para birimi"""
    currencies = {
        'BIST': '₺',
        'ABD': '$',
        'Kripto': '$'
    }
    return currencies.get(market_type, '$')


def format_large_number(num: Optional[float]) -> str:
    """Büyük sayıları formatla"""
    if num is None:
        return "-"

    if num >= 1_000_000_000_000:
        return f"{num / 1_000_000_000_000:.2f}T"
    elif num >= 1_000_000_000:
        return f"{num / 1_000_000_000:.2f}B"
    elif num >= 1_000_000:
        return f"{num / 1_000_000:.2f}M"
    elif num >= 1_000:
        return f"{num / 1_000:.2f}K"
    else:
        return f"{num:,.2f}"


def calculate_date_range(period: str) -> tuple:
    """Dönem için tarih aralığı hesapla"""
    end_date = datetime.now()

    period_mapping = {
        '1d': timedelta(days=1),
        '5d': timedelta(days=5),
        '1mo': timedelta(days=30),
        '3mo': timedelta(days=90),
        '6mo': timedelta(days=180),
        '1y': timedelta(days=365),
        '2y': timedelta(days=730),
        '5y': timedelta(days=1825),
    }

    delta = period_mapping.get(period, timedelta(days=365))
    start_date = end_date - delta

    return start_date, end_date


def validate_quantity(quantity: str) -> Optional[float]:
    """Miktar doğrulama"""
    try:
        q = float(quantity)
        if q > 0:
            return q
    except (ValueError, TypeError):
        pass
    return None


def validate_price(price: str) -> Optional[float]:
    """Fiyat doğrulama"""
    try:
        p = float(price)
        if p > 0:
            return p
    except (ValueError, TypeError):
        pass
    return None
