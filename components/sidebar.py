"""Sidebar bileşeni"""

import streamlit as st
from config import DEFAULT_SYMBOLS, PERIODS, INTERVALS

# Sembol isimleri sözlüğü (arama için)
SYMBOL_NAMES = {
    # BIST Popüler
    "THYAO.IS": "Türk Hava Yolları",
    "GARAN.IS": "Garanti Bankası",
    "AKBNK.IS": "Akbank",
    "YKBNK.IS": "Yapı Kredi Bankası",
    "ISCTR.IS": "İş Bankası",
    "HALKB.IS": "Halkbank",
    "VAKBN.IS": "Vakıfbank",
    "SISE.IS": "Şişe Cam",
    "EREGL.IS": "Ereğli Demir Çelik",
    "KCHOL.IS": "Koç Holding",
    "SAHOL.IS": "Sabancı Holding",
    "TUPRS.IS": "Tüpraş",
    "ASELS.IS": "Aselsan",
    "BIMAS.IS": "BİM Mağazalar",
    "FROTO.IS": "Ford Otosan",
    "TOASO.IS": "Tofaş",
    "ARCLK.IS": "Arçelik",
    "VESTL.IS": "Vestel",
    "TCELL.IS": "Turkcell",
    "TTKOM.IS": "Türk Telekom",
    "PGSUS.IS": "Pegasus",
    "TAVHL.IS": "TAV Havalimanları",
    "MGROS.IS": "Migros",
    "SOKM.IS": "Şok Market",
    "ULKER.IS": "Ülker",
    "PETKM.IS": "Petkim",
    "SASA.IS": "Sasa Polyester",
    "KOZAL.IS": "Koza Altın",
    "EKGYO.IS": "Emlak Konut GYO",
    "ENKAI.IS": "Enka İnşaat",
    "DOHOL.IS": "Doğan Holding",
    "TKFEN.IS": "Tekfen Holding",
    "KORDS.IS": "Kordsa",
    "CCOLA.IS": "Coca Cola İçecek",
    "AYGAZ.IS": "Aygaz",
    "GUBRF.IS": "Gübre Fabrikaları",
    "HEKTS.IS": "Hektaş",
    "LOGO.IS": "Logo Yazılım",
    "NETAS.IS": "Netaş",
    "OTKAR.IS": "Otokar",
    "TMSN.IS": "Temsan",
    "MAVI.IS": "Mavi Giyim",
    "KOTON.IS": "Koton",
    "DOAS.IS": "Doğuş Otomotiv",
    "TTRAK.IS": "Türk Traktör",
    "CIMSA.IS": "Çimsa",
    "BRISA.IS": "Brisa",
    "BJKAS.IS": "Beşiktaş",
    "GSRAY.IS": "Galatasaray",
    "FENER.IS": "Fenerbahçe",
    "TSPOR.IS": "Trabzonspor",
    "AEFES.IS": "Anadolu Efes",
    "AKSA.IS": "Aksa Akrilik",
    "ALARK.IS": "Alarko Holding",
    "ALGYO.IS": "Alarko GYO",
    "ANSGR.IS": "Anadolu Sigorta",
    "AGHOL.IS": "Anadolu Grubu Holding",
    "BANVT.IS": "Banvit",
    "BERA.IS": "Bera Holding",
    "DEVA.IS": "Deva Holding",
    "EGEEN.IS": "Ege Endüstri",
    "ENJSA.IS": "Enerjisa",
    "ISGYO.IS": "İş GYO",
    "KARSN.IS": "Karsan",
    "KLMSN.IS": "Klimasan",
    "KONTR.IS": "Kontrolmatik",
    "MPARK.IS": "MLP Sağlık",
    "NTHOL.IS": "Net Holding",
    "ODAS.IS": "Odaş Elektrik",
    "OYAKC.IS": "Oyak Çimento",
    "PETUN.IS": "Pınar Et",
    "PNSUT.IS": "Pınar Süt",
    "SUNTK.IS": "Suntek",
    "TSKB.IS": "TSKB",
    "ZOREN.IS": "Zorlu Enerji",
    # ABD Popüler
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Google/Alphabet",
    "GOOG": "Google Class C",
    "AMZN": "Amazon",
    "META": "Meta/Facebook",
    "TSLA": "Tesla",
    "NVDA": "NVIDIA",
    "AMD": "AMD",
    "INTC": "Intel",
    "NFLX": "Netflix",
    "DIS": "Disney",
    "PYPL": "PayPal",
    "V": "Visa",
    "MA": "Mastercard",
    "JPM": "JPMorgan Chase",
    "BAC": "Bank of America",
    "WFC": "Wells Fargo",
    "GS": "Goldman Sachs",
    "MS": "Morgan Stanley",
    "BA": "Boeing",
    "GE": "General Electric",
    "F": "Ford",
    "GM": "General Motors",
    "UBER": "Uber",
    "LYFT": "Lyft",
    "ABNB": "Airbnb",
    "COIN": "Coinbase",
    "SQ": "Block/Square",
    "SHOP": "Shopify",
    "SNAP": "Snapchat",
    "PINS": "Pinterest",
    "ZM": "Zoom",
    "CRWD": "CrowdStrike",
    "PLTR": "Palantir",
    "RBLX": "Roblox",
    "U": "Unity",
    "SNOW": "Snowflake",
    "MDB": "MongoDB",
    "NET": "Cloudflare",
    "DDOG": "Datadog",
    "KO": "Coca Cola",
    "PEP": "PepsiCo",
    "MCD": "McDonald's",
    "SBUX": "Starbucks",
    "WMT": "Walmart",
    "TGT": "Target",
    "COST": "Costco",
    "HD": "Home Depot",
    "NKE": "Nike",
    "JNJ": "Johnson & Johnson",
    "PFE": "Pfizer",
    "MRNA": "Moderna",
    "XOM": "Exxon Mobil",
    "CVX": "Chevron",
    "CRM": "Salesforce",
    "ORCL": "Oracle",
    "IBM": "IBM",
    "CSCO": "Cisco",
    "ADBE": "Adobe",
    "INTU": "Intuit",
    "NOW": "ServiceNow",
    "PANW": "Palo Alto Networks",
    "ZS": "Zscaler",
    "OKTA": "Okta",
    "DOCU": "DocuSign",
    "TEAM": "Atlassian",
    "WDAY": "Workday",
    "SPLK": "Splunk",
    "RIVN": "Rivian",
    "LCID": "Lucid Motors",
    "NIO": "NIO",
    "XPEV": "XPeng",
    "LI": "Li Auto",
    # Kripto
    "BTC-USD": "Bitcoin",
    "ETH-USD": "Ethereum",
    "BNB-USD": "Binance Coin",
    "SOL-USD": "Solana",
    "XRP-USD": "Ripple",
    "ADA-USD": "Cardano",
    "DOGE-USD": "Dogecoin",
    "DOT-USD": "Polkadot",
    "AVAX-USD": "Avalanche",
    "MATIC-USD": "Polygon",
    "LINK-USD": "Chainlink",
    "UNI-USD": "Uniswap",
    "ATOM-USD": "Cosmos",
    "LTC-USD": "Litecoin",
    "XLM-USD": "Stellar",
    "ALGO-USD": "Algorand",
    "VET-USD": "VeChain",
    "FIL-USD": "Filecoin",
    "AAVE-USD": "Aave",
    "SAND-USD": "The Sandbox",
    "MANA-USD": "Decentraland",
    "APE-USD": "ApeCoin",
    "SHIB-USD": "Shiba Inu",
    "TRX-USD": "Tron",
    "NEAR-USD": "NEAR Protocol",
    "FTM-USD": "Fantom",
    "THETA-USD": "Theta",
    "XTZ-USD": "Tezos",
    "EOS-USD": "EOS",
    "CAKE-USD": "PancakeSwap",
    "CRV-USD": "Curve",
    "SUSHI-USD": "SushiSwap",
    "COMP-USD": "Compound",
    "MKR-USD": "Maker",
    "SNX-USD": "Synthetix",
    "YFI-USD": "Yearn Finance",
    "PEPE-USD": "Pepe",
    "FLOKI-USD": "Floki",
    "BONK-USD": "Bonk",
    "WIF-USD": "Dogwifhat",
    "TON-USD": "Toncoin",
    "SUI-USD": "Sui",
    "SEI-USD": "Sei",
    "APT-USD": "Aptos",
    "ARB-USD": "Arbitrum",
    "OP-USD": "Optimism",
    "INJ-USD": "Injective",
    "TIA-USD": "Celestia",
    "RUNE-USD": "THORChain",
    "IMX-USD": "Immutable X",
    "RNDR-USD": "Render",
    "FET-USD": "Fetch.ai",
    "GRT-USD": "The Graph",
    "HBAR-USD": "Hedera",
    "STX-USD": "Stacks",
    "KAS-USD": "Kaspa",
    "TAO-USD": "Bittensor",
}


def get_all_symbols_with_names():
    """Tüm sembolleri isimlerle birlikte döndürür - cache ile"""
    all_symbols = []
    for market, symbols in DEFAULT_SYMBOLS.items():
        for symbol in symbols:
            name = SYMBOL_NAMES.get(symbol, "")
            display = f"{symbol} - {name}" if name else symbol
            all_symbols.append((symbol, display, market, name))
    return all_symbols


# Global cache
_ALL_SYMBOLS_CACHE = None


def get_cached_symbols():
    """Cache'li sembol listesi"""
    global _ALL_SYMBOLS_CACHE
    if _ALL_SYMBOLS_CACHE is None:
        _ALL_SYMBOLS_CACHE = get_all_symbols_with_names()
    return _ALL_SYMBOLS_CACHE


def search_symbols(query: str, limit: int = 15):
    """Akıllı arama - her harfe basıldığında çalışır"""
    if not query:
        return []

    query = query.upper().strip()
    all_symbols = get_cached_symbols()

    # Skorlama sistemi
    scored_results = []

    for symbol, display, market, name in all_symbols:
        name_upper = name.upper()
        score = 0

        # Tam eşleşme - en yüksek skor
        if query == symbol:
            score = 1000
        elif query == name_upper:
            score = 900
        # Başlangıç eşleşmesi - yüksek skor
        elif symbol.startswith(query):
            score = 800 + (100 - len(symbol))  # Kısa semboller önce
        elif name_upper.startswith(query):
            score = 700 + (100 - len(name))
        # Kelime başlangıcı eşleşmesi
        elif any(word.startswith(query) for word in name_upper.split()):
            score = 600
        # İçerik eşleşmesi
        elif query in symbol:
            score = 500 + (100 - symbol.index(query))
        elif query in name_upper:
            score = 400 + (100 - name_upper.index(query))

        if score > 0:
            scored_results.append((symbol, display, market, score))

    # Skora göre sırala
    scored_results.sort(key=lambda x: -x[3])

    return [(s, d, m) for s, d, m, _ in scored_results[:limit]]


def render_sidebar():
    """Ana sidebar'ı render eder"""
    with st.sidebar:
        st.title("📈 Borsa Takip")
        st.divider()

        # Sayfa seçimi
        page = st.radio(
            "Sayfa",
            ["Piyasa", "Teknik Analiz", "Portföy", "Watchlist"],
            label_visibility="collapsed"
        )

        st.divider()

        return page


def render_symbol_selector(key: str = "symbol") -> str:
    """Gelişmiş sembol seçici - anlık arama"""

    # Arama kutusu
    search_query = st.text_input(
        "🔍 Hisse/Kripto Ara",
        placeholder="Yazın: thy, apple, btc...",
        key=f"{key}_search",
        help="Sembol veya şirket adı yazın"
    )

    # Her karakter girildiğinde arama yap
    if search_query and len(search_query) >= 1:
        results = search_symbols(search_query)

        if results:
            # Sonuçları göster
            st.caption(f"📋 {len(results)} sonuç bulundu")

            # Seçim için options
            options = [f"{display} [{market}]" for _, display, market in results]

            selected_idx = st.selectbox(
                "Seçin",
                range(len(options)),
                format_func=lambda i: options[i],
                key=f"{key}_results",
                label_visibility="collapsed"
            )

            if selected_idx is not None:
                symbol, display, market = results[selected_idx]
                # Seçilen sembol bilgisi
                col1, col2 = st.columns(2)
                with col1:
                    st.success(f"✓ {symbol}")
                with col2:
                    st.info(f"📍 {market}")
                return symbol

        else:
            st.warning("❌ Sonuç bulunamadı")
            st.caption("Manuel sembol girebilirsiniz")
            return search_query.upper()

    # Arama yoksa veya 1 karakterden azsa - popüler seçenekler
    st.divider()
    st.caption("veya popüler seçeneklerden seçin:")

    col1, col2 = st.columns([1, 2])

    with col1:
        market = st.selectbox(
            "Piyasa",
            list(DEFAULT_SYMBOLS.keys()),
            key=f"{key}_market"
        )

    with col2:
        symbols = DEFAULT_SYMBOLS[market]
        display_symbols = symbols[:30]  # İlk 30

        # İsimlerle göster
        options = []
        for s in display_symbols:
            name = SYMBOL_NAMES.get(s, "")
            options.append(f"{s} - {name}" if name else s)

        selected = st.selectbox(
            "Sembol",
            options,
            key=f"{key}_symbol"
        )

        symbol = selected.split(" - ")[0] if " - " in selected else selected

    return symbol


def render_period_selector(key: str = "period") -> tuple:
    """Dönem ve aralık seçici"""
    col1, col2 = st.columns(2)

    with col1:
        period_label = st.selectbox(
            "Dönem",
            list(PERIODS.keys()),
            index=5,  # 1 Yıl varsayılan
            key=f"{key}_period"
        )
        period = PERIODS[period_label]

    with col2:
        interval_label = st.selectbox(
            "Aralık",
            list(INTERVALS.keys()),
            index=4,  # 1 Gün varsayılan
            key=f"{key}_interval"
        )
        interval = INTERVALS[interval_label]

    return period, interval


def render_indicator_selector(key: str = "indicators") -> dict:
    """Gösterge seçici"""
    st.subheader("Göstergeler")

    indicators = {}

    indicators['sma'] = st.multiselect(
        "SMA",
        [20, 50, 100, 200],
        default=[20, 50],
        key=f"{key}_sma"
    )

    indicators['ema'] = st.multiselect(
        "EMA",
        [12, 26, 50],
        default=[],
        key=f"{key}_ema"
    )

    indicators['bollinger'] = st.checkbox("Bollinger Bantları", value=False, key=f"{key}_bb")
    indicators['rsi'] = st.checkbox("RSI", value=True, key=f"{key}_rsi")
    indicators['macd'] = st.checkbox("MACD", value=True, key=f"{key}_macd")

    return indicators
