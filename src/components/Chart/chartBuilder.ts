import * as echarts from 'echarts';
import type { OHLCVData } from '../../api/borsaApi';
import type { Interval } from './types';
import { isIntraday } from './types';
import { formatPrice, formatVolume } from '../../utils/formatters';
import { computeAllBollingerOverlays, DEFAULT_BOLLINGER_CONFIGS } from '../../utils/regressionChannels';
import {
  computeRSI,
  computeMACD,
  computeStochRSI,
  computeOBV,
  computeSuperTrend,
  computeIchimoku,
  computeBollingerBands,
} from '../../utils/indicators';
import type { SignalConfig, SignalEvent } from '../../utils/signalDetection';

interface SignalPoint {
  value: [number, number];
}

export const UP_COLOR = '#26a69a';
export const DOWN_COLOR = '#ef5350';

export interface ThemeColors {
  bg: string;
  border: string;
  text: string;
  tooltipBg: string;
  tooltipText: string;
  pointerLine: string;
  sliderBg: string;
}

export function getThemeColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--chart-bg', '#0a0e17'),
    border: v('--border-primary', '#1a1e2e'),
    text: v('--text-muted', '#8a8e96'),
    tooltipBg: v('--highlight-bg', '#1e222d'),
    tooltipText: v('--text-primary', '#c8ccd4'),
    pointerLine: v('--text-muted', '#555'),
    sliderBg: v('--bg-secondary', '#0f1320'),
  };
}

const EMPTY_OHLC = ['-', '-', '-', '-'];
const EMPTY_VOL = { value: 0, itemStyle: { color: 'transparent' } };

export function getPaddingCount(dataLen: number, intradayMode = false): number {
  if (intradayMode) return Math.min(40, Math.max(20, Math.floor(dataLen * 0.1)));
  return Math.min(200, Math.max(50, Math.floor(dataLen * 0.2)));
}

function generateFutureDates(lastDate: string, count: number): string[] {
  const result: string[] = [];
  if (!lastDate) return new Array(count).fill('');
  // Handle intraday dates like "2024-01-15 09:30"
  const hasTime = lastDate.includes(' ');
  const dateForParse = hasTime ? lastDate.replace(' ', 'T') + ':00' : lastDate + 'T00:00:00';
  const d = new Date(dateForParse);
  if (isNaN(d.getTime())) return new Array(count).fill('');
  for (let i = 1; i <= count; i++) {
    const next = new Date(d);
    if (hasTime) {
      next.setMinutes(d.getMinutes() + i * 5);
    } else {
      next.setDate(d.getDate() + i);
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
    }
    d.setTime(next.getTime());
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, '0');
    const dd = String(next.getDate()).padStart(2, '0');
    if (hasTime) {
      const hh = String(next.getHours()).padStart(2, '0');
      const min = String(next.getMinutes()).padStart(2, '0');
      result.push(`${yyyy}-${mm}-${dd} ${hh}:${min}`);
    } else {
      result.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return result;
}

export function addPadding(
  dates: string[],
  ohlcArr: unknown[],
  volumeArr: unknown[],
  closeArr: (number | null)[],
  intradayMode = false,
) {
  const pad = getPaddingCount(dates.length, intradayMode);
  const padBefore = new Array(pad).fill('');
  const lastDate = dates.length > 0 ? dates[dates.length - 1] : '';
  const padAfter = generateFutureDates(lastDate, pad);

  return {
    dates: [...padBefore, ...dates, ...padAfter],
    ohlc: [...new Array(pad).fill(EMPTY_OHLC), ...ohlcArr, ...new Array(pad).fill(EMPTY_OHLC)],
    volumes: [...new Array(pad).fill(EMPTY_VOL), ...volumeArr, ...new Array(pad).fill(EMPTY_VOL)],
    close: [...new Array(pad).fill(null), ...closeArr, ...new Array(pad).fill(null)],
    offset: pad,
  };
}

export function buildOption(
  filtered: OHLCVData[],
  symbol: string,
  showBollinger = false,
  visibleBollinger?: Set<string>,
  showRSI = false,
  showMACD = false,
  showStochRSI = false,
  logScale = false,
  theme?: ThemeColors,
  signalEvents?: SignalEvent[],
  sigConfig?: SignalConfig,
  showSuperTrend = false,
  showIchimoku = false,
  showOBV = false,
  interval?: Interval,
): echarts.EChartsOption {
  const tc = theme ?? getThemeColors();
  const intradayMode = interval ? isIntraday(interval) : false;
  const rawDates = filtered.map((d) => d.date);
  const rawOhlc = filtered.map((d) => [d.open, d.close, d.low, d.high]);
  const rawVolumes = filtered.map((d) => ({
    value: d.volume,
    itemStyle: {
      color: d.close >= d.open ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)',
    },
  }));

  const padded = addPadding(rawDates, rawOhlc, rawVolumes, [], intradayMode);
  const dates = padded.dates;
  const ohlc = padded.ohlc;
  const volumes = padded.volumes;

  const total = dates.length;
  const dataTotal = filtered.length;
  const dataEnd = padded.offset + dataTotal;
  const rightPadBars = 120;
  const visibleEnd = Math.min(dataEnd + rightPadBars, total);
  const dataStart = Math.max(padded.offset, visibleEnd - 120 - rightPadBars);
  const zoomStart = (dataStart / total) * 100;
  const zoomEnd = (visibleEnd / total) * 100;

  const lastClose = filtered.length > 0 ? filtered[filtered.length - 1].close : null;
  const lastOpen = filtered.length > 0 ? filtered[filtered.length - 1].open : null;
  const lastPriceColor =
    lastClose !== null && lastOpen !== null ? (lastClose >= lastOpen ? UP_COLOR : DOWN_COLOR) : tc.text;

  const mainSeries: echarts.SeriesOption = {
    name: symbol,
    type: 'candlestick' as const,
    data: ohlc,
    itemStyle: {
      color: UP_COLOR,
      color0: DOWN_COLOR,
      borderColor: UP_COLOR,
      borderColor0: DOWN_COLOR,
    },
    markLine:
      lastClose !== null
        ? {
            silent: true,
            symbol: 'none',
            lineStyle: { color: lastPriceColor, type: 'dashed', width: 1 },
            label: {
              show: true,
              position: 'end',
              formatter: () => formatPrice(lastClose),
              backgroundColor: lastPriceColor,
              color: '#fff',
              fontSize: 10,
              padding: [2, 4],
              borderRadius: 2,
            },
            data: [{ yAxis: lastClose }],
          }
        : undefined,
  };

  const maxVol = filtered.reduce((m, d) => Math.max(m, d.volume), 0);
  const volAxisMax = maxVol * 10;

  // --- Dynamic panel layout ---
  const panelHeight = 120;
  const subPanels: string[] = [];
  if (showRSI) subPanels.push('rsi');
  if (showMACD) subPanels.push('macd');
  if (showStochRSI) subPanels.push('stochRsi');
  if (showOBV) subPanels.push('obv');
  const hasSubPanels = subPanels.length > 0;

  const panelBottoms: number[] = [];
  for (let i = 0; i < subPanels.length; i++) {
    panelBottoms.push(40 + i * (panelHeight + 10));
  }
  const mainBottom = hasSubPanels ? panelBottoms[panelBottoms.length - 1] + panelHeight + 20 : 50;

  const grids: echarts.GridComponentOption[] = [{ left: 80, right: 80, top: 20, bottom: mainBottom }];
  for (let i = 0; i < subPanels.length; i++) {
    grids.push({ left: 80, right: 80, bottom: panelBottoms[i], height: panelHeight });
  }

  const allXAxisIndices = Array.from({ length: 1 + subPanels.length }, (_, i) => i);
  // Intraday xAxis label formatter
  const intradayLabelFormatter = intradayMode
    ? (value: string) => {
        if (!value || !value.includes(' ')) return value;
        const timePart = value.split(' ')[1]; // "HH:mm"
        if (interval === '1h') {
          // Show DD/MM HH:mm
          const datePart = value.split(' ')[0]; // "YYYY-MM-DD"
          const parts = datePart.split('-');
          return `${parts[2]}/${parts[1]} ${timePart}`;
        }
        return timePart; // 1m/5m/15m/30m → just "HH:mm"
      }
    : undefined;

  const xAxes: echarts.XAXisComponentOption[] = [
    {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: tc.border } },
      axisLabel: {
        color: tc.text,
        fontSize: 11,
        ...(intradayLabelFormatter ? { formatter: intradayLabelFormatter } : {}),
      },
      splitLine: { show: false },
      axisTick: { show: false },
      gridIndex: 0,
      axisPointer: {
        show: true,
        type: 'line',
        lineStyle: { color: tc.pointerLine, type: 'dashed' },
        label: { show: !hasSubPanels, backgroundColor: tc.tooltipBg, color: tc.tooltipText },
      },
    },
  ];
  for (let i = 0; i < subPanels.length; i++) {
    const isBottom = i === 0;
    xAxes.push({
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: tc.border } },
      axisLabel: isBottom
        ? { color: tc.text, fontSize: 10, ...(intradayLabelFormatter ? { formatter: intradayLabelFormatter } : {}) }
        : { show: false },
      splitLine: { show: false },
      axisTick: { show: false },
      gridIndex: i + 1,
      axisPointer: {
        show: true,
        type: 'line',
        lineStyle: { color: tc.pointerLine, type: 'dashed' },
        label: isBottom ? { backgroundColor: tc.tooltipBg, color: tc.tooltipText } : { show: false },
      },
    });
  }

  const yAxes: echarts.YAXisComponentOption[] = [
    {
      type: logScale ? 'log' : 'value',
      scale: true,
      gridIndex: 0,
      position: 'right',
      splitLine: { lineStyle: { color: tc.border } },
      axisLine: { lineStyle: { color: tc.border } },
      axisLabel: { color: tc.text, fontSize: 11, formatter: (v: number) => formatPrice(v) },
      axisPointer: {
        show: true,
        type: 'line',
        lineStyle: { color: tc.pointerLine, type: 'dashed' },
        label: { backgroundColor: tc.tooltipBg, color: tc.tooltipText },
      },
    },
    {
      gridIndex: 0,
      position: 'left',
      min: 0,
      max: volAxisMax,
      splitNumber: 3,
      interval: maxVol > 0 ? maxVol / 2 : undefined,
      splitLine: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: tc.text,
        fontSize: 10,
        formatter: (v: number) => {
          if (v === 0 || v > maxVol) return '';
          return formatVolume(v);
        },
      },
      axisTick: { show: false },
      axisPointer: { show: false },
    },
  ];

  const panelYAxisIdx: Record<string, number> = {};

  for (let i = 0; i < subPanels.length; i++) {
    const yIdx = 2 + i;
    panelYAxisIdx[subPanels[i]] = yIdx;
    const gridIdx = i + 1;

    if (subPanels[i] === 'rsi') {
      yAxes.push({
        gridIndex: gridIdx,
        position: 'right',
        min: 0,
        max: 100,
        splitNumber: 2,
        splitLine: { lineStyle: { color: tc.border } },
        axisLine: { lineStyle: { color: tc.border } },
        axisLabel: { color: tc.text, fontSize: 10, formatter: (v: number) => `${v}` },
        axisPointer: {
          show: true,
          type: 'line',
          lineStyle: { color: tc.pointerLine, type: 'dashed' },
          label: { backgroundColor: tc.tooltipBg, color: tc.tooltipText },
        },
      } as echarts.YAXisComponentOption);
    } else if (subPanels[i] === 'macd' || subPanels[i] === 'obv') {
      yAxes.push({
        gridIndex: gridIdx,
        position: 'right',
        scale: true,
        splitNumber: 3,
        splitLine: { lineStyle: { color: tc.border } },
        axisLine: { lineStyle: { color: tc.border } },
        axisLabel: { color: tc.text, fontSize: 10 },
        axisPointer: {
          show: true,
          type: 'line',
          lineStyle: { color: tc.pointerLine, type: 'dashed' },
          label: { backgroundColor: tc.tooltipBg, color: tc.tooltipText },
        },
      } as echarts.YAXisComponentOption);
    } else if (subPanels[i] === 'stochRsi') {
      yAxes.push({
        gridIndex: gridIdx,
        position: 'right',
        min: 0,
        max: 100,
        splitNumber: 2,
        splitLine: { lineStyle: { color: tc.border } },
        axisLine: { lineStyle: { color: tc.border } },
        axisLabel: { color: tc.text, fontSize: 10, formatter: (v: number) => `${v}` },
        axisPointer: {
          show: true,
          type: 'line',
          lineStyle: { color: tc.pointerLine, type: 'dashed' },
          label: { backgroundColor: tc.tooltipBg, color: tc.tooltipText },
        },
      } as echarts.YAXisComponentOption);
    }
  }

  // --- Sub panel series ---
  const subSeries: echarts.SeriesOption[] = [];
  const pad = getPaddingCount(filtered.length, intradayMode);
  const padNull = new Array(pad).fill(null);

  // RSI sub panel
  if (showRSI && filtered.length > 15) {
    const rsiGridIdx = subPanels.indexOf('rsi') + 1;
    const rsiYIdx = panelYAxisIdx['rsi'];
    const closes = filtered.map((d) => d.close);
    const rsiPeriod = sigConfig?.rsi?.period ?? 14;
    const rsiResult = computeRSI(closes, rsiPeriod);
    const rsiPadded = [...padNull, ...rsiResult.rsi, ...padNull];

    const oversold = sigConfig?.rsi?.oversold ?? 30;
    const overbought = sigConfig?.rsi?.overbought ?? 70;

    subSeries.push({
      name: 'RSI',
      type: 'line',
      data: rsiPadded,
      xAxisIndex: rsiGridIdx,
      yAxisIndex: rsiYIdx,
      showSymbol: false,
      lineStyle: { color: '#E040FB', width: 2 },
      z: 5,
      tooltip: { show: false },
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          {
            yAxis: overbought,
            lineStyle: { color: 'rgba(239,83,80,0.6)', type: 'dashed' as const, width: 1 },
            label: {
              show: true,
              position: 'insideEndTop' as const,
              formatter: `${overbought}`,
              fontSize: 9,
              color: '#ef5350',
            },
          },
          {
            yAxis: oversold,
            lineStyle: { color: 'rgba(38,166,154,0.6)', type: 'dashed' as const, width: 1 },
            label: {
              show: true,
              position: 'insideEndBottom' as const,
              formatter: `${oversold}`,
              fontSize: 9,
              color: '#26a69a',
            },
          },
          { yAxis: 50, lineStyle: { color: 'rgba(255,193,7,0.4)', type: 'dotted' as const, width: 1 } },
        ],
      },
      markArea: {
        silent: true,
        data: [
          [{ yAxis: overbought, itemStyle: { color: 'rgba(239,83,80,0.06)' } }, { yAxis: 100 }],
          [{ yAxis: 0, itemStyle: { color: 'rgba(38,166,154,0.06)' } }, { yAxis: oversold }],
        ] as unknown as echarts.MarkAreaComponentOption['data'],
      },
    });
  }

  // MACD sub panel
  if (showMACD && filtered.length > 35) {
    const macdGridIdx = subPanels.indexOf('macd') + 1;
    const macdYIdx = panelYAxisIdx['macd'];
    const closes = filtered.map((d) => d.close);
    const fast = sigConfig?.macd?.fast ?? 12;
    const slow = sigConfig?.macd?.slow ?? 26;
    const sigPeriod = sigConfig?.macd?.signalPeriod ?? 9;
    const macdResult = computeMACD(closes, fast, slow, sigPeriod);

    const macdPadded = [...padNull, ...macdResult.macd, ...padNull];
    const signalPadded = [...padNull, ...macdResult.signal, ...padNull];
    const histPadded = [...padNull, ...macdResult.histogram, ...padNull];

    // Histogram with color
    const histColored = histPadded.map((val: number | null, idx: number) => {
      if (val === null) return { value: null };
      const prev = idx > 0 ? histPadded[idx - 1] : null;
      let color: string;
      if (val >= 0) {
        color = prev !== null && prev < val ? '#26A69A' : '#B2DFDB';
      } else {
        color = prev !== null && prev < val ? '#FFCDD2' : '#FF5252';
      }
      return { value: val, itemStyle: { color } };
    });

    subSeries.push(
      {
        name: 'MACD Hist',
        type: 'bar',
        data: histColored,
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdYIdx,
        barWidth: '60%',
        z: 1,
        tooltip: { show: false },
      },
      {
        name: 'MACD',
        type: 'line',
        data: macdPadded,
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdYIdx,
        showSymbol: false,
        lineStyle: { color: '#2196F3', width: 2 },
        z: 5,
        tooltip: { show: false },
      },
      {
        name: 'Signal',
        type: 'line',
        data: signalPadded,
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdYIdx,
        showSymbol: false,
        lineStyle: { color: '#FF6D00', width: 2 },
        z: 5,
        tooltip: { show: false },
      },
      {
        name: 'MACD Zero',
        type: 'line',
        data: new Array(total).fill(0),
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdYIdx,
        showSymbol: false,
        lineStyle: { color: '#787B86', width: 1, type: 'dashed' },
        z: 2,
        silent: true,
        tooltip: { show: false },
      },
    );
  }

  // Stochastic RSI sub panel
  if (showStochRSI && filtered.length > 30) {
    const srGridIdx = subPanels.indexOf('stochRsi') + 1;
    const srYIdx = panelYAxisIdx['stochRsi'];
    const closes = filtered.map((d) => d.close);
    const rsiP = sigConfig?.stochRsi?.rsiPeriod ?? 14;
    const stochP = sigConfig?.stochRsi?.stochPeriod ?? 14;
    const kS = sigConfig?.stochRsi?.kSmooth ?? 3;
    const dS = sigConfig?.stochRsi?.dSmooth ?? 3;
    const srResult = computeStochRSI(closes, rsiP, stochP, kS, dS);

    const kPadded = [...padNull, ...srResult.k, ...padNull];
    const dPadded = [...padNull, ...srResult.d, ...padNull];

    subSeries.push(
      {
        name: '%K',
        type: 'line',
        data: kPadded,
        xAxisIndex: srGridIdx,
        yAxisIndex: srYIdx,
        showSymbol: false,
        lineStyle: { color: '#2196F3', width: 2 },
        z: 5,
        tooltip: { show: false },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            { yAxis: 80, lineStyle: { color: 'rgba(239,83,80,0.6)', type: 'dashed' as const, width: 1 } },
            { yAxis: 20, lineStyle: { color: 'rgba(38,166,154,0.6)', type: 'dashed' as const, width: 1 } },
          ],
        },
        markArea: {
          silent: true,
          data: [
            [{ yAxis: 80, itemStyle: { color: 'rgba(239,83,80,0.06)' } }, { yAxis: 100 }],
            [{ yAxis: 0, itemStyle: { color: 'rgba(38,166,154,0.06)' } }, { yAxis: 20 }],
          ] as unknown as echarts.MarkAreaComponentOption['data'],
        },
      },
      {
        name: '%D',
        type: 'line',
        data: dPadded,
        xAxisIndex: srGridIdx,
        yAxisIndex: srYIdx,
        showSymbol: false,
        lineStyle: { color: '#FF6D00', width: 2 },
        z: 5,
        tooltip: { show: false },
      },
    );
  }

  // OBV sub panel
  if (showOBV && filtered.length > 20) {
    const obvGridIdx = subPanels.indexOf('obv') + 1;
    const obvYIdx = panelYAxisIdx['obv'];
    const closes = filtered.map((d) => d.close);
    const vols = filtered.map((d) => d.volume);
    const emaPeriod = sigConfig?.obv?.emaPeriod ?? 20;
    const obvResult = computeOBV(closes, vols, emaPeriod);

    const obvPadded = [...padNull, ...obvResult.obv, ...padNull];
    const obvEmaPadded = [...padNull, ...obvResult.obvEma, ...padNull];

    subSeries.push(
      {
        name: 'OBV',
        type: 'line',
        data: obvPadded,
        xAxisIndex: obvGridIdx,
        yAxisIndex: obvYIdx,
        showSymbol: false,
        lineStyle: { color: '#26a69a', width: 2 },
        z: 5,
        tooltip: { show: false },
      },
      {
        name: 'OBV EMA',
        type: 'line',
        data: obvEmaPadded,
        xAxisIndex: obvGridIdx,
        yAxisIndex: obvYIdx,
        showSymbol: false,
        lineStyle: { color: '#FF6D00', width: 2 },
        z: 5,
        tooltip: { show: false },
      },
    );
  }

  return {
    animation: false,
    backgroundColor: tc.bg,
    grid: grids,
    xAxis: xAxes as echarts.EChartsOption['xAxis'],
    yAxis: yAxes as echarts.EChartsOption['yAxis'],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: allXAxisIndices,
        start: zoomStart,
        end: zoomEnd,
        zoomOnMouseWheel: true,
        moveOnMouseMove: false,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: false,
      },
      {
        type: 'slider',
        xAxisIndex: allXAxisIndices,
        start: zoomStart,
        end: zoomEnd,
        bottom: 8,
        height: 20,
        borderColor: tc.border,
        backgroundColor: tc.sliderBg,
        dataBackground: { lineStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' } },
        selectedDataBackground: { lineStyle: { color: 'transparent' }, areaStyle: { color: 'rgba(41,98,255,0.08)' } },
        fillerColor: 'rgba(41,98,255,0.15)',
        handleStyle: { color: '#404555', borderColor: '#606580' },
        textStyle: { color: tc.text, fontSize: 10 },
      },
    ],
    tooltip: { show: false },
    axisPointer: {
      show: true,
      link: [{ xAxisIndex: allXAxisIndices }],
      label: { backgroundColor: tc.tooltipBg, color: tc.tooltipText },
    },
    series: [
      { ...mainSeries, xAxisIndex: 0, yAxisIndex: 0 },
      {
        name: 'Volume',
        type: 'bar',
        data: volumes,
        xAxisIndex: 0,
        yAxisIndex: 1,
        barWidth: '60%',
        z: 1,
        tooltip: { show: false },
      },
      // ── Bollinger Bands overlay ──
      ...(showBollinger
        ? (() => {
            const closePrices = filtered.map((d) => d.close);
            const overlays = computeAllBollingerOverlays(closePrices);
            const vis = visibleBollinger ?? new Set(overlays.map((o) => o.id));
            const series: echarts.SeriesOption[] = [];
            for (const ov of overlays) {
              if (!vis.has(ov.id)) continue;
              const cfg = DEFAULT_BOLLINGER_CONFIGS.find((c) => c.id === ov.id);
              if (!cfg) continue;
              const upperPadded = [...padNull, ...ov.upper, ...padNull];
              const middlePadded = [...padNull, ...ov.middle, ...padNull];
              const lowerPadded = [...padNull, ...ov.lower, ...padNull];
              series.push(
                {
                  name: `${cfg.label} Ust`,
                  type: 'line',
                  data: upperPadded,
                  xAxisIndex: 0,
                  yAxisIndex: 0,
                  showSymbol: false,
                  lineStyle: { color: cfg.bandColor, width: cfg.width },
                  silent: true,
                  z: 5,
                  connectNulls: false,
                  tooltip: { show: false },
                },
                {
                  name: `${cfg.label} Orta`,
                  type: 'line',
                  data: middlePadded,
                  xAxisIndex: 0,
                  yAxisIndex: 0,
                  showSymbol: false,
                  lineStyle: { color: cfg.color, width: 1, type: 'dashed' },
                  silent: true,
                  z: 5,
                  connectNulls: false,
                  tooltip: { show: false },
                },
                {
                  name: `${cfg.label} Alt`,
                  type: 'line',
                  data: lowerPadded,
                  xAxisIndex: 0,
                  yAxisIndex: 0,
                  showSymbol: false,
                  lineStyle: { color: cfg.bandColor, width: cfg.width },
                  silent: true,
                  z: 5,
                  connectNulls: false,
                  tooltip: { show: false },
                },
              );
            }
            return series;
          })()
        : []),
      // ── SuperTrend overlay ──
      ...(showSuperTrend && filtered.length > 11
        ? (() => {
            const highs = filtered.map((d) => d.high);
            const lows = filtered.map((d) => d.low);
            const closes = filtered.map((d) => d.close);
            const atrP = sigConfig?.supertrend?.atrPeriod ?? 10;
            const mult = sigConfig?.supertrend?.multiplier ?? 3.0;
            const st = computeSuperTrend(highs, lows, closes, atrP, mult);

            const upData: (number | null)[] = new Array(total).fill(null);
            const dnData: (number | null)[] = new Array(total).fill(null);

            for (let i = 0; i < st.supertrend.length; i++) {
              if (st.supertrend[i] === null) continue;
              const idx = pad + i;
              if (idx >= 0 && idx < total) {
                if (st.direction[i] === 1) upData[idx] = st.supertrend[i];
                else dnData[idx] = st.supertrend[i];
                // Bridge for color continuity
                if (i > 0 && st.direction[i] !== st.direction[i - 1] && st.supertrend[i - 1] !== null) {
                  const prevIdx = pad + i - 1;
                  if (st.direction[i] === 1) upData[prevIdx] = st.supertrend[i - 1];
                  else dnData[prevIdx] = st.supertrend[i - 1];
                  if (st.direction[i - 1] === 1) upData[idx] = st.supertrend[i];
                  else dnData[idx] = st.supertrend[i];
                }
              }
            }

            return [
              {
                name: 'ST Up',
                type: 'line' as const,
                data: upData,
                xAxisIndex: 0,
                yAxisIndex: 0,
                showSymbol: false,
                lineStyle: { color: UP_COLOR, width: 2 },
                connectNulls: false,
                z: 4,
                silent: true,
                tooltip: { show: false },
              },
              {
                name: 'ST Down',
                type: 'line' as const,
                data: dnData,
                xAxisIndex: 0,
                yAxisIndex: 0,
                showSymbol: false,
                lineStyle: { color: DOWN_COLOR, width: 2 },
                connectNulls: false,
                z: 4,
                silent: true,
                tooltip: { show: false },
              },
            ] as echarts.SeriesOption[];
          })()
        : []),
      // ── Ichimoku Cloud overlay ──
      ...(showIchimoku && filtered.length > 52
        ? (() => {
            const highs = filtered.map((d) => d.high);
            const lows = filtered.map((d) => d.low);
            const closes = filtered.map((d) => d.close);
            const tP = sigConfig?.ichimoku?.tenkan ?? 9;
            const kP = sigConfig?.ichimoku?.kijun ?? 26;
            const sP = sigConfig?.ichimoku?.senkouB ?? 52;
            const ich = computeIchimoku(highs, lows, closes, tP, kP, sP);

            const tenkanPadded = [...padNull, ...ich.tenkan, ...padNull];
            const kijunPadded = [...padNull, ...ich.kijun, ...padNull];
            const senkouAPadded = [...padNull, ...ich.senkouA, ...padNull];
            const senkouBPadded = [...padNull, ...ich.senkouB, ...padNull];

            // Cloud fill: use stacked area between Span A and Span B
            const cloudLower: (number | null)[] = new Array(total).fill(null);
            const cloudWidth: (number | null)[] = new Array(total).fill(null);

            for (let i = 0; i < total; i++) {
              const sa = senkouAPadded[i];
              const sb = senkouBPadded[i];
              if (sa !== null && sb !== null) {
                cloudLower[i] = Math.min(sa, sb);
                cloudWidth[i] = Math.abs(sa - sb);
              }
            }

            return [
              {
                name: 'Tenkan',
                type: 'line' as const,
                data: tenkanPadded,
                xAxisIndex: 0,
                yAxisIndex: 0,
                showSymbol: false,
                lineStyle: { color: '#2196F3', width: 1.5 },
                z: 5,
                silent: true,
                tooltip: { show: false },
              },
              {
                name: 'Kijun',
                type: 'line' as const,
                data: kijunPadded,
                xAxisIndex: 0,
                yAxisIndex: 0,
                showSymbol: false,
                lineStyle: { color: '#ef5350', width: 1.5 },
                z: 5,
                silent: true,
                tooltip: { show: false },
              },
              {
                name: 'Cloud Base',
                type: 'line' as const,
                data: cloudLower,
                stack: 'ichCloud',
                xAxisIndex: 0,
                yAxisIndex: 0,
                showSymbol: false,
                lineStyle: { width: 0 },
                areaStyle: { color: 'transparent' },
                connectNulls: false,
                z: 2,
                silent: true,
                tooltip: { show: false },
              },
              {
                name: 'Cloud Fill',
                type: 'line' as const,
                data: cloudWidth,
                stack: 'ichCloud',
                xAxisIndex: 0,
                yAxisIndex: 0,
                showSymbol: false,
                lineStyle: { width: 0 },
                areaStyle: { color: 'rgba(76,175,80,0.15)' },
                connectNulls: false,
                z: 2,
                silent: true,
                tooltip: { show: false },
              },
            ] as echarts.SeriesOption[];
          })()
        : []),
      // ── Signal scatter markers (4-directional) ──
      ...(signalEvents && signalEvents.length > 0
        ? (() => {
            const pad = getPaddingCount(filtered.length, intradayMode);
            const longEntryPts: SignalPoint[] = [];
            const longExitPts: SignalPoint[] = [];
            const shortEntryPts: SignalPoint[] = [];
            const shortExitPts: SignalPoint[] = [];
            // Fallback: events without positionAction use old bullish/bearish logic
            const buyPoints: SignalPoint[] = [];
            const sellPoints: SignalPoint[] = [];
            for (const ev of signalEvents) {
              const catIdx = pad + ev.barIndex;
              if (catIdx >= 0 && catIdx < total) {
                const pt: SignalPoint = { value: [catIdx, ev.entryPrice] };
                if (ev.positionAction === 'long-entry') longEntryPts.push(pt);
                else if (ev.positionAction === 'long-exit') longExitPts.push(pt);
                else if (ev.positionAction === 'short-entry') shortEntryPts.push(pt);
                else if (ev.positionAction === 'short-exit') shortExitPts.push(pt);
                else if (ev.signalType === 'bullish') buyPoints.push(pt);
                else sellPoints.push(pt);
              }
            }
            const ORANGE = '#ff9800';
            const BLUE = '#2196F3';
            const series: echarts.SeriesOption[] = [];
            // Long Entry: green triangle up
            if (longEntryPts.length > 0 || buyPoints.length > 0)
              series.push({
                name: 'Uzun Giris',
                type: 'scatter' as const,
                data: [...longEntryPts, ...buyPoints],
                xAxisIndex: 0,
                yAxisIndex: 0,
                symbol: 'triangle',
                symbolSize: 14,
                symbolOffset: [0, 10],
                itemStyle: { color: UP_COLOR, borderColor: '#fff', borderWidth: 1 },
                z: 20,
                silent: true,
                tooltip: { show: false },
              });
            // Long Exit: red triangle down
            if (longExitPts.length > 0 || sellPoints.length > 0)
              series.push({
                name: 'Uzun Cikis',
                type: 'scatter' as const,
                data: [...longExitPts, ...sellPoints],
                xAxisIndex: 0,
                yAxisIndex: 0,
                symbol: 'path://M0,0 L10,0 L5,10 Z',
                symbolSize: 14,
                symbolOffset: [0, -10],
                itemStyle: { color: DOWN_COLOR, borderColor: '#fff', borderWidth: 1 },
                z: 20,
                silent: true,
                tooltip: { show: false },
              });
            // Short Entry: orange diamond
            if (shortEntryPts.length > 0)
              series.push({
                name: 'Kisa Giris',
                type: 'scatter' as const,
                data: shortEntryPts,
                xAxisIndex: 0,
                yAxisIndex: 0,
                symbol: 'diamond',
                symbolSize: 14,
                symbolOffset: [0, -10],
                itemStyle: { color: ORANGE, borderColor: '#fff', borderWidth: 1 },
                z: 20,
                silent: true,
                tooltip: { show: false },
              });
            // Short Exit: blue diamond
            if (shortExitPts.length > 0)
              series.push({
                name: 'Kisa Cikis',
                type: 'scatter' as const,
                data: shortExitPts,
                xAxisIndex: 0,
                yAxisIndex: 0,
                symbol: 'diamond',
                symbolSize: 14,
                symbolOffset: [0, 10],
                itemStyle: { color: BLUE, borderColor: '#fff', borderWidth: 1 },
                z: 20,
                silent: true,
                tooltip: { show: false },
              });
            return series;
          })()
        : []),
      ...subSeries,
    ],
  };
}
