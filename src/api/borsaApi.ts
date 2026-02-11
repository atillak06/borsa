const API_BASE = 'http://localhost:8001';

export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolInfo {
  name: string;
  displayName: string;
}

export interface QuoteData {
  price: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  volume: number;
  time: string;
}

export async function fetchSymbols(): Promise<{ stocks: SymbolInfo[]; indices: SymbolInfo[] }> {
  const res = await fetch(`${API_BASE}/api/symbols`);
  return res.json();
}

export async function fetchHistory(
  symbol: string,
  period: string = '1y',
  interval: string = '1d',
): Promise<OHLCVData[]> {
  const res = await fetch(
    `${API_BASE}/api/history/${symbol}?period=${period}&interval=${interval}`,
  );
  const json = await res.json();
  return json.data ?? [];
}

export interface FinancialRow {
  item: string;
  [period: string]: string | number | null;
}

export interface FinancialsResponse {
  symbol: string;
  report: string;
  quarterly: boolean;
  periods: string[];
  data: FinancialRow[];
  error?: string;
}

export async function fetchFinancials(
  symbol: string,
  report: 'income_stmt' | 'balance_sheet' | 'cashflow' = 'income_stmt',
  quarterly = false,
): Promise<FinancialsResponse> {
  const res = await fetch(
    `${API_BASE}/api/financials/${symbol}?report=${report}&quarterly=${quarterly}`,
  );
  return res.json();
}

export function createWebSocket(
  symbol: string,
  onQuote: (data: QuoteData) => void,
  onSnapshot?: (data: QuoteData) => void,
): WebSocket {
  const ws = new WebSocket(`ws://localhost:8001/ws/stream/${symbol}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'quote') {
        onQuote(msg.data);
      } else if (msg.type === 'snapshot' && onSnapshot) {
        onSnapshot(msg.data);
      }
    } catch {
      // ignore parse errors
    }
  };

  // Keep alive with ping
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping');
    }
  }, 25000);

  const origClose = ws.close.bind(ws);
  ws.close = () => {
    clearInterval(pingInterval);
    origClose();
  };

  return ws;
}

// ──────────────────────────────────────────────
// Market Scan API
// ──────────────────────────────────────────────

export interface ScanRow {
  symbol: string;
  close: number;
  volume: number;
  data_points: number;
  [key: string]: string | number | boolean | undefined | null;
}

export interface ScanProgress {
  type: 'progress';
  completed: number;
  total: number;
  found: number;
}

export interface ScanComplete {
  type: 'complete';
  results: ScanRow[];
  total_symbols: number;
  analyzed: number;
  timestamp: number;
}

/**
 * Start a market scan via SSE.  Returns an AbortController to cancel.
 */
export function startScan(
  onProgress: (p: ScanProgress) => void,
  onComplete: (c: ScanComplete) => void,
  onError: (err: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/scan`, { signal: controller.signal })
    .then(async (res) => {
      if (!res.ok) {
        onError(`HTTP ${res.status}`);
        return;
      }

      const contentType = res.headers.get('content-type') ?? '';

      // If cached, returns JSON directly
      if (contentType.includes('application/json')) {
        const json = await res.json();
        onComplete({
          type: 'complete',
          results: json.results ?? [],
          total_symbols: json.total_symbols ?? 0,
          analyzed: json.analyzed ?? 0,
          timestamp: json.timestamp ?? Date.now() / 1000,
        });
        return;
      }

      // SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        onError('No stream reader');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'progress') {
              onProgress(parsed as ScanProgress);
            } else if (parsed.type === 'complete') {
              onComplete(parsed as ScanComplete);
            }
          } catch {
            // skip malformed
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(String(err));
      }
    });

  return controller;
}

/**
 * Fetch cached scan results (instant).
 */
export async function fetchScanResults(): Promise<ScanComplete & { cache_age_seconds?: number; cached?: boolean }> {
  const res = await fetch(`${API_BASE}/api/scan/results`);
  return res.json();
}

/**
 * Clear scan cache to force re-scan.
 */
export async function clearScanCache(): Promise<void> {
  await fetch(`${API_BASE}/api/scan/cache`, { method: 'DELETE' });
}
