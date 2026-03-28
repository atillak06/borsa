import { useState, useRef, useEffect, useCallback } from 'react';
import type { SymbolInfo } from '../../api/borsaApi';
import './SymbolSearch.css';

interface SymbolSearchProps {
  symbol: string;
  symbols: SymbolInfo[];
  onSymbolChange: (s: string) => void;
  compact?: boolean;
}

export function SymbolSearch({ symbol, symbols, onSymbolChange, compact = false }: SymbolSearchProps) {
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
          return s.name.toUpperCase().includes(q) || s.displayName.toUpperCase().includes(q);
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
    <div className={`symbol-search ${compact ? 'symbol-search-compact' : ''}`}>
      <input
        ref={inputRef}
        className={`symbol-input ${compact ? 'symbol-input-compact' : ''}`}
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
      {!open && !compact && currentSymbol && <span className="symbol-name">{currentSymbol.displayName}</span>}
      {open && (
        <div className={`symbol-dropdown ${compact ? 'symbol-dropdown-compact' : ''}`} ref={dropdownRef}>
          {!query.trim() && <div className="symbol-dropdown-empty">Hisse kodu veya isim yazin...</div>}
          {query.trim() && filtered.length === 0 && <div className="symbol-dropdown-empty">Sonuc bulunamadi</div>}
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
