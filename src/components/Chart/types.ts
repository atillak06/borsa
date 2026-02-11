export type ChartType = 'Candlestick' | 'Line' | 'Area' | 'Bar' | 'Baseline';

export type Interval = '1d' | '1wk' | '1mo' | '3mo';

export interface LegendData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
  prevClose: number;
}
