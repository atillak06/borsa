import { useTranslation } from 'react-i18next';
import type { QuoteData, SymbolInfo } from '../../api/borsaApi';
import { usePriceService } from '../../hooks/usePriceService';
import './Watchlist.css';

interface WatchlistProps {
  watchlist: string[];
  symbols: SymbolInfo[];
  currentSymbol: string;
  onSymbolClick: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onClose: () => void;
}

function formatPrice(price: number): string {
  if (price >= 10000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toFixed(2);
}

function PriceCell({ data }: { data: QuoteData | undefined }) {
  if (!data) {
    return (
      <div className="watchlist-item-price">
        <div className="watchlist-item-price-value" style={{ color: 'var(--text-muted)' }}>
          --
        </div>
      </div>
    );
  }

  const positive = data.changePercent >= 0;
  return (
    <div className="watchlist-item-price">
      <div className="watchlist-item-price-value">{formatPrice(data.price)}</div>
      <div className={`watchlist-item-change ${positive ? 'positive' : 'negative'}`}>
        {positive ? '+' : ''}
        {data.changePercent.toFixed(2)}%
      </div>
    </div>
  );
}

export default function Watchlist({
  watchlist,
  symbols,
  currentSymbol,
  onSymbolClick,
  onRemove,
  onClose,
}: WatchlistProps) {
  const { t } = useTranslation();
  const prices = usePriceService(watchlist);

  const getDisplayName = (sym: string) => {
    const info = symbols.find((s) => s.name === sym);
    return info?.displayName ?? sym;
  };

  return (
    <div className="watchlist-panel">
      <div className="watchlist-header">
        <span className="watchlist-title">{t('watchlist.title')}</span>
        <button className="watchlist-close-btn" onClick={onClose} title="Kapat">
          ✕
        </button>
      </div>

      <div className="watchlist-list">
        {watchlist.length === 0 ? (
          <div className="watchlist-empty">
            {t('watchlist.empty')}
            <br />
            {t('watchlist.emptyHint')}
          </div>
        ) : (
          watchlist.map((sym) => (
            <div
              key={sym}
              className={`watchlist-item ${sym === currentSymbol ? 'active' : ''}`}
              onClick={() => onSymbolClick(sym)}
            >
              <div className="watchlist-item-info">
                <div className="watchlist-item-symbol">{sym}</div>
                <div className="watchlist-item-name">{getDisplayName(sym)}</div>
              </div>
              <PriceCell data={prices.get(sym)} />
              <button
                className="watchlist-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(sym);
                }}
                title="Kaldir"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
