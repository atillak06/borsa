/**
 * Data derivation functions for charts and tables.
 * These transform raw ScanRow[] into chart-specific datasets.
 */

import type { ScanRow } from '../../api/borsaApi';
import { PEARSON_INDICATORS } from './indicatorConfig';

// ── Pearson Scatter ──

export interface PearsonPoint {
  symbol: string;
  pearson: number;
  slope: number;
  signal: string;
  channel: string;
}

/**
 * Pick the best (highest |pearson|) channel for each symbol.
 */
export function derivePearsonScatterData(data: ScanRow[]): PearsonPoint[] {
  const points: PearsonPoint[] = [];

  for (const row of data) {
    let best: PearsonPoint | null = null;

    for (const meta of PEARSON_INDICATORS) {
      const pearson = row[`${meta.name}_pearson`];
      const rawSlope = row[`${meta.name}_slope`];
      const signal = row[meta.signalKey];
      const close = row.close;

      if (typeof pearson !== 'number' || typeof rawSlope !== 'number') continue;

      // Normalize slope: TL/bar → %/bar (comparable across all price levels)
      const slope = (typeof close === 'number' && close > 0)
        ? (rawSlope / close) * 100
        : rawSlope;

      if (!best || Math.abs(pearson) > Math.abs(best.pearson)) {
        best = {
          symbol: row.symbol,
          pearson,
          slope,
          signal: String(signal ?? 'neutral'),
          channel: meta.label,
        };
      }
    }

    if (best) points.push(best);
  }

  return points;
}

// ── Top Pearson ──

export interface TopPearsonRow {
  symbol: string;
  close: number;
  pearson: number;
  slope: number;
  channel: string;
}

export function deriveTopPearson(data: ScanRow[], count = 10): TopPearsonRow[] {
  const rows: TopPearsonRow[] = [];

  for (const row of data) {
    let bestPearson = -Infinity;
    let bestSlope = 0;
    let bestCh = '';

    for (const meta of PEARSON_INDICATORS) {
      const p = row[`${meta.name}_pearson`];
      const s = row[`${meta.name}_slope`];
      if (typeof p !== 'number') continue;
      if (p > bestPearson) {
        bestPearson = p;
        bestSlope = typeof s === 'number' ? s : 0;
        bestCh = meta.label;
      }
    }

    if (bestPearson > -Infinity) {
      rows.push({
        symbol: row.symbol,
        close: row.close,
        pearson: bestPearson,
        slope: bestSlope,
        channel: bestCh,
      });
    }
  }

  rows.sort((a, b) => b.pearson - a.pearson);
  return rows.slice(0, count);
}

// ── EMA Distribution ──

export interface EMADistribution {
  idealUp: number;
  up: number;
  down: number;
  idealDown: number;
  other: number;
}

export function deriveEMADistribution(data: ScanRow[]): EMADistribution {
  const dist: EMADistribution = { idealUp: 0, up: 0, down: 0, idealDown: 0, other: 0 };

  for (const row of data) {
    const signal = row['ema_trend_signal'];
    switch (signal) {
      case 'ideal_up':
        dist.idealUp++;
        break;
      case 'up':
        dist.up++;
        break;
      case 'ideal_down':
        dist.idealDown++;
        break;
      case 'down':
        dist.down++;
        break;
      default:
        dist.other++;
    }
  }

  return dist;
}

// ── Momentum Scatter ──

export interface MomentumPoint {
  symbol: string;
  slope: number;
  signal: string;
}

/**
 * Derive momentum scatter data from Pearson 144-233 (ch2) slope values.
 */
export function deriveMomentumScatterData(data: ScanRow[]): MomentumPoint[] {
  const points: MomentumPoint[] = [];

  for (const row of data) {
    const rawSlope = row['pearson_ch2_slope'];
    const signal = row['pearson_ch2_signal'];
    const close = row.close;
    if (typeof rawSlope !== 'number') continue;

    // Normalize slope: TL/bar → %/bar
    const slope = (typeof close === 'number' && close > 0)
      ? (rawSlope / close) * 100
      : rawSlope;

    points.push({
      symbol: row.symbol,
      slope,
      signal: String(signal ?? 'neutral'),
    });
  }

  // Sort by slope descending
  points.sort((a, b) => b.slope - a.slope);
  return points;
}
