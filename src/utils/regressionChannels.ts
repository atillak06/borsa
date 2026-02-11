/**
 * Pearson Regression Channels — Pine Script "Uzun Vadeli Kanal + Pearson" mantığının TS karşılığı.
 *
 * Her kanal için:
 * 1. [minPeriod, maxPeriod] aralığında her periyot için R² hesaplanır
 * 2. En yüksek R²'ye sahip periyot seçilir (best fit)
 * 3. O periyotla lineer regresyon çizgisi (başlangıç A, bitiş B) hesaplanır
 * 4. ± mult * RMSE ile üst/alt bant çizilir
 * 5. Pearson korelasyon = sqrt(R²) * sign(slope)
 */

export interface ChannelConfig {
  id: string;
  label: string;
  minPeriod: number;
  maxPeriod: number;
  mult: number;
  color: string;       // line center color
  bandColor: string;   // upper/lower band color
  width: number;
}

export interface ChannelResult {
  id: string;
  period: number;        // best-fit period
  pearson: number;       // correlation coefficient
  startIdx: number;      // bar index where channel starts (n - period)
  endIdx: number;        // bar index where channel ends (last bar)
  startUpper: number;    // A + rmse
  endUpper: number;      // B + rmse
  startLower: number;    // A - rmse
  endLower: number;      // B - rmse
  startMid: number;      // A (regression line start)
  endMid: number;        // B (regression line end)
  slope: number;         // price change per bar
  rmse: number;          // root mean square error (before mult)
  // Extended values: project the line into the future
  extendedUpper: number; // upper band value projected forwardExtend bars ahead
  extendedLower: number;
  extendedMid: number;
}

/**
 * Gelecek perspektifi: Tüm kanalların ağırlıklı ortalamasından
 * huni şeklinde genişleyen bir güven kuşağı hesaplar.
 *
 * - Her kanalın ağırlığı = |pearson| * period (uzun vadeli + güçlü korelasyon = daha ağırlıklı)
 * - Merkezde: ağırlıklı ortalama eğim ile projeksiyon
 * - Kuşak genişliği: ileriye gittikçe artar (belirsizlik büyür)
 * - Pearson yüksekse kuşak dar başlar, düşükse geniş başlar
 */
export interface ForecastBand {
  /** Her bar için: [mid, upper, lower] */
  bars: Array<{ mid: number; upper: number; lower: number }>;
  /** Toplam kaç bar ileriye */
  forwardBars: number;
  /** Ağırlıklı ortalama Pearson (güvenilirlik göstergesi) */
  avgPearson: number;
}

export function computeForecastBand(
  channels: ChannelResult[],
  forwardBars = 120,
  lastClose?: number,
): ForecastBand | null {
  if (channels.length === 0) return null;

  // Ağırlık: |pearson| * sqrt(period) — uzun vade ve güçlü korelasyona ağırlık ver
  const weights = channels.map((ch) => Math.abs(ch.pearson) * Math.sqrt(ch.period));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return null;

  // Son fiyat noktası: gerçek son kapanış fiyatı (verilmemişse ağırlıklı ortalama endMid)
  const lastPrice = lastClose ?? channels.reduce((sum, ch, i) => sum + ch.endMid * weights[i], 0) / totalWeight;

  // Ağırlıklı ortalama eğim (günlük fiyat değişimi)
  const avgSlope = channels.reduce((sum, ch, i) => sum + ch.slope * weights[i], 0) / totalWeight;

  // Başlangıç belirsizliği: kanalların RMSE'lerinin ağırlıklı ortalaması
  const baseUncertainty = channels.reduce((sum, ch, i) => sum + ch.rmse * weights[i], 0) / totalWeight;

  // Ağırlıklı ortalama |pearson|
  const avgAbsPearson = channels.reduce((sum, ch, i) => sum + Math.abs(ch.pearson) * weights[i], 0) / totalWeight;

  // Güven çarpanı: pearson düşükse çok daha hızlı genişle, yüksekse dar kalsın
  // confidenceFactor: pearson=1 → 1, pearson=0.5 → 4, pearson=0.3 → ~11
  const confidenceFactor = 1 / Math.max(0.1, avgAbsPearson * avgAbsPearson);
  const spreadRate = (1 - avgAbsPearson * 0.8) * 0.015 * confidenceFactor;

  // Başlangıç genişliği de güvene bağlı: düşük güven = daha geniş başlangıç
  const baseMultiplier = 0.3 * confidenceFactor;

  const bars: ForecastBand['bars'] = [];
  for (let i = 1; i <= forwardBars; i++) {
    const mid = lastPrice + avgSlope * i;
    // Huni: başlangıç uncertainty + ileriye gittikçe genişleyen kısım
    const spread = baseUncertainty * baseMultiplier + Math.abs(mid) * spreadRate * Math.sqrt(i);
    bars.push({
      mid,
      upper: mid + spread,
      lower: mid - spread,
    });
  }

  return {
    bars,
    forwardBars,
    avgPearson: avgAbsPearson,
  };
}

export const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    id: 'ch3',
    label: 'En Kısa Vadeli',
    minPeriod: 21,
    maxPeriod: 34,
    mult: 2,
    color: 'rgba(255,233,201,0.8)',
    bandColor: 'rgba(150,150,150,0.7)',
    width: 2,
  },
  {
    id: 'ch1',
    label: 'Kısa Vadeli',
    minPeriod: 55,
    maxPeriod: 89,
    mult: 2,
    color: 'rgba(239,83,80,0.8)',
    bandColor: 'rgba(41,98,255,0.8)',
    width: 2,
  },
  {
    id: 'ch2',
    label: 'Uzun Vadeli',
    minPeriod: 144,
    maxPeriod: 233,
    mult: 2,
    color: 'rgba(38,166,154,0.5)',
    bandColor: 'rgba(38,166,154,0.8)',
    width: 3,
  },
  {
    id: 'ch4',
    label: 'En Uzun Vadeli',
    minPeriod: 377,
    maxPeriod: 610,
    mult: 2,
    color: 'rgba(38,166,154,0.6)',
    bandColor: 'rgba(255,152,0,0.8)',
    width: 2,
  },
];

/**
 * Cumulative sum array: cumSum[i] = src[0] + src[1] + ... + src[i]
 * cumSum[-1] = 0 (handled by returning 0 for out of range)
 */
function cumulativeSum(src: number[]): number[] {
  const n = src.length;
  const out = new Array(n);
  out[0] = src[0];
  for (let i = 1; i < n; i++) {
    out[i] = out[i - 1] + src[i];
  }
  return out;
}

/**
 * Get cumulative sum value, returning 0 for negative indices.
 */
function cs(arr: number[], i: number): number {
  if (i < 0) return 0;
  return arr[i];
}

/**
 * Compute R² for a given period p at bar index n.
 *
 * Pine Script logic:
 *   cmla = cumulative sum of source
 *   cmlb = cumulative sum of cmla shifted by 1
 *   cmlc = cumulative sum of source²
 *
 *   sum = cmlb[n] - cmlb[n-p]
 *   a = p * cmla[n] - sum
 *   b = cmla[n] - cmla[n-p]
 *   c = cmlc[n] - cmlc[n-p]
 *   num = (a - b*(p+1)/2) / p
 *   vary = c/p - (b/p)²
 *   varx = (p²-1)/12
 *   R² = (num / sqrt(vary * varx))²
 */
function computeR2(
  cmla: number[],
  cmlb: number[],
  cmlc: number[],
  n: number,
  p: number,
): number {
  if (n - p < -1) return 0;

  const sum = cs(cmlb, n) - cs(cmlb, n - p);
  const a = p * cs(cmla, n) - sum;
  const b = cs(cmla, n) - cs(cmla, n - p);
  const c = cs(cmlc, n) - cs(cmlc, n - p);

  const num = (a - b * (p + 1) / 2) / p;
  const vary = c / p - Math.pow(b / p, 2);
  const varx = (p * p - 1) / 12;

  if (vary <= 0 || varx <= 0) return 0;

  const denom = Math.sqrt(vary * varx);
  if (denom === 0) return 0;

  return Math.pow(num / denom, 2);
}

/**
 * Compute regression channel for one config.
 */
function computeChannel(
  closePrices: number[],
  config: ChannelConfig,
): ChannelResult | null {
  const n = closePrices.length - 1; // last bar index
  if (n < config.minPeriod) return null;

  // Build cumulative arrays
  const cmla = cumulativeSum(closePrices);

  // cmlb = cumulative sum of cmla[i-1], i.e., shifted cmla
  // Pine: cmlb = ta.cum(cmla[1]) → at bar i, cmlb[i] = sum of cmla[0..i-1]
  // Which equals cmla[0] + cmla[1] + ... + cmla[i-1]
  const shiftedCmla = new Array(closePrices.length);
  shiftedCmla[0] = 0;
  for (let i = 1; i < closePrices.length; i++) {
    shiftedCmla[i] = cmla[i - 1];
  }
  const cmlb = cumulativeSum(shiftedCmla);

  const srcSq = closePrices.map((v) => v * v);
  const cmlc = cumulativeSum(srcSq);

  // Find best period
  let bestR2 = 0;
  let bestP = config.minPeriod;
  const maxP = Math.min(config.maxPeriod, n);

  for (let p = config.minPeriod; p <= maxP; p++) {
    const r2 = computeR2(cmla, cmlb, cmlc, n, p);
    if (r2 > bestR2) {
      bestR2 = r2;
      bestP = p;
    }
  }

  const p = bestP;
  if (p <= 0) return null;

  // Compute regression line endpoints
  const den = p * (p + 1) / 2;
  const sumP = cs(cmlb, n) - cs(cmlb, n - p);
  const wma = (p * cs(cmla, n) - sumP) / den;
  const sma = (cs(cmla, n) - cs(cmla, n - p)) / p;
  const A = 4 * sma - 3 * wma;  // start value
  const B = 3 * wma - 2 * sma;  // end value

  // RMSE
  const cVal = cs(cmlc, n) - cs(cmlc, n - p);
  const bVal = cs(cmla, n) - cs(cmla, n - p);
  const variance = cVal / p - Math.pow(bVal / p, 2);
  const r2AtBest = computeR2(cmla, cmlb, cmlc, n, p);
  const rmse = Math.sqrt(Math.max(0, variance - r2AtBest * variance)) * config.mult;

  // Pearson correlation
  let pearson = Math.sqrt(r2AtBest);
  if (B - A < 0) pearson = -pearson;

  // Extend line: slope per bar
  const slope = (B - A) / (p - 1 || 1);
  // rmse before mult (raw) for forecast calculations
  const rmseRaw = Math.sqrt(Math.max(0, variance - r2AtBest * variance));
  const forwardBars = 50; // project 50 bars ahead
  const extMid = B + slope * forwardBars;
  const extUpper = extMid + rmse;
  const extLower = extMid - rmse;

  return {
    id: config.id,
    period: p,
    pearson,
    startIdx: n - p + 1,
    endIdx: n,
    startUpper: A + rmse,
    endUpper: B + rmse,
    startLower: A - rmse,
    endLower: B - rmse,
    startMid: A,
    endMid: B,
    slope,
    rmse: rmseRaw,
    extendedUpper: extUpper,
    extendedLower: extLower,
    extendedMid: extMid,
  };
}

/**
 * Compute all 4 regression channels from close prices.
 */
export function computeAllChannels(
  closePrices: number[],
  configs: ChannelConfig[] = DEFAULT_CHANNELS,
): ChannelResult[] {
  const results: ChannelResult[] = [];
  for (const cfg of configs) {
    const ch = computeChannel(closePrices, cfg);
    if (ch) results.push(ch);
  }
  return results;
}
