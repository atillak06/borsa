import { useState, useCallback } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

const DEFAULT_KEY = 'borsa_watchlist';

export function useWatchlist(storageKey = DEFAULT_KEY) {
  const [watchlist, setWatchlist] = useState<string[]>(() => loadFromStorage<string[]>(storageKey, []));

  const addSymbol = useCallback(
    (symbol: string) => {
      setWatchlist((prev) => {
        if (prev.includes(symbol)) return prev;
        const next = [...prev, symbol];
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const removeSymbol = useCallback(
    (symbol: string) => {
      setWatchlist((prev) => {
        const next = prev.filter((s) => s !== symbol);
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const toggleSymbol = useCallback(
    (symbol: string) => {
      setWatchlist((prev) => {
        const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const isWatched = useCallback((symbol: string) => watchlist.includes(symbol), [watchlist]);

  return { watchlist, addSymbol, removeSymbol, toggleSymbol, isWatched };
}
