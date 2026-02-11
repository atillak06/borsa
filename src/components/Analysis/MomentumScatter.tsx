import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { MomentumPoint } from './deriveData';

interface Props {
  data: MomentumPoint[];
  onSymbolClick?: (symbol: string) => void;
}

export default function MomentumScatter({ data, onSymbolClick }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    instanceRef.current = chart;

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;

    const seriesData = data.map((d, i) => ({
      value: [i, d.slope],
      symbol_name: d.symbol,
      signal: d.signal,
      itemStyle: {
        color: d.slope > 0 ? '#26a69a' : '#ef5350',
      },
    }));

    chart.setOption({
      title: {
        text: 'MOMENTUM DAGILIMI (EGIM)',
        left: 12,
        top: 8,
        textStyle: { color: '#8a8e96', fontSize: 12, fontWeight: 600 },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1a1e2e',
        borderColor: '#2a2e3e',
        textStyle: { color: '#e0e3eb', fontSize: 11 },
        formatter: (p: any) => {
          const d = p.data;
          return `<b>${d.symbol_name}</b><br/>Egim: %${Number(d.value[1]).toFixed(4)}`;
        },
      },
      grid: { left: 55, right: 20, top: 40, bottom: 32 },
      xAxis: {
        name: 'Hisse',
        nameLocation: 'center',
        nameGap: 20,
        nameTextStyle: { color: '#6a6e7e', fontSize: 10 },
        splitLine: { show: false },
        axisLine: { lineStyle: { color: '#2a2e3e' } },
        axisLabel: { show: false },
      },
      yAxis: {
        name: 'Egim (%)',
        nameLocation: 'center',
        nameGap: 42,
        nameTextStyle: { color: '#6a6e7e', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1a1e2e' } },
        axisLine: { lineStyle: { color: '#2a2e3e' } },
        axisLabel: { color: '#6a6e7e', fontSize: 10 },
      },
      series: [
        {
          type: 'scatter',
          data: seriesData,
          symbolSize: 5,
        },
      ],
    });

    chart.off('click');
    chart.on('click', (params: any) => {
      if (params.data?.symbol_name && onSymbolClick) {
        onSymbolClick(params.data.symbol_name);
      }
    });
  }, [data, onSymbolClick]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
