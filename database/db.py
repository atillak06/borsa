"""SQLite veritabanı işlemleri"""

import sqlite3
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import contextmanager

DATABASE_PATH = "data/portfolio.db"


def get_db_path() -> str:
    """Veritabanı yolunu döndürür"""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    return DATABASE_PATH


@contextmanager
def get_connection():
    """Veritabanı bağlantısı context manager"""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Veritabanı tablolarını oluşturur"""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Portföy tablosu
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS portfolio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                quantity REAL NOT NULL,
                avg_price REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # İşlem geçmişi
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                quantity REAL NOT NULL,
                price REAL NOT NULL,
                total_value REAL NOT NULL,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            )
        """)

        # Watchlist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT UNIQUE NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                target_price REAL,
                alert_enabled INTEGER DEFAULT 0
            )
        """)

        conn.commit()


# Portföy işlemleri
def get_portfolio() -> List[Dict[str, Any]]:
    """Portföyü getirir"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM portfolio WHERE quantity > 0")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def add_to_portfolio(symbol: str, quantity: float, price: float):
    """Portföye hisse ekler veya günceller"""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Mevcut pozisyon var mı?
        cursor.execute("SELECT * FROM portfolio WHERE symbol = ?", (symbol,))
        existing = cursor.fetchone()

        if existing:
            # Ortalama maliyet hesapla
            total_quantity = existing['quantity'] + quantity
            total_cost = (existing['quantity'] * existing['avg_price']) + (quantity * price)
            new_avg_price = total_cost / total_quantity

            cursor.execute("""
                UPDATE portfolio
                SET quantity = ?, avg_price = ?, updated_at = ?
                WHERE symbol = ?
            """, (total_quantity, new_avg_price, datetime.now(), symbol))
        else:
            cursor.execute("""
                INSERT INTO portfolio (symbol, quantity, avg_price)
                VALUES (?, ?, ?)
            """, (symbol, quantity, price))

        # İşlemi kaydet
        add_transaction(symbol, "BUY", quantity, price)


def sell_from_portfolio(symbol: str, quantity: float, price: float) -> bool:
    """Portföyden hisse satar"""
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM portfolio WHERE symbol = ?", (symbol,))
        existing = cursor.fetchone()

        if not existing or existing['quantity'] < quantity:
            return False

        new_quantity = existing['quantity'] - quantity

        if new_quantity > 0:
            cursor.execute("""
                UPDATE portfolio
                SET quantity = ?, updated_at = ?
                WHERE symbol = ?
            """, (new_quantity, datetime.now(), symbol))
        else:
            cursor.execute("DELETE FROM portfolio WHERE symbol = ?", (symbol,))

        add_transaction(symbol, "SELL", quantity, price)
        return True


def delete_portfolio_item(symbol: str):
    """Portföyden hisse siler"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM portfolio WHERE symbol = ?", (symbol,))


# İşlem geçmişi
def add_transaction(symbol: str, trans_type: str, quantity: float, price: float, notes: str = ""):
    """İşlem kaydı ekler"""
    with get_connection() as conn:
        cursor = conn.cursor()
        total_value = quantity * price
        cursor.execute("""
            INSERT INTO transactions (symbol, transaction_type, quantity, price, total_value, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (symbol, trans_type, quantity, price, total_value, notes))


def get_transactions(symbol: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """İşlem geçmişini getirir"""
    with get_connection() as conn:
        cursor = conn.cursor()
        if symbol:
            cursor.execute(
                "SELECT * FROM transactions WHERE symbol = ? ORDER BY date DESC LIMIT ?",
                (symbol, limit)
            )
        else:
            cursor.execute(
                "SELECT * FROM transactions ORDER BY date DESC LIMIT ?",
                (limit,)
            )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


# Watchlist işlemleri
def get_watchlist() -> List[Dict[str, Any]]:
    """Watchlist'i getirir"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM watchlist ORDER BY added_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def add_to_watchlist(symbol: str, target_price: Optional[float] = None):
    """Watchlist'e sembol ekler"""
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO watchlist (symbol, target_price)
                VALUES (?, ?)
            """, (symbol, target_price))
        except sqlite3.IntegrityError:
            # Zaten var
            pass


def remove_from_watchlist(symbol: str):
    """Watchlist'ten sembol çıkarır"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol,))


def update_watchlist_alert(symbol: str, target_price: float, enabled: bool):
    """Watchlist alarmını günceller"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE watchlist
            SET target_price = ?, alert_enabled = ?
            WHERE symbol = ?
        """, (target_price, 1 if enabled else 0, symbol))


# Veritabanını başlat
init_db()
