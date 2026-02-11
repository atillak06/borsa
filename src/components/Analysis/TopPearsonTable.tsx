import type { TopPearsonRow } from './deriveData';

interface Props {
  data: TopPearsonRow[];
  onSymbolClick?: (symbol: string) => void;
}

export default function TopPearsonTable({ data, onSymbolClick }: Props) {
  return (
    <div className="top-pearson-table">
      <div className="analysis-card-title">TOP 10 PEARSON SKORU</div>
      <table className="top-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Hisse</th>
            <th>Kapanis</th>
            <th>Pearson</th>
            <th>Kanal</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.symbol}>
              <td className="rank">{i + 1}</td>
              <td>
                <button
                  className="symbol-link"
                  onClick={() => onSymbolClick?.(row.symbol)}
                >
                  {row.symbol}
                </button>
              </td>
              <td>{row.close.toFixed(2)}</td>
              <td className={row.pearson > 0.5 ? 'val-green' : row.pearson < -0.5 ? 'val-red' : ''}>
                {row.pearson.toFixed(4)}
              </td>
              <td className="channel-name">{row.channel}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">Veri yok</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
