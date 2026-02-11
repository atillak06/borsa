import { useState, useRef, useEffect, useCallback } from 'react';
import type { Interval } from '../Chart/types';
import type { SymbolInfo } from '../../api/borsaApi';
import './Toolbar.css';

interface ToolbarProps {
  symbol: string;
  symbols: SymbolInfo[];
  interval: Interval;
  onSymbolChange: (symbol: string) => void;
  onIntervalChange: (interval: Interval) => void;
  onToggleFinancials: () => void;
  showFinancials: boolean;
  onToggleChannels: () => void;
  showChannels: boolean;
  onToggleWilliamsR: () => void;
  showWilliamsR: boolean;
  onToggleNizamiCedid: () => void;
  showNizamiCedid: boolean;
  onToggleMATLRNS: () => void;
  showMATLRNS: boolean;
  logScale: boolean;
  onToggleLogScale: () => void;
  activeView: 'chart' | 'analysis';
  onViewChange: (view: 'chart' | 'analysis') => void;
}

const INTERVALS: { value: Interval; label: string }[] = [
  { value: '1d', label: '1G' },
  { value: '1wk', label: '1H' },
  { value: '1mo', label: '1A' },
  { value: '3mo', label: '3A' },
];

function SymbolSearch({
  symbol,
  symbols,
  onSymbolChange,
}: {
  symbol: string;
  symbols: SymbolInfo[];
  onSymbolChange: (s: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSymbol = symbols.find((s) => s.name === symbol);

  const MAX_RESULTS = 50;
  const filtered = query.trim()
    ? symbols
        .filter((s) => {
          const q = query.toUpperCase();
          return (
            s.name.toUpperCase().includes(q) ||
            s.displayName.toUpperCase().includes(q)
          );
        })
        .slice(0, MAX_RESULTS)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  const selectSymbol = useCallback(
    (name: string) => {
      onSymbolChange(name);
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    },
    [onSymbolChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIdx]) {
        selectSymbol(filtered[highlightIdx].name);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const el = dropdownRef.current.children[highlightIdx] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  return (
    <div className="symbol-search">
      <input
        ref={inputRef}
        className="symbol-input"
        type="text"
        value={open ? query : symbol}
        placeholder="Hisse ara..."
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {!open && currentSymbol && (
        <span className="symbol-name">{currentSymbol.displayName}</span>
      )}
      {open && (
        <div className="symbol-dropdown" ref={dropdownRef}>
          {!query.trim() && (
            <div className="symbol-dropdown-empty">Hisse kodu veya isim yazın...</div>
          )}
          {query.trim() && filtered.length === 0 && (
            <div className="symbol-dropdown-empty">Sonuç bulunamadı</div>
          )}
          {filtered.map((s, i) => (
            <div
              key={s.name}
              className={`symbol-dropdown-item ${i === highlightIdx ? 'highlighted' : ''} ${s.name === symbol ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSymbol(s.name);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span className="sdi-name">{s.name}</span>
              <span className="sdi-display">{s.displayName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Toolbar({
  symbol,
  symbols,
  interval,
  onSymbolChange,
  onIntervalChange,
  onToggleFinancials,
  showFinancials,
  onToggleChannels,
  showChannels,
  onToggleWilliamsR,
  showWilliamsR,
  onToggleNizamiCedid,
  showNizamiCedid,
  onToggleMATLRNS,
  showMATLRNS,
  logScale,
  onToggleLogScale,
  activeView,
  onViewChange,
}: ToolbarProps) {
  const isChart = activeView === 'chart';

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        {/* View toggle */}
        <div className="toolbar-group view-toggle">
          <button
            className={`toolbar-btn ${isChart ? 'active' : ''}`}
            onClick={() => onViewChange('chart')}
          >
            Grafik
          </button>
          <button
            className={`toolbar-btn analysis-btn ${!isChart ? 'active' : ''}`}
            onClick={() => onViewChange('analysis')}
          >
            Piyasa Analizi
          </button>
        </div>

        <div className="toolbar-divider" />

        {isChart && (
          <>
            <div className="toolbar-group">
              <SymbolSearch
                symbol={symbol}
                symbols={symbols}
                onSymbolChange={onSymbolChange}
              />
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              {INTERVALS.map((iv) => (
                <button
                  key={iv.value}
                  className={`toolbar-btn ${interval === iv.value ? 'active' : ''}`}
                  onClick={() => onIntervalChange(iv.value)}
                >
                  {iv.label}
                </button>
              ))}
            </div>

            <div className="toolbar-divider" />

            <button
              className={`toolbar-btn ${logScale ? 'active' : ''}`}
              onClick={onToggleLogScale}
            >
              Log
            </button>
          </>
        )}
      </div>

      {isChart && (
        <div className="toolbar-section">
          <button
            className={`toolbar-btn ${showChannels ? 'active' : ''}`}
            onClick={onToggleChannels}
          >
            Kanallar
          </button>
          <button
            className={`toolbar-btn ${showWilliamsR ? 'active' : ''}`}
            onClick={onToggleWilliamsR}
          >
            William Pasa
          </button>
          <button
            className={`toolbar-btn ${showNizamiCedid ? 'active' : ''}`}
            onClick={onToggleNizamiCedid}
          >
            3. Selim
          </button>
          <button
            className={`toolbar-btn ${showMATLRNS ? 'active' : ''}`}
            onClick={onToggleMATLRNS}
          >
            MATLRNS
          </button>
          <button
            className={`toolbar-btn ${showFinancials ? 'active' : ''}`}
            onClick={onToggleFinancials}
          >
            Finansallar
          </button>
          <div className="live-indicator">
            <span className="live-dot" />
            CANLI
          </div>
        </div>
      )}
    </div>
  );
}
