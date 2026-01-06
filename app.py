"""Ana Streamlit Uygulaması"""

import streamlit as st
import pandas as pd

# Sayfa yapılandırması
st.set_page_config(
    page_title="Borsa Takip",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Servisler
from services.market_data import (
    get_stock_data, get_stock_info, get_current_price, get_multiple_prices
)
from services.analysis import add_all_indicators, get_signal_summary
from services.portfolio import calculate_portfolio_value, get_portfolio_allocation
from services.nizami_cedid_analysis import (
    analyze_multiple_stocks, analyze_single_stock, get_signal_summary_table,
    get_signal_color, categorize_results, Signal
)
from database.db import (
    get_portfolio, add_to_portfolio, sell_from_portfolio, delete_portfolio_item,
    get_watchlist, add_to_watchlist, remove_from_watchlist,
    get_transactions
)
from components.charts import (
    create_candlestick_chart, add_sma_to_chart, add_bollinger_to_chart,
    create_rsi_chart, create_macd_chart, create_portfolio_pie_chart,
    create_line_chart, get_chart_config, create_nizami_cedid_chart
)
from components.tables import (
    render_price_card, render_stock_info_table, render_portfolio_table,
    render_transactions_table, render_watchlist_table, render_signals_card
)
from components.sidebar import render_symbol_selector, render_period_selector, render_indicator_selector
from config import DEFAULT_SYMBOLS, PERIODS


def main():
    # Sidebar
    with st.sidebar:
        st.title("📈 Borsa Takip")
        st.divider()

        page = st.radio(
            "Sayfa",
            ["🏠 Piyasa", "📊 Teknik Analiz", "🎯 MACD Paşa", "💼 Portföy", "⭐ Watchlist"],
            label_visibility="collapsed"
        )

    # Sayfa routing
    if page == "🏠 Piyasa":
        render_market_page()
    elif page == "📊 Teknik Analiz":
        render_analysis_page()
    elif page == "🎯 MACD Paşa":
        render_macd_pasa_page()
    elif page == "💼 Portföy":
        render_portfolio_page()
    elif page == "⭐ Watchlist":
        render_watchlist_page()


def render_market_page():
    """Piyasa sayfası"""
    st.title("🏠 Piyasa Takibi")

    # Sembol seçimi
    with st.sidebar:
        st.subheader("Sembol Seçimi")
        symbol = render_symbol_selector("market")
        period, interval = render_period_selector("market")

    # Fiyat bilgisi
    price_info = get_current_price(symbol)
    if price_info:
        render_price_card(price_info)
    else:
        st.error(f"'{symbol}' için veri bulunamadı. Sembolü kontrol edin.")
        return

    st.divider()

    # Grafik için maksimum veri çek (range selector ile kullanıcı istediği aralığı seçer)
    df = get_stock_data(symbol, "max", interval)

    # Fiyat + Hacim + NizamiCedid (senkronize grafikler)
    if df is not None and not df.empty:
        fig = create_candlestick_chart(df, f"{symbol} - Fiyat Grafiği", show_nizami_cedid=True)
        st.plotly_chart(fig, use_container_width=True, config=get_chart_config())
    else:
        st.warning("Grafik verisi yüklenemedi")

    # Hisse bilgileri (aşağıda)
    st.divider()
    st.subheader("Hisse Bilgileri")
    info = get_stock_info(symbol)
    render_stock_info_table(info)

    # Popüler hisseler
    st.divider()
    st.subheader("Popüler Hisseler")

    tabs = st.tabs(["BIST", "ABD", "Kripto"])

    for i, (market, symbols) in enumerate(DEFAULT_SYMBOLS.items()):
        with tabs[i]:
            prices_df = get_multiple_prices(symbols[:6])
            if not prices_df.empty:
                st.dataframe(prices_df, use_container_width=True, hide_index=True)


def render_analysis_page():
    """Teknik analiz sayfası"""
    st.title("📊 Teknik Analiz")

    # Sidebar ayarları
    with st.sidebar:
        st.subheader("Analiz Ayarları")
        symbol = render_symbol_selector("analysis")
        period, interval = render_period_selector("analysis")
        st.divider()
        indicators = render_indicator_selector("analysis")

    # Veri çek ve göstergeleri hesapla (maksimum veri - range selector ile seçim yapılır)
    df = get_stock_data(symbol, "max", interval)

    if df is None or df.empty:
        st.error(f"'{symbol}' için veri bulunamadı")
        return

    df = add_all_indicators(df)

    # Fiyat kartı
    price_info = get_current_price(symbol)
    if price_info:
        render_price_card(price_info)

    st.divider()

    # Ana grafik
    fig = create_candlestick_chart(df, f"{symbol} - Teknik Analiz")

    # SMA ekle
    if indicators.get('sma'):
        for period_val in indicators['sma']:
            df[f'SMA_{period_val}'] = df['Close'].rolling(window=period_val).mean()
        fig = add_sma_to_chart(fig, df, indicators['sma'])

    # Bollinger ekle
    if indicators.get('bollinger'):
        fig = add_bollinger_to_chart(fig, df)

    st.plotly_chart(fig, use_container_width=True, config=get_chart_config())

    # Alt göstergeler
    col1, col2 = st.columns(2)

    with col1:
        if indicators.get('rsi') and 'RSI' in df.columns:
            st.plotly_chart(create_rsi_chart(df), use_container_width=True, config=get_chart_config())

    with col2:
        if indicators.get('macd') and 'MACD' in df.columns:
            st.plotly_chart(create_macd_chart(df), use_container_width=True, config=get_chart_config())

    # Sinyal özeti
    st.divider()
    st.subheader("Sinyal Özeti")
    signals = get_signal_summary(df)
    render_signals_card(signals)


def render_macd_pasa_page():
    """MACD Paşa (NizamiCedid) Analiz Sayfası"""
    st.title("🎯 MACD Paşa Analizi")
    st.caption("NizamiCedid (3. Selim) indikatörü ile 30 hissenin analizi")

    # Sidebar ayarları
    with st.sidebar:
        st.subheader("Analiz Ayarları")

        market = st.selectbox(
            "Piyasa",
            ["BIST", "ABD", "Kripto"],
            key="macd_pasa_market"
        )

        num_stocks = st.slider(
            "Analiz Edilecek Hisse Sayısı",
            min_value=5,
            max_value=50,
            value=30,
            step=5,
            key="macd_pasa_count"
        )

        if st.button("🔄 Analizi Başlat", type="primary", use_container_width=True):
            st.session_state['run_macd_analysis'] = True
            st.session_state['macd_market'] = market
            st.session_state['macd_count'] = num_stocks

    # Analiz başlatıldı mı kontrol et
    if st.session_state.get('run_macd_analysis'):
        market = st.session_state.get('macd_market', 'BIST')
        num_stocks = st.session_state.get('macd_count', 30)

        symbols = DEFAULT_SYMBOLS[market][:num_stocks]

        with st.spinner(f"{len(symbols)} hisse analiz ediliyor..."):
            results = analyze_multiple_stocks(
                symbols,
                get_stock_data,
                get_current_price
            )

        if not results:
            st.warning("Yeterli veri bulunamadı. En az 610 günlük veri gereklidir.")
            return

        # Özet istatistikler
        st.subheader("📊 Özet")
        categories = categorize_results(results)

        cols = st.columns(7)
        signal_names = ["Güçlü Al", "Al", "Zayıf Al", "Nötr", "Zayıf Sat", "Sat", "Güçlü Sat"]
        signal_colors = ["#00C853", "#4CAF50", "#8BC34A", "#9E9E9E", "#FF9800", "#F44336", "#B71C1C"]

        for i, (col, name, color) in enumerate(zip(cols, signal_names, signal_colors)):
            count = len(categories.get(name, []))
            with col:
                st.markdown(
                    f"<div style='text-align:center; padding:10px; background-color:{color}20; "
                    f"border-radius:10px; border-left:4px solid {color}'>"
                    f"<h3 style='margin:0; color:{color}'>{count}</h3>"
                    f"<small>{name}</small></div>",
                    unsafe_allow_html=True
                )

        st.divider()

        # Sonuç tablosu
        st.subheader("📋 Detaylı Sonuçlar")
        df_results = get_signal_summary_table(results)
        if not df_results.empty:
            st.dataframe(
                df_results,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "Güç": st.column_config.ProgressColumn(
                        "Güç",
                        min_value=-100,
                        max_value=100,
                        format="%d"
                    )
                }
            )

        st.divider()

        # En iyi ve en kötü hisseler
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("🚀 En Güçlü Al Sinyalleri")
            top_buys = [r for r in results if r.strength > 0][:5]
            for r in top_buys:
                color = get_signal_color(r.signal)
                st.markdown(
                    f"**{r.symbol}** - {r.signal.value} ({r.strength:+.0f})",
                )
                st.caption(r.description)
                st.divider()

        with col2:
            st.subheader("⚠️ En Güçlü Sat Sinyalleri")
            top_sells = [r for r in results if r.strength < 0][-5:][::-1]
            for r in top_sells:
                color = get_signal_color(r.signal)
                st.markdown(
                    f"**{r.symbol}** - {r.signal.value} ({r.strength:+.0f})",
                )
                st.caption(r.description)
                st.divider()

        # Detaylı analiz seçimi
        st.divider()
        st.subheader("🔍 Detaylı Hisse Analizi")

        analyzed_symbols = [r.symbol for r in results]
        selected_symbol = st.selectbox(
            "Hisse Seçin",
            analyzed_symbols,
            key="macd_detail_symbol"
        )

        if selected_symbol:
            selected_result = next((r for r in results if r.symbol == selected_symbol), None)
            if selected_result:
                # Detay kartı
                col1, col2, col3 = st.columns(3)

                with col1:
                    color = get_signal_color(selected_result.signal)
                    st.markdown(
                        f"<div style='text-align:center; padding:20px; background-color:{color}20; "
                        f"border-radius:10px; border:2px solid {color}'>"
                        f"<h2 style='margin:0; color:{color}'>{selected_result.signal.value}</h2>"
                        f"<h4>Güç: {selected_result.strength:+.0f}</h4></div>",
                        unsafe_allow_html=True
                    )

                with col2:
                    st.metric("MACD Pozisyonu", selected_result.macd_position)
                    st.metric("MACD Trendi", selected_result.macd_trend)

                with col3:
                    st.metric("eMacD Durumu", "Üstünde" if "Pozitif" in selected_result.emacd_cross else "Altında")
                    st.metric("Uzun Vadeli Trend", selected_result.long_term_trend)

                # Yorum
                st.info(f"**Yorum:** {selected_result.description}")

                # Grafik göster
                df = get_stock_data(selected_symbol, "max", "1d")
                if df is not None and not df.empty:
                    fig = create_candlestick_chart(df, f"{selected_symbol} - MACD Paşa Analizi", show_nizami_cedid=True)
                    st.plotly_chart(fig, use_container_width=True, config=get_chart_config())

        # Analiz durumunu sıfırla
        st.session_state['run_macd_analysis'] = False

    else:
        # Başlangıç ekranı
        st.info("👈 Sidebar'dan piyasa seçin ve **Analizi Başlat** butonuna tıklayın.")

        st.markdown("""
        ### NizamiCedid (MACD Paşa) İndikatörü Nedir?

        Bu indikatör, klasik MACD'nin geliştirilmiş bir versiyonudur:

        - **EMA 120/260**: Hızlı ve yavaş hareketli ortalamalar
        - **VWMA 185**: Hacim ağırlıklı MACD ortalaması (eMacD)
        - **EMA 377/610**: Uzun vadeli trend belirleme

        ### Sinyal Yorumlama

        | Sinyal | Güç Aralığı | Anlam |
        |--------|-------------|-------|
        | Güçlü Al | +70 ile +100 | Tüm göstergeler pozitif |
        | Al | +40 ile +70 | Çoğu gösterge pozitif |
        | Zayıf Al | +15 ile +40 | Hafif pozitif eğilim |
        | Nötr | -15 ile +15 | Belirsizlik |
        | Zayıf Sat | -40 ile -15 | Hafif negatif eğilim |
        | Sat | -70 ile -40 | Çoğu gösterge negatif |
        | Güçlü Sat | -100 ile -70 | Tüm göstergeler negatif |
        """)


def render_portfolio_page():
    """Portföy sayfası"""
    st.title("💼 Portföy Yönetimi")

    # Portföy özeti
    portfolio_data = calculate_portfolio_value()

    # Özet metrikler
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Toplam Değer", f"{portfolio_data['total_value']:,.2f}")

    with col2:
        st.metric("Toplam Maliyet", f"{portfolio_data['total_cost']:,.2f}")

    with col3:
        profit = portfolio_data['total_profit_loss']
        st.metric(
            "Kar/Zarar",
            f"{profit:+,.2f}",
            delta=f"{portfolio_data['total_profit_loss_percent']:+.2f}%"
        )

    with col4:
        st.metric("Hisse Sayısı", len(portfolio_data['holdings']))

    st.divider()

    # İşlem ekleme
    with st.sidebar:
        st.subheader("İşlem Ekle")

        trans_type = st.radio("İşlem Türü", ["Alış", "Satış"], horizontal=True)
        trans_symbol = st.text_input("Sembol", placeholder="THYAO.IS").upper()
        trans_quantity = st.number_input("Adet", min_value=0.0, step=1.0)
        trans_price = st.number_input("Fiyat", min_value=0.0, step=0.01)

        if st.button("İşlemi Kaydet", type="primary", use_container_width=True):
            if trans_symbol and trans_quantity > 0 and trans_price > 0:
                if trans_type == "Alış":
                    add_to_portfolio(trans_symbol, trans_quantity, trans_price)
                    st.success(f"{trans_symbol} alındı!")
                else:
                    if sell_from_portfolio(trans_symbol, trans_quantity, trans_price):
                        st.success(f"{trans_symbol} satıldı!")
                    else:
                        st.error("Yetersiz miktar!")
                st.rerun()
            else:
                st.error("Tüm alanları doldurun")

    # Portföy tablosu ve grafik
    col1, col2 = st.columns([2, 1])

    with col1:
        st.subheader("Portföy")
        render_portfolio_table(portfolio_data['holdings'])

    with col2:
        if portfolio_data['holdings']:
            st.plotly_chart(
                create_portfolio_pie_chart(portfolio_data['holdings']),
                use_container_width=True,
                config=get_chart_config()
            )

    # İşlem geçmişi
    st.divider()
    st.subheader("İşlem Geçmişi")
    transactions = get_transactions(limit=20)
    render_transactions_table(transactions)


def render_watchlist_page():
    """Watchlist sayfası"""
    st.title("⭐ Watchlist")

    # Sidebar - sembol ekleme
    with st.sidebar:
        st.subheader("Sembol Ekle")
        new_symbol = st.text_input("Sembol", placeholder="AAPL, THYAO.IS").upper()
        target_price = st.number_input("Hedef Fiyat (opsiyonel)", min_value=0.0, step=0.01)

        if st.button("Watchlist'e Ekle", type="primary", use_container_width=True):
            if new_symbol:
                add_to_watchlist(new_symbol, target_price if target_price > 0 else None)
                st.success(f"{new_symbol} eklendi!")
                st.rerun()

    # Watchlist
    watchlist = get_watchlist()

    if not watchlist:
        st.info("Watchlist boş. Sidebar'dan sembol ekleyin!")
        return

    # Fiyatları çek
    symbols = [item['symbol'] for item in watchlist]
    prices = {}
    for symbol in symbols:
        price_info = get_current_price(symbol)
        if price_info:
            prices[symbol] = price_info

    # Tablo
    st.subheader(f"Takip Listesi ({len(watchlist)} sembol)")

    for item in watchlist:
        symbol = item['symbol']
        price_info = prices.get(symbol, {})

        with st.container():
            col1, col2, col3, col4, col5 = st.columns([2, 2, 2, 2, 1])

            with col1:
                st.markdown(f"**{symbol}**")
                st.caption(price_info.get('name', ''))

            with col2:
                price = price_info.get('price')
                st.metric("Fiyat", f"{price:.2f}" if price else "-")

            with col3:
                change = price_info.get('change_percent', 0)
                color = "🟢" if change >= 0 else "🔴"
                st.metric("Değişim", f"{color} {change:+.2f}%")

            with col4:
                target = item.get('target_price')
                if target and price:
                    diff = ((target - price) / price) * 100
                    st.metric("Hedef", f"{target:.2f}", delta=f"{diff:+.1f}%")
                else:
                    st.metric("Hedef", "-")

            with col5:
                if st.button("🗑️", key=f"del_{symbol}"):
                    remove_from_watchlist(symbol)
                    st.rerun()

            st.divider()

    # Karşılaştırma grafiği
    if len(symbols) > 1:
        st.subheader("Performans Karşılaştırması")
        period = st.selectbox("Dönem", list(PERIODS.keys()), index=5)

        comparison_data = {}
        for symbol in symbols[:5]:  # Max 5 sembol
            df = get_stock_data(symbol, PERIODS[period], "1d")
            if df is not None and not df.empty:
                comparison_data[symbol] = df

        if comparison_data:
            from components.charts import create_comparison_chart
            fig = create_comparison_chart(comparison_data, "Performans Karşılaştırması (%)")
            st.plotly_chart(fig, use_container_width=True, config=get_chart_config())


if __name__ == "__main__":
    main()
