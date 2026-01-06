"""Tablo bileşenleri"""

import streamlit as st
import pandas as pd
from typing import List, Dict, Any


def format_currency(value: float, currency: str = "TRY") -> str:
    """Para birimi formatla"""
    if value is None:
        return "-"
    if currency == "TRY":
        return f"₺{value:,.2f}"
    return f"${value:,.2f}"


def format_percent(value: float) -> str:
    """Yüzde formatla"""
    if value is None:
        return "-"
    color = "green" if value >= 0 else "red"
    sign = "+" if value >= 0 else ""
    return f":{color}[{sign}{value:.2f}%]"


def format_number(value: float) -> str:
    """Büyük sayıları formatla"""
    if value is None:
        return "-"
    if value >= 1_000_000_000:
        return f"{value / 1_000_000_000:.2f}B"
    if value >= 1_000_000:
        return f"{value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"{value / 1_000:.2f}K"
    return f"{value:,.0f}"


def render_price_card(price_info: Dict[str, Any]):
    """Fiyat kartı"""
    if not price_info:
        st.warning("Fiyat bilgisi alınamadı")
        return

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            label=price_info.get('name', 'Fiyat'),
            value=f"{price_info['price']:.2f}" if price_info['price'] else "-",
            delta=f"{price_info['change_percent']:.2f}%" if price_info['change_percent'] else None
        )

    with col2:
        st.metric("Önceki Kapanış", f"{price_info['previous_close']:.2f}" if price_info['previous_close'] else "-")

    with col3:
        st.metric("Gün Yüksek", f"{price_info['day_high']:.2f}" if price_info['day_high'] else "-")

    with col4:
        st.metric("Gün Düşük", f"{price_info['day_low']:.2f}" if price_info['day_low'] else "-")


def render_stock_info_table(info: Dict[str, Any]):
    """Hisse bilgi tablosu"""
    if not info:
        return

    data = {
        "Özellik": [],
        "Değer": []
    }

    fields = [
        ("Piyasa Değeri", "marketCap", format_number),
        ("Hacim", "volume", format_number),
        ("Ort. Hacim (10g)", "averageVolume10days", format_number),
        ("52H Yüksek", "fiftyTwoWeekHigh", lambda x: f"{x:.2f}"),
        ("52H Düşük", "fiftyTwoWeekLow", lambda x: f"{x:.2f}"),
        ("F/K Oranı", "trailingPE", lambda x: f"{x:.2f}"),
        ("PD/DD", "priceToBook", lambda x: f"{x:.2f}"),
        ("Temettü Verimi", "dividendYield", lambda x: f"{x*100:.2f}%"),
        ("Beta", "beta", lambda x: f"{x:.2f}"),
    ]

    for label, key, formatter in fields:
        value = info.get(key)
        if value is not None:
            data["Özellik"].append(label)
            data["Değer"].append(formatter(value))

    if data["Özellik"]:
        st.dataframe(pd.DataFrame(data), use_container_width=True, hide_index=True)


def render_portfolio_table(holdings: List[Dict[str, Any]]):
    """Portföy tablosu"""
    if not holdings:
        st.info("Portföyünüz boş")
        return

    df = pd.DataFrame(holdings)

    # Sütunları formatla
    df['Fiyat'] = df['current_price'].apply(lambda x: f"{x:.2f}")
    df['Maliyet'] = df['avg_price'].apply(lambda x: f"{x:.2f}")
    df['Değer'] = df['value'].apply(lambda x: f"{x:,.2f}")
    df['K/Z'] = df['profit_loss'].apply(lambda x: f"{x:+,.2f}")
    df['K/Z %'] = df['profit_loss_percent'].apply(lambda x: f"{x:+.2f}%")
    df['Ağırlık'] = df['weight'].apply(lambda x: f"{x:.1f}%")

    display_df = df[['symbol', 'name', 'quantity', 'Maliyet', 'Fiyat', 'Değer', 'K/Z', 'K/Z %', 'Ağırlık']]
    display_df.columns = ['Sembol', 'İsim', 'Adet', 'Maliyet', 'Fiyat', 'Değer', 'K/Z', 'K/Z %', 'Ağırlık']

    st.dataframe(display_df, use_container_width=True, hide_index=True)


def render_transactions_table(transactions: List[Dict[str, Any]]):
    """İşlem geçmişi tablosu"""
    if not transactions:
        st.info("Henüz işlem yok")
        return

    df = pd.DataFrame(transactions)

    df['İşlem'] = df['transaction_type'].apply(lambda x: "🟢 ALIŞ" if x == "BUY" else "🔴 SATIŞ")
    df['Tarih'] = pd.to_datetime(df['date']).dt.strftime('%d.%m.%Y %H:%M')
    df['Fiyat'] = df['price'].apply(lambda x: f"{x:.2f}")
    df['Toplam'] = df['total_value'].apply(lambda x: f"{x:,.2f}")

    display_df = df[['Tarih', 'symbol', 'İşlem', 'quantity', 'Fiyat', 'Toplam']]
    display_df.columns = ['Tarih', 'Sembol', 'İşlem', 'Adet', 'Fiyat', 'Toplam']

    st.dataframe(display_df, use_container_width=True, hide_index=True)


def render_watchlist_table(watchlist: List[Dict[str, Any]], prices: Dict[str, Any]):
    """Watchlist tablosu"""
    if not watchlist:
        st.info("Watchlist boş. Hisse ekleyin!")
        return

    data = []
    for item in watchlist:
        symbol = item['symbol']
        price_info = prices.get(symbol, {})

        data.append({
            'Sembol': symbol,
            'İsim': price_info.get('name', symbol),
            'Fiyat': price_info.get('price', '-'),
            'Değişim %': price_info.get('change_percent', 0),
            'Hedef': item.get('target_price', '-'),
            'Alarm': '🔔' if item.get('alert_enabled') else ''
        })

    df = pd.DataFrame(data)

    # Değişim rengini ayarla
    def color_change(val):
        if isinstance(val, (int, float)):
            color = 'green' if val >= 0 else 'red'
            return f'color: {color}'
        return ''

    styled_df = df.style.applymap(color_change, subset=['Değişim %'])
    st.dataframe(styled_df, use_container_width=True, hide_index=True)


def render_signals_card(signals: Dict[str, List[str]]):
    """Teknik analiz sinyalleri kartı"""
    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("### 🟢 Yükseliş")
        if signals.get('bullish'):
            for signal in signals['bullish']:
                st.markdown(f"- {signal}")
        else:
            st.markdown("_Sinyal yok_")

    with col2:
        st.markdown("### 🔴 Düşüş")
        if signals.get('bearish'):
            for signal in signals['bearish']:
                st.markdown(f"- {signal}")
        else:
            st.markdown("_Sinyal yok_")

    with col3:
        st.markdown("### ⚪ Nötr")
        if signals.get('neutral'):
            for signal in signals['neutral']:
                st.markdown(f"- {signal}")
        else:
            st.markdown("_Sinyal yok_")
