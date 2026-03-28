import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as echarts from 'echarts';
import type { Interval, LegendData } from './types';
import type { OHLCVData } from '../../api/borsaApi';
import { DEFAULT_BOLLINGER_CONFIGS } from '../../utils/regressionChannels';
import type { BollingerOverlayResult } from '../../utils/regressionChannels';
import { computeAllBollingerOverlays } from '../../utils/regressionChannels';
import {
  computeCombinedSignals,
  extractCombinedSignalEvents,
  DEFAULT_SIGNAL_CONFIG,
} from '../../utils/signalDetection';
import type { SignalConfig, SignalEvent } from '../../utils/signalDetection';
import { isIntraday } from './types';
import { buildOption, getThemeColors, getPaddingCount } from './chartBuilder';
import { buildSignalScatterSeries } from './signalRenderer';
import './ChartContainer.css';

// Keep import reference for future use (signal scatter is already called inside buildOption)
void buildSignalScatterSeries;

interface ChartContainerProps {
  data: OHLCVData[];
  symbol: string;
  interval: Interval;
  onLegendUpdate: (data: LegendData | null) => void;
  showBollinger?: boolean;
  showRSI?: boolean;
  showMACD?: boolean;
  showStochRSI?: boolean;
  showSuperTrend?: boolean;
  showIchimoku?: boolean;
  showOBV?: boolean;
  showSignals?: boolean;
  signalConfig?: SignalConfig;
  logScale?: boolean;
}

export default function ChartContainer({
  data,
  symbol,
  interval,
  onLegendUpdate,
  showBollinger = false,
  showRSI = false,
  showMACD = false,
  showStochRSI = false,
  showSuperTrend = false,
  showIchimoku = false,
  showOBV = false,
  showSignals = false,
  signalConfig,
  logScale = false,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const lastBarRef = useRef<OHLCVData | null>(null);
  const currentDataRef = useRef<OHLCVData[]>([]);
  const symbolRef = useRef(symbol);
  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);
  const intervalRef = useRef(interval);
  useEffect(() => {
    intervalRef.current = interval;
  }, [interval]);
  const onLegendUpdateRef = useRef(onLegendUpdate);
  useEffect(() => {
    onLegendUpdateRef.current = onLegendUpdate;
  }, [onLegendUpdate]);

  // Toggle visibility of individual Bollinger bands
  const [visibleBollinger, setVisibleBollinger] = useState<Set<string>>(
    () => new Set(DEFAULT_BOLLINGER_CONFIGS.map((c) => c.id)),
  );

  const toggleBollinger = useCallback((id: string) => {
    setVisibleBollinger((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  void toggleBollinger; // reserved for future UI

  const filtered = data;

  // Compute combined signal events for scatter markers
  const signalEvents = useMemo<SignalEvent[]>(() => {
    if (!showSignals || filtered.length < 60) return [];
    const cfg = signalConfig ?? DEFAULT_SIGNAL_CONFIG;
    const combined = computeCombinedSignals(filtered, cfg);
    return extractCombinedSignalEvents(combined, filtered);
  }, [filtered, showSignals, signalConfig]);

  // Compute Bollinger overlay values for display table
  const bollingerResults = useMemo<BollingerOverlayResult[]>(() => {
    if (!showBollinger || filtered.length < 20) return [];
    const closePrices = filtered.map((d) => d.close);
    return computeAllBollingerOverlays(closePrices);
  }, [filtered, showBollinger]);

  void bollingerResults; // used internally by buildOption

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
    chartInstanceRef.current = chart;

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);

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
    const setCursorOnAll = (cursor: string) => {
      if (!containerRef.current) return;
      containerRef.current.style.cursor = cursor;
      const canvases = containerRef.current.querySelectorAll('canvas');
      canvases.forEach((c) => {
        c.style.cursor = cursor;
      });
    };
    const SLIDER_ZONE_HEIGHT = 34;
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

      if (e.clientX < gridLeft) {
        dragOnPriceAxis = true;
        priceAxisDragStartY = e.clientY;
        const yAxisModel = chart.getModel()?.getComponent('yAxis', 0) as unknown as
          | { axis?: { scale?: { getExtent?: () => [number, number] } } }
          | undefined;
        const extent = yAxisModel?.axis?.scale?.getExtent?.();
        if (extent) {
          priceAxisStartYMin = extent[0];
          priceAxisStartYMax = extent[1];
        }
        e.preventDefault();
        return;
      }

      if (e.clientX > gridRight) {
        dragOnPriceAxis = true;
        priceAxisDragStartY = e.clientY;
        const yAxisModel = chart.getModel()?.getComponent('yAxis', 0) as unknown as
          | { axis?: { scale?: { getExtent?: () => [number, number] } } }
          | undefined;
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
      const yAxisModel = chart.getModel()?.getComponent('yAxis', 0) as unknown as
        | { axis?: { scale?: { getExtent?: () => [number, number] } } }
        | undefined;
      const extent = yAxisModel?.axis?.scale?.getExtent?.();
      if (extent) {
        startYMin = extent[0];
        startYMax = extent[1];
      }
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      if (sliderDragging) {
        const dx = e.clientX - sliderDragStartX;
        const rect = containerRef.current.getBoundingClientRect();
        const pxWidth = rect.width - 160;
        const range = sliderStartZoomEnd - sliderStartZoomStart;
        const mid = (sliderStartZoomStart + sliderStartZoomEnd) / 2;
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
        chart.dispatchAction({
          type: 'dataZoom',
          dataZoomIndex: 1,
          start: newStart,
          end: newEnd,
        });
        return;
      }

      if (dragOnPriceAxis) {
        const dy = e.clientY - priceAxisDragStartY;
        const rect = containerRef.current.getBoundingClientRect();
        const pxHeight = rect.height - 70;
        const yRange = priceAxisStartYMax - priceAxisStartYMin;
        const mid = (priceAxisStartYMin + priceAxisStartYMax) / 2;
        const scaleFactor = 1 + (dy / pxHeight) * 2;
        const newHalf = (yRange / 2) * Math.max(0.1, scaleFactor);
        chart.setOption({
          yAxis: [
            {
              min: mid - newHalf,
              max: mid + newHalf,
            },
          ],
        });
        return;
      }

      if (!dragging) return;
      const rect = containerRef.current.getBoundingClientRect();

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

      const dy = e.clientY - dragStartY;
      const pxHeight = rect.height - 70;
      const yRange = startYMax - startYMin;
      const yShift = (dy / pxHeight) * yRange;

      chart.setOption({
        yAxis: [
          {
            min: startYMin + yShift,
            max: startYMax + yShift,
          },
        ],
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

    const onDblClick = () => {
      chart.setOption({
        yAxis: [{ min: undefined, max: undefined }],
      });
    };
    el.addEventListener('dblclick', onDblClick);

    // Crosshair tracking for legend
    chart.on('updateAxisPointer', (params: unknown) => {
      const p = params as { axesInfo?: Array<{ axisDim?: string; value?: number }> };
      const xInfo = p.axesInfo?.find((a) => a.axisDim === 'x');
      if (xInfo?.value != null && currentDataRef.current.length > 0) {
        const dataIndex = Math.round(xInfo.value);
        const realIdx = dataIndex - getPaddingCount(currentDataRef.current.length, isIntraday(intervalRef.current));
        const bar = currentDataRef.current[realIdx];
        if (bar) {
          const prevClose = realIdx > 0 ? currentDataRef.current[realIdx - 1].close : bar.open;
          onLegendUpdateRef.current({
            symbol: symbolRef.current,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            time: bar.date,
            prevClose,
          });
        } else {
          onLegendUpdateRef.current(null);
        }
      }
    });

    return () => {
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

  // Track previous data identity to decide whether to preserve zoom
  const prevDataLenRef = useRef<number>(0);
  const prevSymbolRef = useRef<string>(symbol);

  // Update chart when data/type/timeframe changes
  const updateChart = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    const dataChanged = filtered.length !== prevDataLenRef.current || symbol !== prevSymbolRef.current;
    let savedZoom: { start: number; end: number } | null = null;
    if (!dataChanged) {
      const opt = chart.getOption() as { dataZoom?: Array<{ start?: number; end?: number }> } | undefined;
      if (opt?.dataZoom && opt.dataZoom.length > 0) {
        savedZoom = {
          start: opt.dataZoom[0].start ?? 0,
          end: opt.dataZoom[0].end ?? 100,
        };
      }
    }
    prevDataLenRef.current = filtered.length;
    prevSymbolRef.current = symbol;

    currentDataRef.current = [...filtered];
    const themeColors = getThemeColors();
    const newOption = buildOption(
      filtered,
      symbol,
      showBollinger,
      visibleBollinger,
      showRSI,
      showMACD,
      showStochRSI,
      logScale,
      themeColors,
      signalEvents,
      signalConfig,
      showSuperTrend,
      showIchimoku,
      showOBV,
      interval,
    );

    if (savedZoom && Array.isArray(newOption.dataZoom)) {
      for (const dz of newOption.dataZoom as Array<{ start?: number; end?: number }>) {
        dz.start = savedZoom.start;
        dz.end = savedZoom.end;
      }
    }

    chart.setOption(newOption, true);
    if (filtered.length > 0) {
      lastBarRef.current = { ...filtered[filtered.length - 1] };
    }
  }, [
    filtered,
    symbol,
    interval,
    showBollinger,
    visibleBollinger,
    showRSI,
    showMACD,
    showStochRSI,
    showSuperTrend,
    showIchimoku,
    showOBV,
    logScale,
    signalEvents,
    signalConfig,
  ]);

  useEffect(() => {
    updateChart();
  }, [updateChart]);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div ref={containerRef} className="chart-container" />
    </div>
  );
}
