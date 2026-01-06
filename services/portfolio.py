"""Portföy hesaplamaları"""

from typing import List, Dict, Any
from database.db import get_portfolio, get_transactions
from services.market_data import get_current_price


def calculate_portfolio_value() -> Dict[str, Any]:
    """Toplam portföy değerini hesaplar"""
    portfolio = get_portfolio()

    total_value = 0
    total_cost = 0
    holdings = []

    for item in portfolio:
        symbol = item['symbol']
        quantity = item['quantity']
        avg_price = item['avg_price']

        price_info = get_current_price(symbol)
        current_price = price_info['price'] if price_info else avg_price

        cost = quantity * avg_price
        value = quantity * current_price
        profit_loss = value - cost
        profit_loss_percent = (profit_loss / cost * 100) if cost > 0 else 0

        total_cost += cost
        total_value += value

        holdings.append({
            'symbol': symbol,
            'name': price_info['name'] if price_info else symbol,
            'quantity': quantity,
            'avg_price': avg_price,
            'current_price': current_price,
            'cost': cost,
            'value': value,
            'profit_loss': profit_loss,
            'profit_loss_percent': profit_loss_percent,
            'daily_change': price_info['change_percent'] if price_info else 0,
            'weight': 0  # Aşağıda hesaplanacak
        })

    # Ağırlıkları hesapla
    for holding in holdings:
        holding['weight'] = (holding['value'] / total_value * 100) if total_value > 0 else 0

    total_profit_loss = total_value - total_cost
    total_profit_loss_percent = (total_profit_loss / total_cost * 100) if total_cost > 0 else 0

    return {
        'holdings': sorted(holdings, key=lambda x: x['value'], reverse=True),
        'total_cost': total_cost,
        'total_value': total_value,
        'total_profit_loss': total_profit_loss,
        'total_profit_loss_percent': total_profit_loss_percent
    }


def get_portfolio_allocation() -> List[Dict[str, Any]]:
    """Portföy dağılımını hesaplar"""
    portfolio_data = calculate_portfolio_value()
    holdings = portfolio_data['holdings']

    return [
        {
            'symbol': h['symbol'],
            'name': h['name'],
            'value': h['value'],
            'weight': h['weight']
        }
        for h in holdings
    ]


def get_performance_summary() -> Dict[str, Any]:
    """Performans özeti"""
    transactions = get_transactions(limit=1000)

    total_invested = 0
    total_withdrawn = 0
    buy_count = 0
    sell_count = 0

    for trans in transactions:
        if trans['transaction_type'] == 'BUY':
            total_invested += trans['total_value']
            buy_count += 1
        else:
            total_withdrawn += trans['total_value']
            sell_count += 1

    portfolio_data = calculate_portfolio_value()

    realized_profit = total_withdrawn - (total_invested * (total_withdrawn / total_invested)) if total_invested > 0 else 0
    unrealized_profit = portfolio_data['total_profit_loss']

    return {
        'total_invested': total_invested,
        'total_withdrawn': total_withdrawn,
        'net_invested': total_invested - total_withdrawn,
        'current_value': portfolio_data['total_value'],
        'realized_profit': realized_profit,
        'unrealized_profit': unrealized_profit,
        'total_profit': realized_profit + unrealized_profit,
        'buy_count': buy_count,
        'sell_count': sell_count,
        'total_transactions': buy_count + sell_count
    }


def get_sector_allocation(holdings: List[Dict[str, Any]]) -> Dict[str, float]:
    """Sektör bazlı dağılım (basitleştirilmiş)"""
    # Bu basit bir implementasyon
    # Gerçek uygulamada yfinance'dan sektör bilgisi çekilebilir
    sectors = {}
    for holding in holdings:
        symbol = holding['symbol']

        # Basit sınıflandırma
        if symbol.endswith('.IS'):
            sector = 'BIST'
        elif symbol.endswith('-USD'):
            sector = 'Kripto'
        else:
            sector = 'ABD'

        if sector not in sectors:
            sectors[sector] = 0
        sectors[sector] += holding['weight']

    return sectors
