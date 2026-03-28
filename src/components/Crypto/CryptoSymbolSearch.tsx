import { useState, useRef, useEffect, useCallback } from 'react';
import type { CryptoSymbol } from '../../api/cryptoApi';

interface CryptoSymbolSearchProps {
  symbol: string;
  symbols: CryptoSymbol[];
  onSymbolChange: (symbol: string) => void;
}

export default function CryptoSymbolSearch({ symbol, symbols, onSymbolChange }: CryptoSymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = symbols.find((s) => s.symbol === symbol);

  const MAX_RESULTS = 30;
  const filtered = query.trim()
    ? symbols
        .filter((s) => {
          const q = query.toUpperCase();
          return s.symbol.includes(q) || s.baseAsset.includes(q);
        })
        .slice(0, MAX_RESULTS)
    : symbols.slice(0, MAX_RESULTS);

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

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  const selectSymbol = useCallback(
    (sym: string) => {
      onSymbolChange(sym);
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
      if (filtered[highlightIdx]) selectSymbol(filtered[highlightIdx].symbol);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

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
        placeholder="Kripto ara... (BTC, ETH)"
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {!open && current && (
        <span className="symbol-name">
          {current.baseAsset}/{current.quoteAsset}
        </span>
      )}
      {open && (
        <div className="symbol-dropdown" ref={dropdownRef}>
          {filtered.length === 0 && <div className="symbol-dropdown-empty">Sonuc bulunamadi</div>}
          {filtered.map((s, i) => (
            <div
              key={s.symbol}
              className={`symbol-dropdown-item ${i === highlightIdx ? 'highlighted' : ''} ${s.symbol === symbol ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSymbol(s.symbol);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span className="sdi-name">{s.baseAsset}</span>
              <span className="sdi-display">{s.symbol}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
