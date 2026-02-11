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
