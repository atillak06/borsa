/**
 * Teknik indikatörler — Williams %R + EMA
 *
 * Williams %R = 100 * (close - highest(length)) / (highest(length) - lowest(length))
 * EMA = üstel hareketli ortalama
 */

/** EMA hesapla */
function ema(src: (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(src.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;

  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v === null) continue;
    if (prev === null) {
      prev = v;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

/** Rolling highest high */
function highest(highs: number[], period: number, idx: number): number {
  let max = -Infinity;
  const start = Math.max(0, idx - period + 1);
  for (let i = start; i <= idx; i++) {
    if (highs[i] > max) max = highs[i];
  }
  return max;
}

/** Rolling lowest low */
function lowest(lows: number[], period: number, idx: number): number {
  let min = Infinity;
  const start = Math.max(0, idx - period + 1);
  for (let i = start; i <= idx; i++) {
    if (lows[i] < min) min = lows[i];
  }
  return min;
}

export interface WilliamsRResult {
  wr: (number | null)[];     // Williams %R values (-100 to 0)
  ema: (number | null)[];    // EMA of Williams %R
}

/**
 * Williams %R hesapla
 * @param highs - High fiyat dizisi
 * @param lows - Low fiyat dizisi
 * @param closes - Close fiyat dizisi
 * @param length - Periyot (varsayılan 21)
 * @param emaPeriod - EMA periyodu (varsayılan 13)
 */
export function computeWilliamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  length = 21,
  emaPeriod = 13,
): WilliamsRResult {
  const n = closes.length;
  const wr: (number | null)[] = new Array(n).fill(null);

  for (let i = length - 1; i < n; i++) {
    const upper = highest(highs, length, i);
    const lower = lowest(lows, length, i);
    const range = upper - lower;
    if (range === 0) {
      wr[i] = -50; // tam ortada — range yoksa
    } else {
      wr[i] = 100 * (closes[i] - upper) / range;
    }
  }

  const emaLine = ema(wr, emaPeriod);

  return { wr, ema: emaLine };
}

/**
 * VWMA (Volume Weighted Moving Average)
 * VWMA = sum(src * volume, period) / sum(volume, period)
 */
function vwma(src: (number | null)[], volumes: number[], period: number): (number | null)[] {
  const n = src.length;
  const out: (number | null)[] = new Array(n).fill(null);

  for (let i = period - 1; i < n; i++) {
    let sumSV = 0;
    let sumV = 0;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (src[j] === null) { valid = false; break; }
      sumSV += src[j]! * volumes[j];
      sumV += volumes[j];
    }
    if (valid && sumV > 0) {
      out[i] = sumSV / sumV;
    }
  }
  return out;
}

/**
 * NizamiCedid (3. Selim) indikatörü
 *
 * Pine Script karşılığı:
 * fast_ma = EMA(close, 120)
 * slow_ma = EMA(close, 260)
 * macd = fast_ma - slow_ma
 * signal = EMA(macd, 50)
 * hist = macd - signal
 * eMacD = VWMA(macd, 185)
 * deltaMACEMAC = macd - eMacD
 *
 * Tüm değerler fast_ma'ya bölünerek normalize edilir.
 * Arka plan: EMA(377) > EMA(610) → yeşil, değilse kırmızı
 */
export interface NizamiCedidResult {
  hist: (number | null)[];           // (macd - signal) / fast_ma
  macd: (number | null)[];           // macd / fast_ma
  signal: (number | null)[];         // signal / fast_ma
  eMacD: (number | null)[];          // VWMA(macd,185) / fast_ma
  deltaMACEMAC: (number | null)[];   // (macd - eMacD) / fast_ma
  kondisyon: (boolean | null)[];     // EMA(377) > EMA(610)
  // Raw hist for coloring (need hist[i] vs hist[i-1])
  histRaw: (number | null)[];        // macd - signal (unnormalized, for direction check)
}

export function computeNizamiCedid(
  closes: number[],
  volumes: number[],
): NizamiCedidResult {
  const n = closes.length;
  const closesN: (number | null)[] = closes.map(v => v as number | null);

  // EMA hesapla
  const fastMa = ema(closesN, 120);   // EMA(close, 120)
  const slowMa = ema(closesN, 260);   // EMA(close, 260)
  const ema377 = ema(closesN, 377);
  const ema610 = ema(closesN, 610);

  // MACD = fast_ma - slow_ma
  const macdRaw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (fastMa[i] !== null && slowMa[i] !== null) {
      macdRaw[i] = fastMa[i]! - slowMa[i]!;
    }
  }

  // Signal = EMA(macd, 50)
  const signalRaw = ema(macdRaw, 50);

  // Hist = macd - signal
  const histRaw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (macdRaw[i] !== null && signalRaw[i] !== null) {
      histRaw[i] = macdRaw[i]! - signalRaw[i]!;
    }
  }

  // eMacD = VWMA(macd, 185)
  const eMacDRaw = vwma(macdRaw, volumes, 185);

  // deltaMACEMAC = macd - eMacD
  const deltaRaw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (macdRaw[i] !== null && eMacDRaw[i] !== null) {
      deltaRaw[i] = macdRaw[i]! - eMacDRaw[i]!;
    }
  }

  // Normalize hepsi fast_ma'ya böl
  const hist: (number | null)[] = new Array(n).fill(null);
  const macdN: (number | null)[] = new Array(n).fill(null);
  const signalN: (number | null)[] = new Array(n).fill(null);
  const eMacDN: (number | null)[] = new Array(n).fill(null);
  const deltaN: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const fm = fastMa[i];
    if (fm === null || fm === 0) continue;
    if (histRaw[i] !== null) hist[i] = histRaw[i]! / fm;
    if (macdRaw[i] !== null) macdN[i] = macdRaw[i]! / fm;
    if (signalRaw[i] !== null) signalN[i] = signalRaw[i]! / fm;
    if (eMacDRaw[i] !== null) eMacDN[i] = eMacDRaw[i]! / fm;
    if (deltaRaw[i] !== null) deltaN[i] = deltaRaw[i]! / fm;
  }

  // Kondisyon: EMA(377) > EMA(610) → yeşil
  const kondisyon: (boolean | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (ema377[i] !== null && ema610[i] !== null) {
      kondisyon[i] = ema377[i]! > ema610[i]!;
    }
  }

  return {
    hist,
    macd: macdN,
    signal: signalN,
    eMacD: eMacDN,
    deltaMACEMAC: deltaN,
    kondisyon,
    histRaw,
  };
}

/**
 * MATLRNS — Overlay Moving Average Trend Indicator
 *
 * Pine Script karşılığı:
 * source = hlcc4
 * fastMA = EMA(source, 8)   // 8 gün (günlükte 8 bar)
 * slowMA = EMA(source, 21)  // 21 gün
 * tolerance = 9
 * fastD = quantize(change(fastMA, tolerance))
 * slowD = quantize(change(slowMA, tolerance))
 * D = fastDir + slowDir → renk: >0 yeşil, <0 kırmızı, 0 gri
 *
 * includePriceWarning: close < fastMA → fastDir min(-1), close > fastMA → fastDir max(+1)
 */
export interface MATLRNSResult {
  fastMA: (number | null)[];
  slowMA: (number | null)[];
  /** Per-bar direction value: +2 strong up, +1 up, 0 neutral, -1 down, -2 strong down */
  direction: (number | null)[];
}

export function computeMATLRNS(
  highs: number[],
  lows: number[],
  closes: number[],
  fastLen = 8,
  slowLen = 21,
  tolerance = 9,
  includePriceWarning = true,
): MATLRNSResult {
  const n = closes.length;

  // source = hlcc4 = (high + low + close + close) / 4
  const hlcc4: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    hlcc4[i] = (highs[i] + lows[i] + closes[i] + closes[i]) / 4;
  }

  const fastMA = ema(hlcc4, fastLen);
  const slowMA = ema(hlcc4, slowLen);

  // Quantize helper
  const quantize = (k: number): number => k > 0 ? 1 : k < 0 ? -1 : 0;

  // Direction computation per bar
  const direction: (number | null)[] = new Array(n).fill(null);

  for (let i = tolerance; i < n; i++) {
    if (fastMA[i] === null || slowMA[i] === null) continue;
    if (fastMA[i - tolerance] === null || slowMA[i - tolerance] === null) continue;

    // fastD = quantize(change(fastMA, tolerance))
    let fastDir = quantize(fastMA[i]! - fastMA[i - tolerance]!);
    const slowDir = quantize(slowMA[i]! - slowMA[i - tolerance]!);

    // Price warning: close vs fastMA
    if (includePriceWarning) {
      const closeP = closes[i] - fastMA[i]!;
      if (closeP < 0) {
        fastDir = Math.min(fastDir, -1);
      }
      if (closeP > 0) {
        fastDir = Math.max(fastDir, 1);
      }
    }

    direction[i] = fastDir + slowDir;
  }

  return { fastMA, slowMA, direction };
}
