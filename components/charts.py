"""Grafik bileşenleri - Plotly (Gelişmiş interaktif özellikler)"""

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Optional

# Grafik konfigürasyonu - tüm grafiklerde kullanılacak
CHART_CONFIG = {
    'displayModeBar': True,
    'displaylogo': False,
    'modeBarButtonsToAdd': [
        'drawline',
        'drawopenpath',
        'drawcircle',
        'drawrect',
        'eraseshape'
    ],
    'modeBarButtonsToRemove': ['lasso2d'],
    'scrollZoom': True,  # Mouse scroll ile zoom
    'doubleClick': 'reset',  # Çift tık ile reset
    'showTips': True,
    'responsive': True
}


def _add_nizami_cedid_traces(fig: go.Figure, df: pd.DataFrame, row: int = 3) -> None:
    """NizamiCedid indikatör trace'lerini subplot'a ekler (internal)"""
    # Parametreler
    fast_length = 120
    slow_length = 260
    signal_length = 50
    vwma_length = 185
    ema377_length = 610
    ema89_length = 377

    # EMA hesaplamaları
    close = df['Close']
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

    # EMA 377 ve 610
    ema377 = close.ewm(span=ema377_length, adjust=False).mean()
    ema89 = close.ewm(span=ema89_length, adjust=False).mean()

    # Normalize
    hist_norm = hist / fast_ma
    macd_norm = macd / fast_ma
    signal_norm = signal / fast_ma
    eMacD_norm = eMacD / fast_ma
    deltaMACEMAC = macd - eMacD
    deltaMACEMAC_norm = deltaMACEMAC / fast_ma

    # Histogram renkleri (vektörize - hızlı)
    hist_diff = hist_norm.diff()
    hist_colors = pd.Series('#787B86', index=hist_norm.index)
    hist_colors[(hist_norm >= 0) & (hist_diff > 0)] = '#26A69A'  # Yeşil yükseliş
    hist_colors[(hist_norm >= 0) & (hist_diff <= 0)] = '#B2DFDB'  # Açık yeşil
    hist_colors[(hist_norm < 0) & (hist_diff > 0)] = '#FFCDD2'   # Açık kırmızı
    hist_colors[(hist_norm < 0) & (hist_diff <= 0)] = '#FF5252'  # Kırmızı düşüş

    fig.add_trace(
        go.Bar(x=df.index, y=hist_norm, name='Histogram', marker_color=hist_colors.tolist(),
               hovertemplate='Histogram: %{y:.6f}<extra></extra>', showlegend=False),
        row=row, col=1
    )

    # deltaMACEMAC
    fig.add_trace(
        go.Scatter(x=df.index, y=deltaMACEMAC_norm, mode='lines', name='deltaMACEMAC',
                   fill='tozeroy', fillcolor='rgba(83, 76, 175, 0.47)',
                   line=dict(color='rgba(83, 76, 175, 0.47)', width=1),
                   hovertemplate='Delta: %{y:.6f}<extra></extra>', showlegend=False),
        row=row, col=1
    )

    # MACD çizgisi
    fig.add_trace(
        go.Scatter(x=df.index, y=macd_norm, mode='lines', name='MACD',
                   line=dict(color='rgb(255, 0, 166)', width=2),
                   hovertemplate='MACD: %{y:.6f}<extra></extra>', showlegend=False),
        row=row, col=1
    )

    # Signal çizgisi
    fig.add_trace(
        go.Scatter(x=df.index, y=signal_norm, mode='lines', name='Signal',
                   line=dict(color='#FF6D00', width=2),
                   hovertemplate='Signal: %{y:.6f}<extra></extra>', showlegend=False),
        row=row, col=1
    )

    # eMacD çizgisi
    fig.add_trace(
        go.Scatter(x=df.index, y=eMacD_norm, mode='lines', name='eMacD',
                   line=dict(color='white', width=3),
                   hovertemplate='eMacD: %{y:.6f}<extra></extra>', showlegend=False),
        row=row, col=1
    )

    # Sıfır çizgisi
    fig.add_hline(y=0, line_dash="solid", line_color="#787B86", line_width=1, opacity=0.5, row=row, col=1)


def create_candlestick_chart(df: pd.DataFrame, title: str = "Fiyat Grafiği",
                             show_volume: bool = True, show_rangeslider: bool = True,
                             initial_range_months: int = 12, show_nizami_cedid: bool = False) -> go.Figure:
    """Gelişmiş mum grafiği - zoom, pan, crosshair destekli"""
    if show_nizami_cedid:
        # Fiyat + Hacim + NizamiCedid (3 satır, senkronize x ekseni)
        fig = make_subplots(
            rows=3, cols=1,
            shared_xaxes=True,
            vertical_spacing=0.02,
            row_heights=[0.50, 0.15, 0.35],
            subplot_titles=(title, 'Hacim', 'NizamiCedid (3. Selim)')
        )
    elif show_volume:
        fig = make_subplots(
            rows=2, cols=1,
            shared_xaxes=True,
            vertical_spacing=0.03,
            row_heights=[0.7, 0.3]
        )
    else:
        fig = go.Figure()

    # Mum grafiği
    candlestick = go.Candlestick(
        x=df.index,
        open=df['Open'],
        high=df['High'],
        low=df['Low'],
        close=df['Close'],
        name='Fiyat',
        increasing_line_color='#26a69a',
        decreasing_line_color='#ef5350',
        increasing_fillcolor='#26a69a',
        decreasing_fillcolor='#ef5350'
    )

    if show_volume or show_nizami_cedid:
        fig.add_trace(candlestick, row=1, col=1)

        # Hacim çubukları
        colors = ['#26a69a' if close >= open_ else '#ef5350'
                  for close, open_ in zip(df['Close'], df['Open'])]

        fig.add_trace(
            go.Bar(x=df.index, y=df['Volume'], name='Hacim', marker_color=colors, opacity=0.7),
            row=2, col=1
        )

        # NizamiCedid indikatörünü ekle (3. satır)
        if show_nizami_cedid:
            _add_nizami_cedid_traces(fig, df, row=3)
    else:
        fig.add_trace(candlestick)

    # Gelişmiş layout ayarları
    fig.update_layout(
        title=dict(
            text=title,
            x=0.5,
            xanchor='center',
            font=dict(size=16)
        ),
        template='plotly_dark',
        height=700,
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            bgcolor='rgba(0,0,0,0.5)'
        ),
        # Drag modu - zoom varsayılan
        dragmode='zoom',
        # Hover ayarları
        hovermode='x unified',
        hoverlabel=dict(
            bgcolor='rgba(0,0,0,0.8)',
            font_size=12,
            font_family="monospace"
        ),
        # Margin
        margin=dict(l=50, r=50, t=80, b=50),
    )

    # X ekseni ayarları
    fig.update_xaxes(
        showgrid=True,
        gridwidth=1,
        gridcolor='rgba(128, 128, 128, 0.2)',
        showspikes=True,  # Crosshair çizgisi
        spikecolor='rgba(255, 255, 255, 0.5)',
        spikesnap='cursor',
        spikemode='across',
        spikethickness=1,
        spikedash='dot',
        # Range slider
        rangeslider=dict(
            visible=show_rangeslider,
            thickness=0.05,
            bgcolor='rgba(128, 128, 128, 0.2)'
        ),
        # Range selector butonları
        rangeselector=dict(
            buttons=list([
                dict(count=7, label="1H", step="day", stepmode="backward"),
                dict(count=1, label="1A", step="month", stepmode="backward"),
                dict(count=3, label="3A", step="month", stepmode="backward"),
                dict(count=6, label="6A", step="month", stepmode="backward"),
                dict(count=1, label="1Y", step="year", stepmode="backward"),
                dict(count=2, label="2Y", step="year", stepmode="backward"),
                dict(count=5, label="5Y", step="year", stepmode="backward"),
                dict(count=10, label="10Y", step="year", stepmode="backward"),
                dict(count=20, label="20Y", step="year", stepmode="backward"),
                dict(label="MAX", step="all")
            ]),
            bgcolor='rgba(50, 50, 50, 0.8)',
            activecolor='#26a69a',
            font=dict(color='white', size=11),
            x=0,
            y=1.15
        ),
        row=1, col=1
    )

    # Varsayılan görünüm aralığı ayarla (son X ay)
    if len(df) > 0 and initial_range_months > 0:
        end_date = df.index[-1]
        start_date = end_date - timedelta(days=initial_range_months * 30)
        # Veri başlangıcından önceye gitme
        if start_date < df.index[0]:
            start_date = df.index[0]
        fig.update_xaxes(range=[start_date, end_date], row=1, col=1)

    # Y ekseni ayarları
    fig.update_yaxes(
        showgrid=True,
        gridwidth=1,
        gridcolor='rgba(128, 128, 128, 0.2)',
        showspikes=True,  # Crosshair çizgisi
        spikecolor='rgba(255, 255, 255, 0.5)',
        spikesnap='cursor',
        spikemode='across',
        spikethickness=1,
        spikedash='dot',
        side='right',
        # Fiyat format
        tickformat='.2f',
        row=1, col=1
    )

    # Hacim ekseni
    if show_volume or show_nizami_cedid:
        fig.update_yaxes(
            showgrid=False,
            side='right',
            row=2, col=1
        )
        fig.update_xaxes(
            rangeslider=dict(visible=False),
            row=2, col=1
        )

    # NizamiCedid ekseni ayarları
    if show_nizami_cedid:
        fig.update_yaxes(
            showgrid=True,
            gridwidth=1,
            gridcolor='rgba(128, 128, 128, 0.2)',
            showspikes=True,
            spikecolor='rgba(255, 255, 255, 0.5)',
            spikesnap='cursor',
            spikemode='across',
            spikethickness=1,
            spikedash='dot',
            side='right',
            tickformat='.4f',
            row=3, col=1
        )
        fig.update_xaxes(
            showgrid=True,
            gridwidth=1,
            gridcolor='rgba(128, 128, 128, 0.2)',
            showspikes=True,
            spikecolor='rgba(255, 255, 255, 0.5)',
            spikesnap='cursor',
            spikemode='across',
            spikethickness=1,
            spikedash='dot',
            rangeslider=dict(visible=False),
            row=3, col=1
        )
        # Yüksekliği artır
        fig.update_layout(height=900)

    return fig


def add_sma_to_chart(fig: go.Figure, df: pd.DataFrame, periods: List[int] = [20, 50, 200],
                     row: int = 1, col: int = 1) -> go.Figure:
    """SMA çizgilerini grafiğe ekler"""
    colors = ['#ffa726', '#42a5f5', '#ab47bc', '#66bb6a', '#ef5350']

    for i, period in enumerate(periods):
        col_name = f'SMA_{period}'
        if col_name in df.columns:
            fig.add_trace(
                go.Scatter(
                    x=df.index,
                    y=df[col_name],
                    mode='lines',
                    name=f'SMA {period}',
                    line=dict(color=colors[i % len(colors)], width=1.5),
                    hovertemplate=f'SMA {period}: %{{y:.2f}}<extra></extra>'
                ),
                row=row, col=col
            )

    return fig


def add_bollinger_to_chart(fig: go.Figure, df: pd.DataFrame,
                           row: int = 1, col: int = 1) -> go.Figure:
    """Bollinger bantlarını grafiğe ekler"""
    if 'BB_Upper' not in df.columns:
        return fig

    fig.add_trace(
        go.Scatter(
            x=df.index, y=df['BB_Upper'],
            mode='lines', name='BB Üst',
            line=dict(color='rgba(173, 216, 230, 0.7)', width=1),
            hovertemplate='BB Üst: %{y:.2f}<extra></extra>'
        ),
        row=row, col=col
    )

    fig.add_trace(
        go.Scatter(
            x=df.index, y=df['BB_Lower'],
            mode='lines', name='BB Alt',
            line=dict(color='rgba(173, 216, 230, 0.7)', width=1),
            fill='tonexty',
            fillcolor='rgba(173, 216, 230, 0.1)',
            hovertemplate='BB Alt: %{y:.2f}<extra></extra>'
        ),
        row=row, col=col
    )

    return fig


def create_rsi_chart(df: pd.DataFrame) -> go.Figure:
    """RSI grafiği - interaktif"""
    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=df.index, y=df['RSI'],
            mode='lines', name='RSI',
            line=dict(color='#ab47bc', width=2),
            hovertemplate='RSI: %{y:.2f}<extra></extra>'
        )
    )

    # Aşırı alım/satım bölgeleri
    fig.add_hrect(y0=70, y1=100, fillcolor="red", opacity=0.1, line_width=0)
    fig.add_hrect(y0=0, y1=30, fillcolor="green", opacity=0.1, line_width=0)

    # Aşırı alım/satım çizgileri
    fig.add_hline(y=70, line_dash="dash", line_color="red", annotation_text="Aşırı Alım (70)")
    fig.add_hline(y=30, line_dash="dash", line_color="green", annotation_text="Aşırı Satım (30)")
    fig.add_hline(y=50, line_dash="dot", line_color="gray")

    fig.update_layout(
        title='RSI (14)',
        template='plotly_dark',
        height=250,
        yaxis=dict(range=[0, 100], side='right'),
        hovermode='x unified',
        dragmode='zoom',
        margin=dict(l=50, r=50, t=40, b=30)
    )

    fig.update_xaxes(showspikes=True, spikemode='across', spikethickness=1)
    fig.update_yaxes(showspikes=True, spikemode='across', spikethickness=1)

    return fig


def create_macd_chart(df: pd.DataFrame) -> go.Figure:
    """MACD grafiği - interaktif"""
    fig = go.Figure()

    # MACD çizgisi
    fig.add_trace(
        go.Scatter(
            x=df.index, y=df['MACD'],
            mode='lines', name='MACD',
            line=dict(color='#42a5f5', width=2),
            hovertemplate='MACD: %{y:.4f}<extra></extra>'
        )
    )

    # Sinyal çizgisi
    fig.add_trace(
        go.Scatter(
            x=df.index, y=df['MACD_Signal'],
            mode='lines', name='Sinyal',
            line=dict(color='#ffa726', width=2),
            hovertemplate='Sinyal: %{y:.4f}<extra></extra>'
        )
    )

    # Histogram
    colors = ['#26a69a' if val >= 0 else '#ef5350' for val in df['MACD_Histogram']]
    fig.add_trace(
        go.Bar(
            x=df.index, y=df['MACD_Histogram'],
            name='Histogram',
            marker_color=colors,
            opacity=0.7,
            hovertemplate='Histogram: %{y:.4f}<extra></extra>'
        )
    )

    # Sıfır çizgisi
    fig.add_hline(y=0, line_dash="solid", line_color="gray", line_width=1)

    fig.update_layout(
        title='MACD (12, 26, 9)',
        template='plotly_dark',
        height=250,
        hovermode='x unified',
        dragmode='zoom',
        yaxis=dict(side='right'),
        margin=dict(l=50, r=50, t=40, b=30)
    )

    fig.update_xaxes(showspikes=True, spikemode='across', spikethickness=1)
    fig.update_yaxes(showspikes=True, spikemode='across', spikethickness=1)

    return fig


def create_nizami_cedid_chart(df: pd.DataFrame) -> go.Figure:
    """NizamiCedid (3. Selim) indikatörü - Pine Script'ten çevrildi"""
    fig = go.Figure()

    # Parametreler
    fast_length = 120
    slow_length = 260
    signal_length = 50
    vwma_length = 185
    ema377_length = 610
    ema89_length = 377

    # EMA hesaplamaları
    close = df['Close']
    fast_ma = close.ewm(span=fast_length, adjust=False).mean()
    slow_ma = close.ewm(span=slow_length, adjust=False).mean()
    macd = fast_ma - slow_ma
    signal = macd.ewm(span=signal_length, adjust=False).mean()
    hist = macd - signal

    # VWMA hesaplama (Volume Weighted Moving Average)
    if 'Volume' in df.columns and df['Volume'].sum() > 0:
        volume = df['Volume']
        eMacD = (macd * volume).rolling(window=vwma_length).sum() / volume.rolling(window=vwma_length).sum()
    else:
        eMacD = macd.rolling(window=vwma_length).mean()

    # EMA 377 ve 610
    ema377 = close.ewm(span=ema377_length, adjust=False).mean()
    ema89 = close.ewm(span=ema89_length, adjust=False).mean()

    # Normalize (fast_ma'ya böl)
    hist_norm = hist / fast_ma
    macd_norm = macd / fast_ma
    signal_norm = signal / fast_ma
    eMacD_norm = eMacD / fast_ma
    deltaMACEMAC = macd - eMacD
    deltaMACEMAC_norm = deltaMACEMAC / fast_ma

    hist_diff = hist_norm.diff()
    hist_colors = pd.Series('#787B86', index=hist_norm.index)
    hist_colors[(hist_norm >= 0) & (hist_diff > 0)] = '#26A69A'
    hist_colors[(hist_norm >= 0) & (hist_diff <= 0)] = '#B2DFDB'
    hist_colors[(hist_norm < 0) & (hist_diff > 0)] = '#FFCDD2'
    hist_colors[(hist_norm < 0) & (hist_diff <= 0)] = '#FF5252'

    fig.add_trace(
        go.Bar(
            x=df.index, y=hist_norm,
            name='Histogram',
            marker_color=hist_colors.tolist(),
            hovertemplate='Histogram: %{y:.6f}<extra></extra>'
        )
    )

    # deltaMACEMAC (area plot)
    fig.add_trace(
        go.Scatter(
            x=df.index, y=deltaMACEMAC_norm,
            mode='lines', name='deltaMACEMAC',
            fill='tozeroy',
            fillcolor='rgba(83, 76, 175, 0.47)',
            line=dict(color='rgba(83, 76, 175, 0.47)', width=1),
            hovertemplate='Delta: %{y:.6f}<extra></extra>'
        )
    )

    # MACD çizgisi (pembe)
    fig.add_trace(
        go.Scatter(
            x=df.index, y=macd_norm,
            mode='lines', name='MACD',
            line=dict(color='rgb(255, 0, 166)', width=2),
            hovertemplate='MACD: %{y:.6f}<extra></extra>'
        )
    )

    # Signal çizgisi (turuncu)
    fig.add_trace(
        go.Scatter(
            x=df.index, y=signal_norm,
            mode='lines', name='Signal',
            line=dict(color='#FF6D00', width=2),
            hovertemplate='Signal: %{y:.6f}<extra></extra>'
        )
    )

    # eMacD çizgisi (siyah, kalın)
    fig.add_trace(
        go.Scatter(
            x=df.index, y=eMacD_norm,
            mode='lines', name='eMacD',
            line=dict(color='white', width=3),  # Karanlık temada beyaz
            hovertemplate='eMacD: %{y:.6f}<extra></extra>'
        )
    )

    # Sıfır çizgisi
    fig.add_hline(y=0, line_dash="solid", line_color="#787B86", line_width=1, opacity=0.5)

    fig.update_layout(
        title='NizamiCedid (3. Selim) - EMA 120/260/50',
        template='plotly_dark',
        height=300,
        hovermode='x unified',
        dragmode='zoom',
        yaxis=dict(side='right', tickformat='.4f'),
        margin=dict(l=50, r=50, t=40, b=30),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )

    fig.update_xaxes(showspikes=True, spikemode='across', spikethickness=1)
    fig.update_yaxes(showspikes=True, spikemode='across', spikethickness=1)

    return fig


def create_line_chart(df: pd.DataFrame, column: str = 'Close', title: str = "Fiyat") -> go.Figure:
    """Basit çizgi grafiği - interaktif"""
    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=df.index, y=df[column],
            mode='lines',
            name=column,
            line=dict(color='#42a5f5', width=2),
            fill='tozeroy',
            fillcolor='rgba(66, 165, 245, 0.1)',
            hovertemplate='%{y:.2f}<extra></extra>'
        )
    )

    fig.update_layout(
        title=title,
        template='plotly_dark',
        height=400,
        hovermode='x unified',
        dragmode='zoom'
    )

    fig.update_xaxes(
        showspikes=True,
        spikemode='across',
        rangeslider=dict(visible=True, thickness=0.05)
    )
    fig.update_yaxes(showspikes=True, spikemode='across', side='right')

    return fig


def create_portfolio_pie_chart(holdings: List[dict]) -> go.Figure:
    """Portföy dağılım pasta grafiği"""
    labels = [h['symbol'] for h in holdings]
    values = [h['value'] for h in holdings]

    fig = go.Figure(data=[
        go.Pie(
            labels=labels,
            values=values,
            hole=0.4,
            textinfo='label+percent',
            textposition='outside',
            marker=dict(
                colors=['#26a69a', '#42a5f5', '#ffa726', '#ab47bc', '#ef5350',
                        '#66bb6a', '#29b6f6', '#ffca28', '#8e24aa', '#f44336']
            ),
            hovertemplate='%{label}<br>Değer: %{value:,.2f}<br>Oran: %{percent}<extra></extra>'
        )
    ])

    fig.update_layout(
        title='Portföy Dağılımı',
        template='plotly_dark',
        height=400
    )

    return fig


def create_comparison_chart(data: dict, title: str = "Karşılaştırma") -> go.Figure:
    """Birden fazla sembolü karşılaştırma grafiği - interaktif"""
    fig = go.Figure()

    colors = ['#26a69a', '#42a5f5', '#ffa726', '#ab47bc', '#ef5350',
              '#66bb6a', '#29b6f6', '#ffca28', '#8e24aa', '#f44336']

    for i, (symbol, df) in enumerate(data.items()):
        # Normalize et (ilk değere göre yüzde)
        normalized = (df['Close'] / df['Close'].iloc[0] - 1) * 100

        fig.add_trace(
            go.Scatter(
                x=df.index, y=normalized,
                mode='lines', name=symbol,
                line=dict(width=2, color=colors[i % len(colors)]),
                hovertemplate=f'{symbol}: %{{y:.2f}}%<extra></extra>'
            )
        )

    # Sıfır çizgisi
    fig.add_hline(y=0, line_dash="solid", line_color="gray", line_width=1)

    fig.update_layout(
        title=title,
        yaxis_title='Değişim (%)',
        template='plotly_dark',
        height=500,
        hovermode='x unified',
        dragmode='zoom',
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )

    fig.update_xaxes(
        showspikes=True,
        spikemode='across',
        rangeslider=dict(visible=True, thickness=0.05)
    )
    fig.update_yaxes(showspikes=True, spikemode='across', side='right')

    return fig


def get_chart_config():
    """Grafik konfigürasyonunu döndürür - st.plotly_chart ile kullanılır"""
    return CHART_CONFIG
