import type { CryptoInterval, CryptoSymbol } from '../../api/cryptoApi';
import type { ActiveView } from '../Chart/types';
import CryptoSymbolSearch from './CryptoSymbolSearch';
import { useTheme } from '../../contexts/ThemeContext';

interface CryptoToolbarProps {
  symbol: string;
  symbols: CryptoSymbol[];
  interval: CryptoInterval;
  onSymbolChange: (symbol: string) => void;
  onIntervalChange: (interval: CryptoInterval) => void;
  onViewChange: (view: ActiveView) => void;
  // Indicators
  showBollinger: boolean;
  onToggleBollinger: () => void;
  showRSI: boolean;
  onToggleRSI: () => void;
  showMACD: boolean;
  onToggleMACD: () => void;
  showStochRSI: boolean;
  onToggleStochRSI: () => void;
  showSuperTrend: boolean;
  onToggleSuperTrend: () => void;
  showIchimoku: boolean;
  onToggleIchimoku: () => void;
  showOBV: boolean;
  onToggleOBV: () => void;
  logScale: boolean;
  onToggleLogScale: () => void;
  // Watchlist & Alarms
  watchlistOpen: boolean;
  onToggleWatchlist: () => void;
  isCurrentSymbolWatched: boolean;
  onToggleCurrentSymbolWatch: () => void;
  alarmsOpen: boolean;
  onToggleAlarms: () => void;
  alarmCount: number;
  showSignals: boolean;
  onToggleSignals: () => void;
}

const INTERVALS: { value: CryptoInterval; label: string }[] = [
  { value: '1m', label: '1dk' },
  { value: '5m', label: '5dk' },
  { value: '15m', label: '15dk' },
  { value: '30m', label: '30dk' },
  { value: '1h', label: '1S' },
  { value: '4h', label: '4S' },
  { value: '1d', label: '1G' },
  { value: '1w', label: '1H' },
  { value: '1M', label: '1A' },
];

export default function CryptoToolbar({
  symbol,
  symbols,
  interval,
  onSymbolChange,
  onIntervalChange,
  onViewChange,
  showBollinger,
  onToggleBollinger,
  showRSI,
  onToggleRSI,
  showMACD,
  onToggleMACD,
  showStochRSI,
  onToggleStochRSI,
  showSuperTrend,
  onToggleSuperTrend,
  showIchimoku,
  onToggleIchimoku,
  showOBV,
  onToggleOBV,
  logScale,
  onToggleLogScale,
  watchlistOpen,
  onToggleWatchlist,
  isCurrentSymbolWatched,
  onToggleCurrentSymbolWatch,
  alarmsOpen,
  onToggleAlarms,
  alarmCount,
  showSignals,
  onToggleSignals,
}: CryptoToolbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="toolbar" role="toolbar">
      <div className="toolbar-section">
        {/* Watchlist toggle */}
        <button
          className={`toolbar-btn watchlist-toggle-btn ${watchlistOpen ? 'active' : ''}`}
          onClick={onToggleWatchlist}
          title="Kripto Takip Listesi"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>

        <div className="toolbar-divider" />

        {/* View toggle */}
        <div className="toolbar-group view-toggle" role="group">
          <button className="toolbar-btn" onClick={() => onViewChange('chart')} aria-label="Borsa'ya don">
            Borsa
          </button>
          <button className="toolbar-btn active" aria-label="Kripto">
            Kripto
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group" role="group">
          <CryptoSymbolSearch symbol={symbol} symbols={symbols} onSymbolChange={onSymbolChange} />
          <button
            className={`toolbar-btn star-btn ${isCurrentSymbolWatched ? 'watched' : ''}`}
            onClick={onToggleCurrentSymbolWatch}
            title={isCurrentSymbolWatched ? 'Takipten cikar' : 'Takip listesine ekle'}
          >
            {isCurrentSymbolWatched ? '\u2605' : '\u2606'}
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group" role="group">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              className={`toolbar-btn ${interval === iv.value ? 'active' : ''}`}
              onClick={() => onIntervalChange(iv.value)}
              aria-label={`${iv.label} periyot`}
            >
              {iv.label}
            </button>
          ))}
        </div>

        <div className="toolbar-divider" />

        <button
          className={`toolbar-btn ${logScale ? 'active' : ''}`}
          onClick={onToggleLogScale}
          aria-label="Logaritmik olcek"
        >
          Log
        </button>
      </div>

      <div className="toolbar-section">
        <button className={`toolbar-btn ${showBollinger ? 'active' : ''}`} onClick={onToggleBollinger}>
          Bollinger
        </button>
        <button className={`toolbar-btn ${showRSI ? 'active' : ''}`} onClick={onToggleRSI}>
          RSI
        </button>
        <button className={`toolbar-btn ${showMACD ? 'active' : ''}`} onClick={onToggleMACD}>
          MACD
        </button>
        <button className={`toolbar-btn ${showStochRSI ? 'active' : ''}`} onClick={onToggleStochRSI}>
          Stoch RSI
        </button>
        <button className={`toolbar-btn ${showSuperTrend ? 'active' : ''}`} onClick={onToggleSuperTrend}>
          SuperTrend
        </button>
        <button className={`toolbar-btn ${showIchimoku ? 'active' : ''}`} onClick={onToggleIchimoku}>
          Ichimoku
        </button>
        <button className={`toolbar-btn ${showOBV ? 'active' : ''}`} onClick={onToggleOBV}>
          OBV
        </button>

        <div className="toolbar-divider" />

        <button
          className={`toolbar-btn ${showSignals ? 'active' : ''}`}
          onClick={onToggleSignals}
          title="Al-Sat Sinyalleri"
        >
          Al-Sat
        </button>

        <div className="toolbar-divider" />

        <button
          className={`toolbar-btn alarm-toggle-btn ${alarmsOpen ? 'active' : ''}`}
          onClick={onToggleAlarms}
          title="Alarmlar"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {alarmCount > 0 && <span className="alarm-badge">{alarmCount}</span>}
        </button>

        <button
          className="toolbar-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Aydinlik tema' : 'Karanlik tema'}
        >
          {theme === 'dark' ? '\u2600' : '\u263D'}
        </button>
      </div>
    </div>
  );
}
