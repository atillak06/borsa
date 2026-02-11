/**
 * Frontend metadata registry for backend indicators.
 * Must match indicator names in backend/indicators.py INDICATOR_REGISTRY.
 *
 * To add a new indicator:
 *   1. Add the class in backend/indicators.py
 *   2. Add a meta entry here
 *   → Table + charts auto-update.
 */

export interface IndicatorMeta {
  name: string;         // backend key prefix: "williams_r"
  label: string;        // display label: "Williams %R"
  scoreKey: string;     // "williams_r_score"
  signalKey: string;    // "williams_r_signal"
  detailKeys: string[]; // extra columns to show
}

const INDICATOR_META: IndicatorMeta[] = [
  {
    name: 'williams_r',
    label: 'Williams %R',
    scoreKey: 'williams_r_score',
    signalKey: 'williams_r_signal',
    detailKeys: ['williams_r_wr_last', 'williams_r_ema_last'],
  },
  {
    name: 'nizami_cedid',
    label: '3. Selim',
    scoreKey: 'nizami_cedid_score',
    signalKey: 'nizami_cedid_signal',
    detailKeys: ['nizami_cedid_hist', 'nizami_cedid_kondisyon'],
  },
  {
    name: 'matlrns',
    label: 'MATLRNS',
    scoreKey: 'matlrns_score',
    signalKey: 'matlrns_signal',
    detailKeys: ['matlrns_direction'],
  },
  {
    name: 'pearson_ch3',
    label: 'Pearson 21-34',
    scoreKey: 'pearson_ch3_score',
    signalKey: 'pearson_ch3_signal',
    detailKeys: ['pearson_ch3_pearson', 'pearson_ch3_slope', 'pearson_ch3_period'],
  },
  {
    name: 'pearson_ch1',
    label: 'Pearson 55-89',
    scoreKey: 'pearson_ch1_score',
    signalKey: 'pearson_ch1_signal',
    detailKeys: ['pearson_ch1_pearson', 'pearson_ch1_slope', 'pearson_ch1_period'],
  },
  {
    name: 'pearson_ch2',
    label: 'Pearson 144-233',
    scoreKey: 'pearson_ch2_score',
    signalKey: 'pearson_ch2_signal',
    detailKeys: ['pearson_ch2_pearson', 'pearson_ch2_slope', 'pearson_ch2_period'],
  },
  {
    name: 'pearson_ch4',
    label: 'Pearson 377-610',
    scoreKey: 'pearson_ch4_score',
    signalKey: 'pearson_ch4_signal',
    detailKeys: ['pearson_ch4_pearson', 'pearson_ch4_slope', 'pearson_ch4_period'],
  },
  {
    name: 'ema_trend',
    label: 'EMA Trend',
    scoreKey: 'ema_trend_score',
    signalKey: 'ema_trend_signal',
    detailKeys: ['ema_trend_ema21', 'ema_trend_ema55', 'ema_trend_ema144'],
  },
];

export default INDICATOR_META;

/** All pearson indicator names */
export const PEARSON_INDICATORS = INDICATOR_META.filter((m) => m.name.startsWith('pearson_'));

/** Map a backend detail key to a human-readable label */
export function detailLabel(key: string): string {
  const map: Record<string, string> = {
    williams_r_wr_last: 'WR',
    williams_r_ema_last: 'WR EMA',
    nizami_cedid_hist: 'Histogram',
    nizami_cedid_kondisyon: 'Kondisyon',
    nizami_cedid_deltaMACEMAC: 'Delta',
    nizami_cedid_macd: 'MACD',
    matlrns_direction: 'Yon',
    pearson_ch3_pearson: 'Pearson',
    pearson_ch3_slope: 'Egim',
    pearson_ch3_period: 'Periyot',
    pearson_ch1_pearson: 'Pearson',
    pearson_ch1_slope: 'Egim',
    pearson_ch1_period: 'Periyot',
    pearson_ch2_pearson: 'Pearson',
    pearson_ch2_slope: 'Egim',
    pearson_ch2_period: 'Periyot',
    pearson_ch4_pearson: 'Pearson',
    pearson_ch4_slope: 'Egim',
    pearson_ch4_period: 'Periyot',
    ema_trend_ema21: 'EMA21',
    ema_trend_ema55: 'EMA55',
    ema_trend_ema144: 'EMA144',
  };
  return map[key] ?? key;
}
