export function formatPrice(price: number): string {
  if (price >= 10000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return price.toFixed(2);
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return (volume / 1_000_000_000).toFixed(2) + 'B';
  }
  if (volume >= 1_000_000) {
    return (volume / 1_000_000).toFixed(2) + 'M';
  }
  if (volume >= 1_000) {
    return (volume / 1_000).toFixed(1) + 'K';
  }
  return volume.toString();
}

export function formatChange(current: number, previous: number): { value: string; percent: string; positive: boolean } {
  const diff = current - previous;
  const percent = (diff / previous) * 100;
  const positive = diff >= 0;
  return {
    value: (positive ? '+' : '') + formatPrice(diff),
    percent: (positive ? '+' : '') + percent.toFixed(2) + '%',
    positive,
  };
}
