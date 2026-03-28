import type { Interval, ActiveView } from '../Chart/types';
import type { SymbolInfo } from '../../api/borsaApi';
import { SymbolSearch } from '../SymbolSearch/SymbolSearch';
import { useTheme } from '../../contexts/ThemeContext';
import './Toolbar.css';

interface ToolbarProps {
  symbol: string;
  symbols: SymbolInfo[];
  interval: Interval;
  onSymbolChange: (symbol: string) => void;
  onIntervalChange: (interval: Interval) => void;
  onToggleFinancials: () => void;
  showFinancials: boolean;
  onToggleBollinger: () => void;
  showBollinger: boolean;
  onToggleRSI: () => void;
  showRSI: boolean;
  onToggleMACD: () => void;
  showMACD: boolean;
  onToggleStochRSI: () => void;
  showStochRSI: boolean;
  onToggleSuperTrend: () => void;
  showSuperTrend: boolean;
  onToggleIchimoku: () => void;
  showIchimoku: boolean;
  onToggleOBV: () => void;
  showOBV: boolean;
  logScale: boolean;
  onToggleLogScale: () => void;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  // Watchlist
  watchlistOpen: boolean;
  onToggleWatchlist: () => void;
  isCurrentSymbolWatched: boolean;
  onToggleCurrentSymbolWatch: () => void;
  // Alarms
  alarmsOpen: boolean;
  onToggleAlarms: () => void;
  alarmCount: number;
  dataTimestamp: number | null;
  // Signals
  onToggleSignals: () => void;
  showSignals: boolean;
}

function formatTurkishDate(ts: number): string {
  const MONTHS = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const d = new Date(ts * 1000);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const INTERVALS: { value: Interval; label: string }[] = [
  { value: '1m', label: '1dk' },
  { value: '5m', label: '5dk' },
  { value: '15m', label: '15dk' },
  { value: '30m', label: '30dk' },
  { value: '1h', label: '1S' },
  { value: '1d', label: '1G' },
  { value: '1wk', label: '1H' },
  { value: '1mo', label: '1A' },
];

export default function Toolbar({
  symbol,
  symbols,
  interval,
  onSymbolChange,
  onIntervalChange,
  onToggleFinancials,
  showFinancials,
  onToggleBollinger,
  showBollinger,
  onToggleRSI,
  showRSI,
  onToggleMACD,
  showMACD,
  onToggleStochRSI,
  showStochRSI,
  onToggleSuperTrend,
  showSuperTrend,
  onToggleIchimoku,
  showIchimoku,
  onToggleOBV,
  showOBV,
  logScale,
  onToggleLogScale,
  activeView,
  onViewChange,
  watchlistOpen,
  onToggleWatchlist,
  isCurrentSymbolWatched,
  onToggleCurrentSymbolWatch,
  alarmsOpen,
  onToggleAlarms,
  alarmCount,
  dataTimestamp,
  onToggleSignals,
  showSignals,
}: ToolbarProps) {
  const isChart = activeView === 'chart' || activeView === 'multichart';
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="toolbar" role="toolbar">
      <div className="toolbar-section">
        {/* Watchlist toggle */}
        <button
          className={`toolbar-btn watchlist-toggle-btn ${watchlistOpen ? 'active' : ''}`}
          onClick={onToggleWatchlist}
          title="Takip Listesi"
          aria-label="Takip Listesi"
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
          <button
            className={`toolbar-btn ${activeView === 'chart' ? 'active' : ''}`}
            onClick={() => onViewChange('chart')}
            aria-label="Grafik gorunumu"
          >
            Grafik
          </button>
          <button
            className={`toolbar-btn multichart-btn ${activeView === 'multichart' ? 'active' : ''}`}
            onClick={() => onViewChange('multichart')}
            aria-label="Coklu grafik"
          >
            Coklu
          </button>
          <button
            className={`toolbar-btn analysis-btn ${activeView === 'analysis' ? 'active' : ''}`}
            onClick={() => onViewChange('analysis')}
            aria-label="Piyasa Analizi"
          >
            Piyasa Analizi
          </button>
          <button
            className={`toolbar-btn backtest-btn ${activeView === 'backtest' ? 'active' : ''}`}
            onClick={() => onViewChange('backtest')}
            aria-label="Backtest"
          >
            Backtest
          </button>
          <button
            className={`toolbar-btn finansal-btn ${activeView === 'finansal' ? 'active' : ''}`}
            onClick={() => onViewChange('finansal')}
            aria-label="Finansal veriler"
          >
            Finansal
          </button>
          <button
            className={`toolbar-btn kripto-btn ${activeView === 'kripto' ? 'active' : ''}`}
            onClick={() => onViewChange('kripto')}
            aria-label="Kripto"
          >
            Kripto
          </button>
        </div>

        <div className="toolbar-divider" />

        {isChart && (
          <>
            <div className="toolbar-group" role="group">
              <SymbolSearch symbol={symbol} symbols={symbols} onSymbolChange={onSymbolChange} />
              {/* Watch star */}
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
          </>
        )}
      </div>

      {isChart && (
        <div className="toolbar-section">
          <button
            className={`toolbar-btn ${showBollinger ? 'active' : ''}`}
            onClick={onToggleBollinger}
            aria-label="Bollinger goster"
          >
            Bollinger
          </button>
          <button className={`toolbar-btn ${showRSI ? 'active' : ''}`} onClick={onToggleRSI} aria-label="RSI goster">
            RSI
          </button>
          <button className={`toolbar-btn ${showMACD ? 'active' : ''}`} onClick={onToggleMACD} aria-label="MACD goster">
            MACD
          </button>
          <button
            className={`toolbar-btn ${showStochRSI ? 'active' : ''}`}
            onClick={onToggleStochRSI}
            aria-label="Stoch RSI goster"
          >
            Stoch RSI
          </button>
          <button
            className={`toolbar-btn ${showSuperTrend ? 'active' : ''}`}
            onClick={onToggleSuperTrend}
            aria-label="SuperTrend goster"
          >
            SuperTrend
          </button>
          <button
            className={`toolbar-btn ${showIchimoku ? 'active' : ''}`}
            onClick={onToggleIchimoku}
            aria-label="Ichimoku goster"
          >
            Ichimoku
          </button>
          <button className={`toolbar-btn ${showOBV ? 'active' : ''}`} onClick={onToggleOBV} aria-label="OBV goster">
            OBV
          </button>
          <button
            className={`toolbar-btn signal-btn ${showSignals ? 'active' : ''}`}
            onClick={onToggleSignals}
            aria-label="Al Sat sinyalleri"
          >
            Al/Sat
          </button>
          <button
            className={`toolbar-btn ${showFinancials ? 'active' : ''}`}
            onClick={onToggleFinancials}
            aria-label="Finansal veriler"
          >
            Finansallar
          </button>
          <div className="toolbar-divider" />

          <button
            className={`toolbar-btn alarm-toggle-btn ${alarmsOpen ? 'active' : ''}`}
            onClick={onToggleAlarms}
            title="Alarmlar"
            aria-label="Alarmlar"
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
            aria-label="Tema degistir"
          >
            {theme === 'dark' ? '\u2600' : '\u263D'}
          </button>

          <div className="data-freshness">
            {dataTimestamp ? `Son guncelleme: ${formatTurkishDate(dataTimestamp)}` : 'Statik Veri'}
          </div>
        </div>
      )}
    </div>
  );
}
