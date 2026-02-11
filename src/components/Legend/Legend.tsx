import type { LegendData } from '../Chart/types';
import { formatPrice, formatVolume, formatChange } from '../../utils/formatters';
import './Legend.css';

interface LegendProps {
  data: LegendData | null;
  symbol: string;
  lastClose: number;
  prevClose: number;
}

export default function Legend({ data, symbol, lastClose, prevClose }: LegendProps) {
  const displayData = data ?? {
    symbol,
    open: lastClose,
    high: lastClose,
    low: lastClose,
    close: lastClose,
    volume: 0,
    time: '',
    prevClose,
  };

  const change = formatChange(displayData.close, displayData.prevClose || prevClose);

  return (
    <div className="legend">
      <div className="legend-row">
        <span className="legend-symbol">{displayData.symbol}</span>
        <span className={`legend-change ${change.positive ? 'positive' : 'negative'}`}>
          {change.value} ({change.percent})
        </span>
      </div>
      <div className="legend-row">
        <span className="legend-label">A</span>
        <span className="legend-value">{formatPrice(displayData.open)}</span>
        <span className="legend-label">Y</span>
        <span className="legend-value">{formatPrice(displayData.high)}</span>
        <span className="legend-label">D</span>
        <span className="legend-value">{formatPrice(displayData.low)}</span>
        <span className="legend-label">K</span>
        <span className={`legend-value ${displayData.close >= displayData.open ? 'positive' : 'negative'}`}>
          {formatPrice(displayData.close)}
        </span>
        <span className="legend-label">Hac</span>
        <span className="legend-value">{formatVolume(displayData.volume)}</span>
      </div>
    </div>
  );
}
