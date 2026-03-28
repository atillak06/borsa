import type { CryptoTicker } from '../../api/cryptoApi';

interface CryptoTickerBarProps {
  tickers: CryptoTicker[];
  currentSymbol: string;
  onSymbolClick: (symbol: string) => void;
  loading: boolean;
}

function formatCryptoPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
  return vol.toFixed(0);
}

export default function CryptoTickerBar({ tickers, currentSymbol, onSymbolClick, loading }: CryptoTickerBarProps) {
  if (loading && tickers.length === 0) {
    return (
      <div className="crypto-ticker-bar">
        <span className="crypto-ticker-loading">Fiyatlar yukleniyor...</span>
      </div>
    );
  }

  return (
    <div className="crypto-ticker-bar">
      {tickers.map((t) => {
        const positive = t.priceChangePercent >= 0;
        const active = t.symbol === currentSymbol;
        return (
          <div
            key={t.symbol}
            className={`crypto-ticker-item ${active ? 'active' : ''}`}
            onClick={() => onSymbolClick(t.symbol)}
          >
            <span className="cti-symbol">{t.symbol.replace('USDT', '')}</span>
            <span className={`cti-price ${positive ? 'positive' : 'negative'}`}>${formatCryptoPrice(t.price)}</span>
            <span className={`cti-change ${positive ? 'positive' : 'negative'}`}>
              {positive ? '+' : ''}
              {t.priceChangePercent.toFixed(2)}%
            </span>
            <span className="cti-vol">{formatVolume(t.quoteVolume)}</span>
          </div>
        );
      })}
    </div>
  );
}
