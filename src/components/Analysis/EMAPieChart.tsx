import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EMADistribution } from './deriveData';

interface Props {
  data: EMADistribution;
}

export default function EMAPieChart({ data }: Props) {
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

    const total = data.idealUp + data.up + data.down + data.idealDown + data.other;

    chart.setOption({
      title: {
        text: 'PIYASA EMA DURUM DAGILIMI',
        left: 12,
        top: 8,
        textStyle: { color: '#8a8e96', fontSize: 12, fontWeight: 600 },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1a1e2e',
        borderColor: '#2a2e3e',
        textStyle: { color: '#e0e3eb', fontSize: 11 },
        formatter: (p: any) => `${p.name}: ${p.value} (%${((p.value / total) * 100).toFixed(1)})`,
      },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'center',
        textStyle: { color: '#8a8e96', fontSize: 10 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['40%', '55%'],
          avoidLabelOverlap: false,
          label: {
            show: true,
            position: 'center',
            formatter: 'EMA',
            fontSize: 14,
            fontWeight: 700,
            color: '#6a6e7e',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 700,
            },
          },
          labelLine: { show: false },
          data: [
            { value: data.idealUp, name: 'Ideal Up', itemStyle: { color: '#26a69a' } },
            { value: data.up, name: 'Up', itemStyle: { color: '#66bb6a' } },
            { value: data.other, name: 'Notr', itemStyle: { color: '#6a6e7e' } },
            { value: data.down, name: 'Down', itemStyle: { color: '#ffa726' } },
            { value: data.idealDown, name: 'Ideal Down', itemStyle: { color: '#ef5350' } },
          ],
        },
      ],
    });
  }, [data]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
