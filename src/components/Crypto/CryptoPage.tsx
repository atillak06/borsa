import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import type { ActiveView, LegendData } from '../Chart/types';
import type { CryptoInterval, CryptoTicker } from '../../api/cryptoApi';
import { POPULAR_PAIRS, cryptoIntervalToChartInterval } from '../../api/cryptoApi';
import { useCryptoHistory } from '../../hooks/useCryptoHistory';
import { useCryptoTickers } from '../../hooks/useCryptoTickers';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useAlarms } from '../../hooks/useAlarms';
import ChartContainer from '../Chart/ChartContainer';
import Legend from '../Legend/Legend';
import StockSummary from '../StockSummary/StockSummary';
import AlarmPanel from '../Alarms/AlarmPanel';
import SignalPanel from '../SignalPanel/SignalPanel';
import ErrorBoundary from '../ErrorBoundary/ErrorBoundary';
import CryptoToolbar from './CryptoToolbar';
import CryptoTickerBar from './CryptoTickerBar';
import './CryptoPage.css';

const TICKER_SYMBOLS = POPULAR_PAIRS.map((p) => p.symbol);

interface CryptoPageProps {
  onViewChange: (view: ActiveView) => void;
}

export default function CryptoPage({ onViewChange }: CryptoPageProps) {
  const {
    showBollinger,
    showRSI,
    showMACD,
    showStochRSI,
    showSuperTrend,
    showIchimoku,
    showOBV,
    showSignals,
    logScale,
    signalConfig,
    signalDateRange,
    toggle,
    setSignalConfig,
    setSignalDateRange,
  } = useAppContext();

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState<CryptoInterval>('1h');
  const [legendData, setLegendData] = useState<LegendData | null>(null);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [alarmsOpen, setAlarmsOpen] = useState(false);
  const [sigHeight, setSigHeight] = useState(300);
  const sigSplitterRef = useRef<HTMLDivElement>(null);

  // Data hooks
  const { data, loading } = useCryptoHistory(symbol, interval);
  const { tickers, loading: tickersLoading } = useCryptoTickers(TICKER_SYMBOLS);

  // Watchlist & Alarms (separate storage from borsa)
  const { watchlist, toggleSymbol, removeSymbol, isWatched } = useWatchlist('borsa_crypto_watchlist');
  const { alarms, addAlarm, removeAlarm, updateAlarm, resetTriggered, uniqueActiveSymbols } =
    useAlarms('borsa_crypto_alarms');

  const chartInterval = cryptoIntervalToChartInterval(interval);

  // Signal splitter drag
  useEffect(() => {
    if (!showSignals) return;
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = sigHeight;
      const onMove = (ev: MouseEvent) => {
        const diff = startY - ev.clientY;
        setSigHeight(Math.max(120, Math.min(window.innerHeight - 200, startH + diff)));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    const splitter = sigSplitterRef.current;
    splitter?.addEventListener('mousedown', onMouseDown);
    return () => splitter?.removeEventListener('mousedown', onMouseDown);
  }, [showSignals, sigHeight]);

  const handleLegendUpdate = useCallback((d: LegendData | null) => {
    setLegendData(d);
  }, []);

  const handleTickerClick = useCallback((sym: string) => {
    setSymbol(sym);
  }, []);

  const handleWatchlistClick = useCallback((sym: string) => {
    setSymbol(sym);
  }, []);

  const lastBar = data.length > 0 ? data[data.length - 1] : null;
  const prevBar = data.length > 1 ? data[data.length - 2] : null;

  // Find ticker data for watchlist items
  const tickerMap = new Map<string, CryptoTicker>();
  for (const t of tickers) tickerMap.set(t.symbol, t);

  const currentPair = POPULAR_PAIRS.find((p) => p.symbol === symbol);
  const displayName = currentPair ? `${currentPair.baseAsset}/${currentPair.quoteAsset}` : symbol;

  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CryptoToolbar
        symbol={symbol}
        symbols={POPULAR_PAIRS}
        interval={interval}
        onSymbolChange={setSymbol}
        onIntervalChange={setInterval}
        onViewChange={onViewChange}
        showBollinger={showBollinger}
        onToggleBollinger={() => toggle('showBollinger')}
        showRSI={showRSI}
        onToggleRSI={() => toggle('showRSI')}
        showMACD={showMACD}
        onToggleMACD={() => toggle('showMACD')}
        showStochRSI={showStochRSI}
        onToggleStochRSI={() => toggle('showStochRSI')}
        showSuperTrend={showSuperTrend}
        onToggleSuperTrend={() => toggle('showSuperTrend')}
        showIchimoku={showIchimoku}
        onToggleIchimoku={() => toggle('showIchimoku')}
        showOBV={showOBV}
        onToggleOBV={() => toggle('showOBV')}
        logScale={logScale}
        onToggleLogScale={() => toggle('logScale')}
        watchlistOpen={watchlistOpen}
        onToggleWatchlist={() => setWatchlistOpen((v) => !v)}
        isCurrentSymbolWatched={isWatched(symbol)}
        onToggleCurrentSymbolWatch={() => toggleSymbol(symbol)}
        alarmsOpen={alarmsOpen}
        onToggleAlarms={() => setAlarmsOpen((v) => !v)}
        alarmCount={alarms.filter((a) => a.enabled && !a.triggered).length}
        showSignals={showSignals}
        onToggleSignals={() => toggle('showSignals')}
      />

      <CryptoTickerBar
        tickers={tickers}
        currentSymbol={symbol}
        onSymbolClick={handleTickerClick}
        loading={tickersLoading}
      />

      <div className="app-body">
        {/* Watchlist Sidebar */}
        {watchlistOpen && (
          <div className="crypto-watchlist-panel">
            <div className="crypto-watchlist-header">
              <span className="crypto-watchlist-title">KRIPTO TAKIP</span>
              <button className="crypto-watchlist-close-btn" onClick={() => setWatchlistOpen(false)}>
                ✕
              </button>
            </div>
            <div className="crypto-watchlist-list">
              {watchlist.length === 0 ? (
                <div className="crypto-watchlist-empty">
                  Henuz takip edilen kripto yok.
                  <br />
                  Toolbar'daki yildiz ikonuna tiklayarak ekleyin.
                </div>
              ) : (
                watchlist.map((sym) => {
                  const ticker = tickerMap.get(sym);
                  const pair = POPULAR_PAIRS.find((p) => p.symbol === sym);
                  const positive = ticker ? ticker.priceChangePercent >= 0 : true;
                  return (
                    <div
                      key={sym}
                      className={`crypto-watchlist-item ${sym === symbol ? 'active' : ''}`}
                      onClick={() => handleWatchlistClick(sym)}
                    >
                      <div className="crypto-watchlist-item-info">
                        <div className="crypto-watchlist-item-symbol">{pair?.baseAsset ?? sym}</div>
                        <div className="crypto-watchlist-item-name">{sym}</div>
                      </div>
                      <div className="crypto-watchlist-item-price">
                        {ticker ? (
                          <>
                            <div className="crypto-watchlist-item-price-value">
                              ${ticker.price >= 1 ? ticker.price.toFixed(2) : ticker.price.toFixed(6)}
                            </div>
                            <div className={`crypto-watchlist-item-change ${positive ? 'positive' : 'negative'}`}>
                              {positive ? '+' : ''}
                              {ticker.priceChangePercent.toFixed(2)}%
                            </div>
                          </>
                        ) : (
                          <div className="crypto-watchlist-item-price-value" style={{ color: 'var(--text-muted)' }}>
                            --
                          </div>
                        )}
                      </div>
                      <button
                        className="crypto-watchlist-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSymbol(sym);
                        }}
                        title="Kaldir"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="app-main">
          <StockSummary symbol={symbol} displayName={displayName} data={data} />
          <div className="chart-wrapper" style={showSignals ? { flex: '1 1 0', minHeight: 200 } : undefined}>
            <Legend
              data={legendData}
              symbol={symbol}
              lastClose={lastBar?.close ?? 0}
              prevClose={prevBar?.close ?? lastBar?.close ?? 0}
              lastVolume={lastBar?.volume ?? 0}
            />
            {loading ? (
              <div className="loading-overlay">Veri yukleniyor...</div>
            ) : (
              <ErrorBoundary>
                <ChartContainer
                  data={data}
                  symbol={symbol}
                  interval={chartInterval}
                  onLegendUpdate={handleLegendUpdate}
                  showBollinger={showBollinger}
                  showRSI={showRSI}
                  showMACD={showMACD}
                  showStochRSI={showStochRSI}
                  showSuperTrend={showSuperTrend}
                  showIchimoku={showIchimoku}
                  showOBV={showOBV}
                  logScale={logScale}
                  showSignals={showSignals}
                  signalConfig={signalConfig}
                />
              </ErrorBoundary>
            )}
          </div>
          {showSignals && (
            <>
              <div ref={sigSplitterRef} className="splitter" />
              <div className="signal-panel-wrapper" style={{ height: sigHeight }}>
                <ErrorBoundary>
                  <SignalPanel
                    data={data}
                    symbol={symbol}
                    config={signalConfig}
                    onConfigChange={setSignalConfig}
                    dateRange={signalDateRange}
                    onDateRangeChange={setSignalDateRange}
                  />
                </ErrorBoundary>
              </div>
            </>
          )}
        </div>

        {/* Alarm Sidebar */}
        {alarmsOpen && (
          <AlarmPanel
            alarms={alarms}
            currentSymbol={symbol}
            uniqueActiveSymbols={uniqueActiveSymbols}
            onAdd={addAlarm}
            onRemove={removeAlarm}
            onUpdate={updateAlarm}
            onResetTriggered={resetTriggered}
            onClose={() => setAlarmsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
