import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as echarts from 'echarts';
import type { Interval, LegendData } from './types';
import type { OHLCVData } from '../../api/borsaApi';
import { createWebSocket } from '../../api/borsaApi';
import { formatPrice, formatVolume } from '../../utils/formatters';
import { computeAllChannels, computeForecastBand, DEFAULT_CHANNELS } from '../../utils/regressionChannels';
import type { ChannelResult } from '../../utils/regressionChannels';
import { computeWilliamsR, computeNizamiCedid, computeMATLRNS } from '../../utils/indicators';
import type { NizamiCedidResult } from '../../utils/indicators';
import './ChartContainer.css';

interface ChartContainerProps {
  data: OHLCVData[];
  symbol: string;
  interval: Interval;
  onLegendUpdate: (data: LegendData | null) => void;
  showChannels?: boolean;
  showWilliamsR?: boolean;
  showNizamiCedid?: boolean;
  showMATLRNS?: boolean;
  logScale?: boolean;
}

const UP_COLOR = '#26a69a';
const DOWN_COLOR = '#ef5350';
const BG_COLOR = '#0a0e17';
const BORDER_COLOR = '#1a1e2e';
const TEXT_COLOR = '#8a8e96';

// ECharts candlestick requires [open,close,low,high] — use '-' for empty
const EMPTY_OHLC = ['-', '-', '-', '-'];
const EMPTY_VOL = { value: 0, itemStyle: { color: 'transparent' } };

// Padding = data length so user can scroll an entire screen beyond data edges
function getPaddingCount(dataLen: number): number {
  return Math.max(200, dataLen);
}

function addPadding(
  dates: string[],
  ohlcArr: unknown[],
  volumeArr: unknown[],
  closeArr: (number | null)[],
) {
  const pad = getPaddingCount(dates.length);
  const padBefore = new Array(pad).fill('');
  const padAfter = new Array(pad).fill('');

  return {
    dates: [...padBefore, ...dates, ...padAfter],
    ohlc: [...new Array(pad).fill(EMPTY_OHLC), ...ohlcArr, ...new Array(pad).fill(EMPTY_OHLC)],
    volumes: [...new Array(pad).fill(EMPTY_VOL), ...volumeArr, ...new Array(pad).fill(EMPTY_VOL)],
    close: [...new Array(pad).fill(null), ...closeArr, ...new Array(pad).fill(null)],
    offset: pad,
  };
}

/**
 * Build channel line series for ECharts.
 * Each channel has 3 lines (upper, mid, lower) drawn as line series.
 * Lines extend beyond data into padding area to simulate extend=right.
 */
function buildChannelSeries(
  channels: ChannelResult[],
  dataLen: number,
  paddingOffset: number,
  totalLen: number,
): echarts.SeriesOption[] {
  const series: echarts.SeriesOption[] = [];
  const EXTEND_BARS = 200; // extend lines into right padding

  for (const ch of channels) {
    const cfg = DEFAULT_CHANNELS.find((c) => c.id === ch.id);
    if (!cfg) continue;

    // Compute slope per bar for extension
    const barCount = ch.endIdx - ch.startIdx;
    const slope = barCount > 0 ? (ch.endMid - ch.startMid) / barCount : 0;
    const slopeU = barCount > 0 ? (ch.endUpper - ch.startUpper) / barCount : 0;
    const slopeL = barCount > 0 ? (ch.endLower - ch.startLower) / barCount : 0;

    // Build data arrays — null everywhere except channel range + extension
    const upperData: (number | null)[] = new Array(totalLen).fill(null);
    const midData: (number | null)[] = new Array(totalLen).fill(null);
    const lowerData: (number | null)[] = new Array(totalLen).fill(null);

    // Fill channel range
    for (let i = 0; i <= barCount; i++) {
      const idx = paddingOffset + ch.startIdx + i;
      if (idx >= 0 && idx < totalLen) {
        const t = barCount > 0 ? i / barCount : 0;
        upperData[idx] = ch.startUpper + (ch.endUpper - ch.startUpper) * t;
        midData[idx] = ch.startMid + (ch.endMid - ch.startMid) * t;
        lowerData[idx] = ch.startLower + (ch.endLower - ch.startLower) * t;
      }
    }

    // Extend into right padding
    for (let i = 1; i <= EXTEND_BARS; i++) {
      const idx = paddingOffset + ch.endIdx + i;
      if (idx >= 0 && idx < totalLen) {
        upperData[idx] = ch.endUpper + slopeU * i;
        midData[idx] = ch.endMid + slope * i;
        lowerData[idx] = ch.endLower + slopeL * i;
      }
    }

    // Upper band line
    series.push({
      name: `${cfg.label} Üst`,
      type: 'line',
      data: upperData,
      xAxisIndex: 0,
      yAxisIndex: 0,
      showSymbol: false,
      lineStyle: { color: cfg.bandColor, width: cfg.width, type: 'solid' },
      silent: true,
      z: 5,
      connectNulls: false,
      tooltip: { show: false },
    });

    // Mid regression line
    if (cfg.color !== 'transparent') {
      series.push({
        name: `${cfg.label} Orta`,
        type: 'line',
        data: midData,
        xAxisIndex: 0,
        yAxisIndex: 0,
        showSymbol: false,
        lineStyle: { color: cfg.color, width: 1, type: 'dashed' },
        silent: true,
        z: 5,
        connectNulls: false,
        tooltip: { show: false },
      });
    }

    // Lower band line
    series.push({
      name: `${cfg.label} Alt`,
      type: 'line',
      data: lowerData,
      xAxisIndex: 0,
      yAxisIndex: 0,
      showSymbol: false,
      lineStyle: { color: cfg.bandColor, width: cfg.width, type: 'solid' },
      silent: true,
      z: 5,
      connectNulls: false,
      tooltip: { show: false },
    });
  }

  return series;
}

/**
 * Build forecast band series — a funnel-shaped filled area projected into the future.
 * Uses stacked area approach: lower line (base) + band width (stacked) to fill between.
 */
function buildForecastSeries(
  channels: ChannelResult[],
  dataLen: number,
  paddingOffset: number,
  totalLen: number,
  lastClose: number,
): echarts.SeriesOption[] {
  const forecast = computeForecastBand(channels, 120, lastClose);
  if (!forecast) return [];

  const midData: (number | null)[] = new Array(totalLen).fill(null);
  // For stacked band: lowerBase = lower value, bandWidth = upper - lower
  const lowerBase: (number | null)[] = new Array(totalLen).fill(null);
  const bandWidth: (number | null)[] = new Array(totalLen).fill(null);

  // Connect to last data bar for continuity — start from actual last close price
  const lastIdx = paddingOffset + dataLen - 1;
  if (lastIdx >= 0 && lastIdx < totalLen) {
    midData[lastIdx] = lastClose;
    lowerBase[lastIdx] = lastClose;
    bandWidth[lastIdx] = 0; // starts as a point, expands into funnel
  }

  // Fill forecast bars
  for (let i = 0; i < forecast.bars.length; i++) {
    const idx = paddingOffset + dataLen + i;
    if (idx >= 0 && idx < totalLen) {
      const bar = forecast.bars[i];
      midData[idx] = bar.mid;
      lowerBase[idx] = bar.lower;
      bandWidth[idx] = bar.upper - bar.lower;
    }
  }

  return [
    // Lower base — invisible line that forms the bottom of the band
    {
      name: 'Tahmin Taban',
      type: 'line',
      data: lowerBase,
      stack: 'forecastBand',
      xAxisIndex: 0,
      yAxisIndex: 0,
      showSymbol: false,
      lineStyle: { color: 'rgba(255,193,7,0.4)', width: 1, type: 'dotted' },
      areaStyle: { color: 'transparent' }, // invisible fill below lower
      silent: true,
      z: 4,
      connectNulls: false,
      tooltip: { show: false },
    },
    // Band width — stacked on top of lower, fills the area between lower and upper
    {
      name: 'Tahmin Kuşak',
      type: 'line',
      data: bandWidth,
      stack: 'forecastBand',
      xAxisIndex: 0,
      yAxisIndex: 0,
      showSymbol: false,
      lineStyle: { color: 'rgba(255,193,7,0.4)', width: 1, type: 'dotted' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(255,193,7,0.06)' },
          { offset: 0.5, color: 'rgba(255,193,7,0.12)' },
          { offset: 1, color: 'rgba(255,193,7,0.06)' },
        ]),
      },
      silent: true,
      z: 4,
      connectNulls: false,
      tooltip: { show: false },
    },
    // Mid projection dashed line
    {
      name: 'Tahmin Orta',
      type: 'line',
      data: midData,
      xAxisIndex: 0,
      yAxisIndex: 0,
      showSymbol: false,
      lineStyle: { color: 'rgba(255,193,7,0.9)', width: 2, type: 'dashed' },
      silent: true,
      z: 6,
      connectNulls: false,
      tooltip: { show: false },
    },
  ];
}

function buildOption(
  filtered: OHLCVData[],
  symbol: string,
  showChannels = false,
  visibleChannels?: Set<string>,
  showWilliamsR = false,
  showNizamiCedid = false,
  showMATLRNS = false,
  logScale = false,
): echarts.EChartsOption {
  const rawDates = filtered.map((d) => d.date);
  const rawOhlc = filtered.map((d) => [d.open, d.close, d.low, d.high]);
  const rawVolumes = filtered.map((d) => ({
    value: d.volume,
    itemStyle: {
      color: d.close >= d.open ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)',
    },
  }));

  const padded = addPadding(rawDates, rawOhlc, rawVolumes, []);
  const dates = padded.dates;
  const ohlc = padded.ohlc;
  const volumes = padded.volumes;

  const total = dates.length;
  const dataTotal = filtered.length;
  const dataEnd = padded.offset + dataTotal;
  const dataStart = Math.max(padded.offset, dataEnd - 120);
  const zoomStart = (dataStart / total) * 100;
  const zoomEnd = (dataEnd / total) * 100;

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
  };

  const maxVol = filtered.reduce((m, d) => Math.max(m, d.volume), 0);
  const volAxisMax = maxVol * 10;

  // --- Dynamic panel layout ---
  // Each indicator panel gets its own grid, xAxis, yAxis
  const panelHeight = 120;
  const subPanels: string[] = [];
  if (showWilliamsR) subPanels.push('wr');
  if (showNizamiCedid) subPanels.push('nc');
  const hasSubPanels = subPanels.length > 0;

  // Bottom-up stacking: slider at 8px, each panel 120px + 10px gap
  // Lowest panel bottom = 40, next panel bottom = 40 + panelHeight + 10, etc.
  const panelBottoms: number[] = [];
  for (let i = 0; i < subPanels.length; i++) {
    panelBottoms.push(40 + i * (panelHeight + 10));
  }
  const mainBottom = hasSubPanels
    ? panelBottoms[panelBottoms.length - 1] + panelHeight + 20
    : 50;

  // Grid indices: 0 = main, 1..N = sub panels (bottom to top)
  const grids: echarts.GridComponentOption[] = [
    { left: 80, right: 80, top: 20, bottom: mainBottom },
  ];
  // Sub panels added bottom-up (first panel = closest to slider)
  for (let i = 0; i < subPanels.length; i++) {
    grids.push({ left: 80, right: 80, bottom: panelBottoms[i], height: panelHeight });
  }

  // xAxis: 0 = main, 1..N = sub panels
  const allXAxisIndices = Array.from({ length: 1 + subPanels.length }, (_, i) => i);
  // The last sub panel shows date label, main hides it when sub panels exist
  const xAxes: echarts.XAXisComponentOption[] = [
    {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: BORDER_COLOR } },
      axisLabel: { color: TEXT_COLOR, fontSize: 11 },
      splitLine: { show: false },
      axisTick: { show: false },
      gridIndex: 0,
      axisPointer: {
        show: true,
        type: 'line',
        lineStyle: { color: '#555', type: 'dashed' },
        label: { show: !hasSubPanels, backgroundColor: '#1e222d', color: '#c8ccd4' },
      },
    },
  ];
  for (let i = 0; i < subPanels.length; i++) {
    const isBottom = i === 0; // closest to slider → shows axis label
    xAxes.push({
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: BORDER_COLOR } },
      axisLabel: isBottom ? { color: TEXT_COLOR, fontSize: 10 } : { show: false },
      splitLine: { show: false },
      axisTick: { show: false },
      gridIndex: i + 1,
      axisPointer: {
        show: true,
        type: 'line',
        lineStyle: { color: '#555', type: 'dashed' },
        label: isBottom ? { backgroundColor: '#1e222d', color: '#c8ccd4' } : { show: false },
      },
    });
  }

  // yAxes: 0 = price, 1 = volume, then sub panel yAxes
  const yAxes: echarts.YAXisComponentOption[] = [
    {
      type: logScale ? 'log' : 'value',
      scale: true,
      gridIndex: 0,
      position: 'right',
      splitLine: { lineStyle: { color: BORDER_COLOR } },
      axisLine: { lineStyle: { color: BORDER_COLOR } },
      axisLabel: { color: TEXT_COLOR, fontSize: 11, formatter: (v: number) => formatPrice(v) },
      axisPointer: {
        show: true, type: 'line',
        lineStyle: { color: '#555', type: 'dashed' },
        label: { backgroundColor: '#1e222d', color: '#c8ccd4' },
      },
    },
    {
      gridIndex: 0, position: 'left', min: 0, max: volAxisMax,
      splitNumber: 3, interval: maxVol > 0 ? maxVol / 2 : undefined,
      splitLine: { show: false }, axisLine: { show: false },
      axisLabel: {
        color: TEXT_COLOR, fontSize: 10,
        formatter: (v: number) => { if (v === 0 || v > maxVol) return ''; return formatVolume(v); },
      },
      axisTick: { show: false }, axisPointer: { show: false },
    },
  ];

  // Track yAxis index for each sub panel
  const panelYAxisIdx: Record<string, number> = {};

  for (let i = 0; i < subPanels.length; i++) {
    const yIdx = 2 + i;
    panelYAxisIdx[subPanels[i]] = yIdx;
    const gridIdx = i + 1;

    if (subPanels[i] === 'wr') {
      yAxes.push({
        gridIndex: gridIdx, position: 'right', min: -100, max: 0, splitNumber: 2,
        splitLine: { lineStyle: { color: BORDER_COLOR } },
        axisLine: { lineStyle: { color: BORDER_COLOR } },
        axisLabel: { color: TEXT_COLOR, fontSize: 10, formatter: (v: number) => `${v}` },
        axisPointer: {
          show: true, type: 'line',
          lineStyle: { color: '#555', type: 'dashed' },
          label: { backgroundColor: '#1e222d', color: '#c8ccd4' },
        },
      } as echarts.YAXisComponentOption);
    } else if (subPanels[i] === 'nc') {
      yAxes.push({
        gridIndex: gridIdx, position: 'right', scale: true, splitNumber: 3,
        splitLine: { lineStyle: { color: BORDER_COLOR } },
        axisLine: { lineStyle: { color: BORDER_COLOR } },
        axisLabel: { color: TEXT_COLOR, fontSize: 10 },
        axisPointer: {
          show: true, type: 'line',
          lineStyle: { color: '#555', type: 'dashed' },
          label: { backgroundColor: '#1e222d', color: '#c8ccd4' },
        },
      } as echarts.YAXisComponentOption);
    }
  }

  // --- Sub panel series ---
  const subSeries: echarts.SeriesOption[] = [];
  const pad = getPaddingCount(filtered.length);
  const padNull = new Array(pad).fill(null);

  // Williams %R
  if (showWilliamsR && filtered.length > 260) {
    const wrGridIdx = subPanels.indexOf('wr') + 1;
    const wrYIdx = panelYAxisIdx['wr'];
    const highs = filtered.map(d => d.high);
    const lows = filtered.map(d => d.low);
    const closes = filtered.map(d => d.close);
    const wr = computeWilliamsR(highs, lows, closes, 260, 260);
    const wrPadded = [...padNull, ...wr.wr, ...padNull];
    const emaPadded = [...padNull, ...wr.ema, ...padNull];

    subSeries.push(
      {
        name: 'Williams %R', type: 'line', data: wrPadded,
        xAxisIndex: wrGridIdx, yAxisIndex: wrYIdx,
        showSymbol: false, lineStyle: { color: '#fdd835', width: 2 }, z: 5,
        tooltip: { show: false },
        markLine: {
          silent: true, symbol: 'none', label: { show: false },
          data: [
            { yAxis: -20, lineStyle: { color: '#555', type: 'dashed' as const, width: 1 } },
            { yAxis: -80, lineStyle: { color: '#555', type: 'dashed' as const, width: 1 } },
          ],
        },
      },
      {
        name: 'WR EMA', type: 'line', data: emaPadded,
        xAxisIndex: wrGridIdx, yAxisIndex: wrYIdx,
        showSymbol: false, lineStyle: { color: '#00bcd4', width: 2 }, z: 5,
        tooltip: { show: false },
      },
    );
  }

  // NizamiCedid (3. Selim)
  if (showNizamiCedid && filtered.length > 260) {
    const ncGridIdx = subPanels.indexOf('nc') + 1;
    const ncYIdx = panelYAxisIdx['nc'];
    const closes = filtered.map(d => d.close);
    const vols = filtered.map(d => d.volume);
    const nc = computeNizamiCedid(closes, vols);

    // Pad all arrays
    const histPadded = [...padNull, ...nc.hist, ...padNull];
    const macdPadded = [...padNull, ...nc.macd, ...padNull];
    const signalPadded = [...padNull, ...nc.signal, ...padNull];
    const eMacDPadded = [...padNull, ...nc.eMacD, ...padNull];
    const deltaPadded = [...padNull, ...nc.deltaMACEMAC, ...padNull];
    const kondisyonPadded = [...padNull, ...nc.kondisyon, ...padNull];

    // Histogram with 4-color scheme (like Pine Script)
    const histColored = histPadded.map((val: number | null, idx: number) => {
      if (val === null) return { value: null };
      const prev = idx > 0 ? histPadded[idx - 1] : null;
      let color: string;
      if (val >= 0) {
        color = (prev !== null && prev < val) ? '#26A69A' : '#B2DFDB';
      } else {
        color = (prev !== null && prev < val) ? '#FFCDD2' : '#FF5252';
      }
      return { value: val, itemStyle: { color } };
    });

    // Kondisyon (background color via markArea on the NC panel)
    // Build markArea data for kondisyon segments
    const markAreaData: Array<[{ xAxis: number }, { xAxis: number; itemStyle: { color: string } }]> = [];
    let segStart = -1;
    let segVal: boolean | null = null;
    for (let i = 0; i < kondisyonPadded.length; i++) {
      const k = kondisyonPadded[i];
      if (k !== segVal) {
        if (segStart >= 0 && segVal !== null) {
          markAreaData.push([
            { xAxis: segStart },
            { xAxis: i - 1, itemStyle: { color: segVal ? 'rgba(76,175,79,0.15)' : 'rgba(255,82,82,0.15)' } },
          ]);
        }
        segStart = i;
        segVal = k;
      }
    }
    if (segStart >= 0 && segVal !== null) {
      markAreaData.push([
        { xAxis: segStart },
        { xAxis: kondisyonPadded.length - 1, itemStyle: { color: segVal ? 'rgba(76,175,79,0.15)' : 'rgba(255,82,82,0.15)' } },
      ]);
    }

    subSeries.push(
      // Histogram
      {
        name: 'NC Histogram', type: 'bar', data: histColored,
        xAxisIndex: ncGridIdx, yAxisIndex: ncYIdx,
        barWidth: '60%', z: 1, tooltip: { show: false },
      },
      // MACD line
      {
        name: 'MACD', type: 'line', data: macdPadded,
        xAxisIndex: ncGridIdx, yAxisIndex: ncYIdx,
        showSymbol: false, lineStyle: { color: '#ff00a6', width: 2 }, z: 5,
        tooltip: { show: false },
        markArea: markAreaData.length > 0 ? {
          silent: true,
          data: markAreaData as unknown as echarts.MarkAreaComponentOption['data'],
        } : undefined,
      },
      // Signal line
      {
        name: 'Signal', type: 'line', data: signalPadded,
        xAxisIndex: ncGridIdx, yAxisIndex: ncYIdx,
        showSymbol: false, lineStyle: { color: '#FF6D00', width: 2 }, z: 5,
        tooltip: { show: false },
      },
      // eMacD (thick black → white in dark mode)
      {
        name: 'eMacD', type: 'line', data: eMacDPadded,
        xAxisIndex: ncGridIdx, yAxisIndex: ncYIdx,
        showSymbol: false, lineStyle: { color: '#e0e0e0', width: 3 }, z: 6,
        tooltip: { show: false },
      },
      // deltaMACEMAC (area)
      {
        name: 'deltaMACEMAC', type: 'line', data: deltaPadded,
        xAxisIndex: ncGridIdx, yAxisIndex: ncYIdx,
        showSymbol: false, lineStyle: { color: 'rgba(83,76,175,0.47)', width: 1 },
        areaStyle: { color: 'rgba(83,76,175,0.25)' },
        z: 3, tooltip: { show: false },
      },
      // Zero line
      {
        name: 'NC Zero', type: 'line',
        data: new Array(total).fill(0),
        xAxisIndex: ncGridIdx, yAxisIndex: ncYIdx,
        showSymbol: false, lineStyle: { color: '#787B86', width: 1, type: 'dashed' },
        z: 2, silent: true, tooltip: { show: false },
      },
    );
  }

  return {
    animation: false,
    backgroundColor: BG_COLOR,
    grid: grids,
    xAxis: xAxes as echarts.EChartsOption['xAxis'],
    yAxis: yAxes as echarts.EChartsOption['yAxis'],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: allXAxisIndices,
        start: zoomStart, end: zoomEnd,
        zoomOnMouseWheel: true, moveOnMouseMove: false,
        moveOnMouseWheel: false, preventDefaultMouseMove: false,
      },
      {
        type: 'slider',
        xAxisIndex: allXAxisIndices,
        start: zoomStart, end: zoomEnd,
        bottom: 8, height: 20,
        borderColor: BORDER_COLOR, backgroundColor: '#0f1320',
        dataBackground: { lineStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' } },
        selectedDataBackground: { lineStyle: { color: 'transparent' }, areaStyle: { color: 'rgba(41,98,255,0.08)' } },
        fillerColor: 'rgba(41,98,255,0.15)',
        handleStyle: { color: '#404555', borderColor: '#606580' },
        textStyle: { color: TEXT_COLOR, fontSize: 10 },
      },
    ],
    tooltip: { show: false },
    axisPointer: {
      show: true,
      link: [{ xAxisIndex: allXAxisIndices }],
      label: { backgroundColor: '#1e222d', color: '#c8ccd4' },
    },
    series: [
      { ...mainSeries, xAxisIndex: 0, yAxisIndex: 0 },
      {
        name: 'Volume', type: 'bar', data: volumes,
        xAxisIndex: 0, yAxisIndex: 1, barWidth: '60%', z: 1,
        tooltip: { show: false },
      },
      ...(showChannels ? (() => {
        const closePrices = filtered.map((d) => d.close);
        const allChannels = computeAllChannels(closePrices);
        const vis = visibleChannels ?? new Set([...allChannels.map(c => c.id), 'forecast']);
        const activeChannels = allChannels.filter(ch => vis.has(ch.id));
        const lastClose = filtered.length > 0 ? filtered[filtered.length - 1].close : 0;
        return [
          ...buildChannelSeries(activeChannels, filtered.length, padded.offset, total),
          ...(vis.has('forecast') ? buildForecastSeries(allChannels, filtered.length, padded.offset, total, lastClose) : []),
        ];
      })() : []),
      // MATLRNS overlay (fast + slow MA with direction-based fill)
      ...(showMATLRNS && filtered.length > 21 ? (() => {
        const highs = filtered.map(d => d.high);
        const lows = filtered.map(d => d.low);
        const closes = filtered.map(d => d.close);
        const ml = computeMATLRNS(highs, lows, closes, 8, 21, 9, true);
        const fastPadded = [...padNull, ...ml.fastMA, ...padNull];
        const slowPadded = [...padNull, ...ml.slowMA, ...padNull];
        const dirPadded = [...padNull, ...ml.direction, ...padNull];

        // Split fastMA into 3 color-coded line series + overlap at boundaries
        const upData: (number | null)[] = new Array(total).fill(null);
        const dnData: (number | null)[] = new Array(total).fill(null);
        const warnData: (number | null)[] = new Array(total).fill(null);

        for (let i = 0; i < total; i++) {
          const v = fastPadded[i];
          const d = dirPadded[i];
          if (v === null || d === null) continue;
          if (d > 0) upData[i] = v;
          else if (d < 0) dnData[i] = v;
          else warnData[i] = v;
          // Bridge: also place value in adjacent series to avoid gap
          if (i > 0 && fastPadded[i - 1] !== null && dirPadded[i - 1] !== null) {
            const prevD = dirPadded[i - 1];
            if (prevD !== d) {
              // Previous segment's color needs this point too for continuity
              if (prevD! > 0) upData[i] = v;
              else if (prevD! < 0) dnData[i] = v;
              else warnData[i] = v;
              // Current segment needs previous point for continuity
              const prevV = fastPadded[i - 1]!;
              if (d > 0) upData[i - 1] = prevV;
              else if (d < 0) dnData[i - 1] = prevV;
              else warnData[i - 1] = prevV;
            }
          }
        }

        // Build fill band per color segment (3 separate stacks so each has its own color)
        // For each direction color, create bandLower + bandWidth pair with bridge points
        const upLower: (number | null)[] = new Array(total).fill(null);
        const upWidth: (number | null)[] = new Array(total).fill(null);
        const dnLower: (number | null)[] = new Array(total).fill(null);
        const dnWidth: (number | null)[] = new Array(total).fill(null);
        const warnLower: (number | null)[] = new Array(total).fill(null);
        const warnWidth: (number | null)[] = new Array(total).fill(null);

        for (let i = 0; i < total; i++) {
          const f = fastPadded[i];
          const s = slowPadded[i];
          const d = dirPadded[i];
          if (f === null || s === null || d === null) continue;
          const lo = Math.min(f, s);
          const w = Math.abs(f - s);
          if (d > 0) { upLower[i] = lo; upWidth[i] = w; }
          else if (d < 0) { dnLower[i] = lo; dnWidth[i] = w; }
          else { warnLower[i] = lo; warnWidth[i] = w; }
          // Bridge at color transitions (same idea as line segments)
          if (i > 0 && fastPadded[i - 1] !== null && slowPadded[i - 1] !== null && dirPadded[i - 1] !== null) {
            const prevD = dirPadded[i - 1];
            if (prevD !== d) {
              const prevF = fastPadded[i - 1]!;
              const prevS = slowPadded[i - 1]!;
              const prevLo = Math.min(prevF, prevS);
              const prevW = Math.abs(prevF - prevS);
              // Extend previous segment to this point
              if (prevD! > 0) { upLower[i] = lo; upWidth[i] = w; }
              else if (prevD! < 0) { dnLower[i] = lo; dnWidth[i] = w; }
              else { warnLower[i] = lo; warnWidth[i] = w; }
              // Extend current segment back to previous point
              if (d > 0) { upLower[i - 1] = prevLo; upWidth[i - 1] = prevW; }
              else if (d < 0) { dnLower[i - 1] = prevLo; dnWidth[i - 1] = prevW; }
              else { warnLower[i - 1] = prevLo; warnWidth[i - 1] = prevW; }
            }
          }
        }

        const overlaySeries: echarts.SeriesOption[] = [
          // Slow MA — very subtle line
          {
            name: 'Slow MA', type: 'line', data: slowPadded,
            xAxisIndex: 0, yAxisIndex: 0, showSymbol: false,
            lineStyle: { color: 'rgba(128,128,128,0.3)', width: 2 },
            z: 3, silent: true, tooltip: { show: false },
          },
          // Fast MA — green segments
          {
            name: 'Fast MA ↑', type: 'line', data: upData,
            xAxisIndex: 0, yAxisIndex: 0, showSymbol: false,
            lineStyle: { color: '#26a69a', width: 2 },
            connectNulls: false, z: 4, silent: true, tooltip: { show: false },
          },
          // Fast MA — red segments
          {
            name: 'Fast MA ↓', type: 'line', data: dnData,
            xAxisIndex: 0, yAxisIndex: 0, showSymbol: false,
            lineStyle: { color: '#ef5350', width: 2 },
            connectNulls: false, z: 4, silent: true, tooltip: { show: false },
          },
          // Fast MA — gray/warn segments
          {
            name: 'Fast MA ⚠', type: 'line', data: warnData,
            xAxisIndex: 0, yAxisIndex: 0, showSymbol: false,
            lineStyle: { color: '#888', width: 2 },
            connectNulls: false, z: 4, silent: true, tooltip: { show: false },
          },
          // Green band (up direction)
          {
            name: 'MA Band ↑ Base', type: 'line', data: upLower,
            stack: 'maBandUp', xAxisIndex: 0, yAxisIndex: 0,
            showSymbol: false, lineStyle: { width: 0 },
            areaStyle: { color: 'transparent' },
            connectNulls: false, z: 2, silent: true, tooltip: { show: false },
          },
          {
            name: 'MA Band ↑ Fill', type: 'line', data: upWidth,
            stack: 'maBandUp', xAxisIndex: 0, yAxisIndex: 0,
            showSymbol: false, lineStyle: { width: 0 },
            areaStyle: { color: 'rgba(38,166,154,0.22)' },
            connectNulls: false, z: 2, silent: true, tooltip: { show: false },
          },
          // Red band (down direction)
          {
            name: 'MA Band ↓ Base', type: 'line', data: dnLower,
            stack: 'maBandDn', xAxisIndex: 0, yAxisIndex: 0,
            showSymbol: false, lineStyle: { width: 0 },
            areaStyle: { color: 'transparent' },
            connectNulls: false, z: 2, silent: true, tooltip: { show: false },
          },
          {
            name: 'MA Band ↓ Fill', type: 'line', data: dnWidth,
            stack: 'maBandDn', xAxisIndex: 0, yAxisIndex: 0,
            showSymbol: false, lineStyle: { width: 0 },
            areaStyle: { color: 'rgba(239,83,80,0.22)' },
            connectNulls: false, z: 2, silent: true, tooltip: { show: false },
          },
          // Gray band (neutral direction)
          {
            name: 'MA Band ⚠ Base', type: 'line', data: warnLower,
            stack: 'maBandWarn', xAxisIndex: 0, yAxisIndex: 0,
            showSymbol: false, lineStyle: { width: 0 },
            areaStyle: { color: 'transparent' },
            connectNulls: false, z: 2, silent: true, tooltip: { show: false },
          },
          {
            name: 'MA Band ⚠ Fill', type: 'line', data: warnWidth,
            stack: 'maBandWarn', xAxisIndex: 0, yAxisIndex: 0,
            showSymbol: false, lineStyle: { width: 0 },
            areaStyle: { color: 'rgba(128,128,128,0.15)' },
            connectNulls: false, z: 2, silent: true, tooltip: { show: false },
          },
        ];
        return overlaySeries;
      })() : []),
      ...subSeries,
    ],
  };
}

export default function ChartContainer({
  data,
  symbol,
  interval,
  onLegendUpdate,
  showChannels = false,
  showWilliamsR = false,
  showNizamiCedid = false,
  showMATLRNS = false,
  logScale = false,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const lastBarRef = useRef<OHLCVData | null>(null);
  const currentDataRef = useRef<OHLCVData[]>([]);
  const wrDataRef = useRef<{ wr: (number | null)[]; ema: (number | null)[] } | null>(null);
  const ncDataRef = useRef<NizamiCedidResult | null>(null);
  const [wrLegend, setWrLegend] = useState<{ wr: number | null; ema: number | null } | null>(null);
  const [ncLegend, setNcLegend] = useState<{ macd: number | null; signal: number | null; hist: number | null; eMacD: number | null; delta: number | null } | null>(null);

  // Toggle visibility of individual channels and forecast band
  const [visibleChannels, setVisibleChannels] = useState<Set<string>>(
    () => new Set([...DEFAULT_CHANNELS.map(c => c.id), 'forecast'])
  );

  const toggleChannel = useCallback((id: string) => {
    setVisibleChannels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = data;

  // Compute Pearson correlation values for the info table
  const channelResults = useMemo<ChannelResult[]>(() => {
    if (!showChannels || filtered.length < 34) return [];
    const closePrices = filtered.map((d) => d.close);
    return computeAllChannels(closePrices);
  }, [filtered, showChannels]);

  // Compute forecast band stats for display
  const forecastInfo = useMemo(() => {
    if (channelResults.length === 0 || filtered.length === 0) return null;
    const lastClose = filtered[filtered.length - 1].close;
    return computeForecastBand(channelResults, 120, lastClose);
  }, [channelResults, filtered]);

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
    chartInstanceRef.current = chart;

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);

    // Forward wheel events from outside chart
    const handleGlobalWheel = (e: WheelEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const synth = new WheelEvent('wheel', {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 3,
        bubbles: true,
        cancelable: true,
      });
      containerRef.current.dispatchEvent(synth);
    };
    document.addEventListener('wheel', handleGlobalWheel, { passive: false });

    // Drag-to-pan: left-click drag pans both X and Y axes simultaneously
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startZoomStart = 0;
    let startZoomEnd = 100;
    let startYMin = 0;
    let startYMax = 0;
    let dragOnPriceAxis = false;
    let priceAxisDragStartY = 0;
    let priceAxisStartYMin = 0;
    let priceAxisStartYMax = 0;

    // Slider (time bar) drag state
    let sliderDragging = false;
    let sliderDragStartX = 0;
    let sliderStartZoomStart = 0;
    let sliderStartZoomEnd = 100;

    // Cursor change on hover over axis areas
    // ECharts canvas overrides container cursor, so we must set it on all child elements too
    const setCursorOnAll = (cursor: string) => {
      if (!containerRef.current) return;
      containerRef.current.style.cursor = cursor;
      const canvases = containerRef.current.querySelectorAll('canvas');
      canvases.forEach((c) => { c.style.cursor = cursor; });
    };
    const SLIDER_ZONE_HEIGHT = 34; // bottom area where the slider lives
    const onHoverMove = (e: MouseEvent) => {
      if (!containerRef.current || dragging || dragOnPriceAxis || sliderDragging) return;
      const rect = containerRef.current.getBoundingClientRect();
      const gridRight = rect.right - 80;
      const gridLeft = rect.left + 80;
      const distFromBottom = rect.bottom - e.clientY;
      if (distFromBottom <= SLIDER_ZONE_HEIGHT && e.clientX > gridLeft && e.clientX < gridRight) {
        setCursorOnAll('ew-resize');
      } else if (e.clientX > gridRight || e.clientX < gridLeft) {
        setCursorOnAll('ns-resize');
      } else {
        setCursorOnAll('');
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current || e.button !== 0) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Check if click is on the slider (time bar) zone at the bottom
      const gridLeft = rect.left + 80;
      const gridRight = rect.right - 80;
      const distFromBottom = rect.bottom - e.clientY;
      if (distFromBottom <= SLIDER_ZONE_HEIGHT && e.clientX > gridLeft && e.clientX < gridRight) {
        sliderDragging = true;
        sliderDragStartX = e.clientX;
        const opt = chart.getOption() as {
          dataZoom?: Array<{ start?: number; end?: number }>;
        };
        sliderStartZoomStart = opt.dataZoom?.[0]?.start ?? 0;
        sliderStartZoomEnd = opt.dataZoom?.[0]?.end ?? 100;
        setCursorOnAll('ew-resize');
        e.preventDefault();
        return;
      }

      // Check if click is on the left-side volume axis area
      if (e.clientX < gridLeft) {
        // Same behavior as price axis — zoom Y
        dragOnPriceAxis = true;
        priceAxisDragStartY = e.clientY;
        const yAxisModel = chart.getModel()?.getComponent('yAxis', 0) as unknown as { axis?: { scale?: { getExtent?: () => [number, number] } } } | undefined;
        const extent = yAxisModel?.axis?.scale?.getExtent?.();
        if (extent) {
          priceAxisStartYMin = extent[0];
          priceAxisStartYMax = extent[1];
        }
        e.preventDefault();
        return;
      }

      // Check if click is on the right-side price axis area
      if (e.clientX > gridRight) {
        // Dragging on price axis — zoom Y
        dragOnPriceAxis = true;
        priceAxisDragStartY = e.clientY;
        const yAxisModel = chart.getModel()?.getComponent('yAxis', 0) as unknown as { axis?: { scale?: { getExtent?: () => [number, number] } } } | undefined;
        const extent = yAxisModel?.axis?.scale?.getExtent?.();
        if (extent) {
          priceAxisStartYMin = extent[0];
          priceAxisStartYMax = extent[1];
        }
        e.preventDefault();
        return;
      }

      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const opt = chart.getOption() as {
        dataZoom?: Array<{ start?: number; end?: number }>;
      };
      startZoomStart = opt.dataZoom?.[0]?.start ?? 0;
      startZoomEnd = opt.dataZoom?.[0]?.end ?? 100;
      const yAxisModel = chart.getModel()?.getComponent('yAxis', 0) as unknown as { axis?: { scale?: { getExtent?: () => [number, number] } } } | undefined;
      const extent = yAxisModel?.axis?.scale?.getExtent?.();
      if (extent) {
        startYMin = extent[0];
        startYMax = extent[1];
      }
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      // Slider drag — zoom in/out by dragging left/right on time bar
      if (sliderDragging) {
        const dx = e.clientX - sliderDragStartX;
        const rect = containerRef.current.getBoundingClientRect();
        const pxWidth = rect.width - 160; // grid area width
        const range = sliderStartZoomEnd - sliderStartZoomStart;
        const mid = (sliderStartZoomStart + sliderStartZoomEnd) / 2;
        // Drag right = zoom out (widen), drag left = zoom in (narrow)
        const scaleFactor = 1 + (dx / pxWidth) * 2;
        const newHalf = (range / 2) * Math.max(0.02, scaleFactor);
        const newStart = Math.max(0, mid - newHalf);
        const newEnd = Math.min(100, mid + newHalf);
        chart.dispatchAction({
          type: 'dataZoom',
          dataZoomIndex: 0,
          start: newStart,
          end: newEnd,
        });
        // Also sync slider dataZoom
        chart.dispatchAction({
          type: 'dataZoom',
          dataZoomIndex: 1,
          start: newStart,
          end: newEnd,
        });
        return;
      }

      // Price axis drag — expand/contract Y range
      if (dragOnPriceAxis) {
        const dy = e.clientY - priceAxisDragStartY;
        const rect = containerRef.current.getBoundingClientRect();
        const pxHeight = rect.height - 70; // grid area approx
        const yRange = priceAxisStartYMax - priceAxisStartYMin;
        const mid = (priceAxisStartYMin + priceAxisStartYMax) / 2;
        // Drag down = expand range, drag up = contract range
        const scaleFactor = 1 + (dy / pxHeight) * 2;
        const newHalf = (yRange / 2) * Math.max(0.1, scaleFactor);
        chart.setOption({
          yAxis: [{
            min: mid - newHalf,
            max: mid + newHalf,
          }],
        });
        return;
      }

      if (!dragging) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Horizontal pan (X axis) — allow going beyond data boundaries
      const dx = e.clientX - dragStartX;
      const pxRange = rect.width;
      const zoomRange = startZoomEnd - startZoomStart;
      const shift = -(dx / pxRange) * zoomRange;
      const newStart = startZoomStart + shift;
      const newEnd = startZoomEnd + shift;

      chart.dispatchAction({
        type: 'dataZoom',
        dataZoomIndex: 0,
        start: newStart,
        end: newEnd,
      });

      // Vertical pan (Y axis)
      const dy = e.clientY - dragStartY;
      const pxHeight = rect.height - 70;
      const yRange = startYMax - startYMin;
      const yShift = (dy / pxHeight) * yRange;

      chart.setOption({
        yAxis: [{
          min: startYMin + yShift,
          max: startYMax + yShift,
        }],
      });
    };

    const onMouseUp = () => {
      dragging = false;
      dragOnPriceAxis = false;
      sliderDragging = false;
    };

    const el = containerRef.current;
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onHoverMove);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Double-click on price axis or chart to reset Y axis to auto-scale
    const onDblClick = () => {
      chart.setOption({
        yAxis: [{ min: undefined, max: undefined }],
      });
    };
    el.addEventListener('dblclick', onDblClick);

    // Crosshair tracking for legend (adjust for padding offset)
    chart.on('updateAxisPointer', (params: unknown) => {
      const p = params as { axesInfo?: Array<{ axisDim?: string; value?: number }> };
      const xInfo = p.axesInfo?.find(a => a.axisDim === 'x');
      if (xInfo?.value != null && currentDataRef.current.length > 0) {
        const dataIndex = Math.round(xInfo.value);
        const realIdx = dataIndex - getPaddingCount(currentDataRef.current.length);
        const bar = currentDataRef.current[realIdx];
        if (bar) {
          const prevClose = realIdx > 0
            ? currentDataRef.current[realIdx - 1].close
            : bar.open;
          onLegendUpdate({
            symbol,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            time: bar.date,
            prevClose,
          });
        } else {
          onLegendUpdate(null);
        }
        // Williams %R legend values
        const wrD = wrDataRef.current;
        if (wrD && dataIndex >= 0 && dataIndex < wrD.wr.length) {
          const wrVal = wrD.wr[dataIndex];
          const emaVal = wrD.ema[dataIndex];
          setWrLegend({ wr: wrVal, ema: emaVal });
        } else {
          setWrLegend(null);
        }
        // NizamiCedid legend values
        const ncD = ncDataRef.current;
        if (ncD && realIdx >= 0 && realIdx < ncD.macd.length) {
          setNcLegend({
            macd: ncD.macd[realIdx],
            signal: ncD.signal[realIdx],
            hist: ncD.hist[realIdx],
            eMacD: ncD.eMacD[realIdx],
            delta: ncD.deltaMACEMAC[realIdx],
          });
        } else {
          setNcLegend(null);
        }
      }
    });

    return () => {
      document.removeEventListener('wheel', handleGlobalWheel);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onHoverMove);
      el.removeEventListener('dblclick', onDblClick);
      ro.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update chart when data/type/timeframe changes
  const updateChart = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    currentDataRef.current = [...filtered];
    chart.setOption(buildOption(filtered, symbol, showChannels, visibleChannels, showWilliamsR, showNizamiCedid, showMATLRNS, logScale), true);
    if (filtered.length > 0) {
      lastBarRef.current = { ...filtered[filtered.length - 1] };
    }
    // Pre-compute padded WR/EMA arrays for crosshair legend
    if (showWilliamsR && filtered.length > 260) {
      const highs = filtered.map(d => d.high);
      const lows = filtered.map(d => d.low);
      const closes = filtered.map(d => d.close);
      const wr = computeWilliamsR(highs, lows, closes, 260, 260);
      const pad = getPaddingCount(filtered.length);
      const padNull = new Array(pad).fill(null);
      wrDataRef.current = {
        wr: [...padNull, ...wr.wr, ...padNull],
        ema: [...padNull, ...wr.ema, ...padNull],
      };
    } else {
      wrDataRef.current = null;
    }
    // Pre-compute NizamiCedid for crosshair legend (store raw, not padded — lookup by realIdx)
    if (showNizamiCedid && filtered.length > 260) {
      const closes = filtered.map(d => d.close);
      const vols = filtered.map(d => d.volume);
      ncDataRef.current = computeNizamiCedid(closes, vols);
    } else {
      ncDataRef.current = null;
    }
  }, [filtered, symbol, showChannels, visibleChannels, showWilliamsR, showNizamiCedid, showMATLRNS, logScale]);

  useEffect(() => {
    updateChart();
  }, [updateChart]);

  // Realtime WebSocket updates
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || filtered.length === 0) return;

    const ws = createWebSocket(
      symbol,
      (quote) => {
        // Update last bar with realtime quote
        const arr = currentDataRef.current;
        if (arr.length === 0) return;
        // Skip quotes with no valid price
        if (!quote.price || quote.price <= 0) return;

        const lastBar = arr[arr.length - 1];
        const updated = {
          ...lastBar,
          close: quote.price || lastBar.close,
          high: Math.max(lastBar.high, quote.price || 0),
          low: quote.price ? Math.min(lastBar.low, quote.price) : lastBar.low,
          volume: quote.volume || lastBar.volume,
        };
        arr[arr.length - 1] = updated;
        lastBarRef.current = updated;

        // Rebuild padded arrays for chart update
        const rawDates = arr.map((d) => d.date);
        const rawOhlc = arr.map((d) => [d.open, d.close, d.low, d.high]);
        const rawVolumes = arr.map((d) => ({
          value: d.volume,
          itemStyle: {
            color: d.close >= d.open ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)',
          },
        }));
        const p = addPadding(rawDates, rawOhlc, rawVolumes, []);

        chart.setOption({
          xAxis: [{ data: p.dates }],
          series: [
            { data: p.ohlc },
            { data: p.volumes },
          ],
        });
      },
    );

    return () => {
      ws.close();
    };
  }, [filtered, symbol]);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div ref={containerRef} className="chart-container" />
      {showWilliamsR && (() => {
        // WR is always subPanels[0] → bottom = 40 (lowest panel)
        const wrPanelBot = 40;
        const wrTop = wrPanelBot + 120; // top of WR panel
        return (
          <div className="wr-legend" style={{ bottom: wrTop }}>
            <span className="wr-legend-title">William Paşa</span>
            <span className="wr-legend-label" style={{ color: '#fdd835' }}>%R</span>
            <span className="wr-legend-value" style={{ color: '#fdd835' }}>
              {wrLegend?.wr != null ? wrLegend.wr.toFixed(2) : '—'}
            </span>
            <span className="wr-legend-label" style={{ color: '#00bcd4' }}>EMA</span>
            <span className="wr-legend-value" style={{ color: '#00bcd4' }}>
              {wrLegend?.ema != null ? wrLegend.ema.toFixed(2) : '—'}
            </span>
          </div>
        );
      })()}
      {showNizamiCedid && (() => {
        // NC panel: if WR is also shown → second panel (bottom = 40+130), else lowest (bottom = 40)
        const ncPanelBot = showWilliamsR ? 40 + 130 : 40;
        const ncTop = ncPanelBot + 120;
        return (
          <div className="wr-legend" style={{ bottom: ncTop }}>
            <span className="wr-legend-title">3. Selim</span>
            <span className="wr-legend-label" style={{ color: '#ff00a6' }}>MACD</span>
            <span className="wr-legend-value" style={{ color: '#ff00a6' }}>
              {ncLegend?.macd != null ? (ncLegend.macd * 100).toFixed(3) : '—'}
            </span>
            <span className="wr-legend-label" style={{ color: '#FF6D00' }}>Sinyal</span>
            <span className="wr-legend-value" style={{ color: '#FF6D00' }}>
              {ncLegend?.signal != null ? (ncLegend.signal * 100).toFixed(3) : '—'}
            </span>
            <span className="wr-legend-label" style={{ color: '#e0e0e0' }}>eMACD</span>
            <span className="wr-legend-value" style={{ color: '#e0e0e0' }}>
              {ncLegend?.eMacD != null ? (ncLegend.eMacD * 100).toFixed(3) : '—'}
            </span>
          </div>
        );
      })()}
      {showChannels && channelResults.length > 0 && (
        <div className="pearson-table">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Kanal</th>
                <th>Periyot</th>
                <th>Pearson</th>
              </tr>
            </thead>
            <tbody>
              {channelResults.map((ch) => {
                const cfg = DEFAULT_CHANNELS.find((c) => c.id === ch.id);
                const active = visibleChannels.has(ch.id);
                return (
                  <tr
                    key={ch.id}
                    className={`pearson-row ${active ? '' : 'dimmed'}`}
                    onClick={() => toggleChannel(ch.id)}
                  >
                    <td className="check-cell">
                      <span className={`tick ${active ? 'on' : ''}`} style={{ borderColor: cfg?.bandColor }} />
                    </td>
                    <td style={{ color: active ? cfg?.bandColor : '#555' }}>{cfg?.label}</td>
                    <td style={{ color: active ? '#c8ccd4' : '#555' }}>{ch.period}</td>
                    <td style={{ color: active ? (ch.pearson >= 0 ? '#26a69a' : '#ef5350') : '#555' }}>
                      {ch.pearson.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {forecastInfo && (
                <tr
                  className={`pearson-row ${visibleChannels.has('forecast') ? '' : 'dimmed'}`}
                  onClick={() => toggleChannel('forecast')}
                >
                  <td className="check-cell">
                    <span className={`tick ${visibleChannels.has('forecast') ? 'on' : ''}`} style={{ borderColor: 'rgba(255,193,7,0.9)' }} />
                  </td>
                  <td style={{ color: visibleChannels.has('forecast') ? 'rgba(255,193,7,0.9)' : '#555' }}>Tahmin</td>
                  <td style={{ color: visibleChannels.has('forecast') ? '#c8ccd4' : '#555' }} colSpan={2}>
                    Güven: {(forecastInfo.avgPearson * 100).toFixed(0)}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
