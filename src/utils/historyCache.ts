import type { OHLCVData } from '../api/borsaApi';

const DB_NAME = 'borsa_history';
const DB_VERSION = 1;
const STORE_NAME = 'ohlcv';

interface CacheEntry {
  key: string;
  data: OHLCVData[];
  fetchedAt: number;
}

// ── IndexedDB helpers ──────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export async function getFromDB(symbol: string, interval: string): Promise<CacheEntry | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const key = `${symbol}_${interval}`;
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveToDB(symbol: string, interval: string, data: OHLCVData[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const key = `${symbol}_${interval}`;
    store.put({ key, data, fetchedAt: Date.now() } satisfies CacheEntry);
  } catch {
    // IndexedDB write failure is non-critical
  }
}

// ── In-memory cache (session-level, instant access) ──

interface MemEntry {
  data: OHLCVData[];
  fetchedAt: number;
}

const memCache = new Map<string, MemEntry>();

export function getFromMemory(symbol: string, interval: string): MemEntry | undefined {
  return memCache.get(`${symbol}_${interval}`);
}

export function saveToMemory(symbol: string, interval: string, data: OHLCVData[], fetchedAt?: number): void {
  memCache.set(`${symbol}_${interval}`, { data, fetchedAt: fetchedAt ?? Date.now() });
}
