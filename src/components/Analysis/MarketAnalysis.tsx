import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ScanRow, ScanProgress } from '../../api/borsaApi';
import { startScan, fetchScanResults, clearScanCache } from '../../api/borsaApi';
import PearsonScatter from './PearsonScatter';
import MomentumScatter from './MomentumScatter';
import EMAPieChart from './EMAPieChart';
import TopPearsonTable from './TopPearsonTable';
import ScanResultsTable from './ScanResultsTable';
import {
  derivePearsonScatterData,
  deriveMomentumScatterData,
  deriveEMADistribution,
  deriveTopPearson,
} from './deriveData';
import './MarketAnalysis.css';

interface Props {
  onSymbolClick?: (symbol: string) => void;
}

export default function MarketAnalysis({ onSymbolClick }: Props) {
  const [results, setResults] = useState<ScanRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doScan = useCallback(() => {
    abortRef.current?.abort();
    setScanning(true);
    setError(null);
    setProgress(null);
    setResults([]);

    const ctrl = startScan(
      (p) => setProgress(p),
      (c) => {
        setResults(c.results);
        setScanning(false);
        setCacheAge(0);
      },
      (err) => {
        setError(err);
        setScanning(false);
      },
    );

    abortRef.current = ctrl;
  }, []);

  // On mount: try cached results first, then start scan if empty
  useEffect(() => {
    let cancelled = false;

    fetchScanResults()
      .then((res) => {
        if (cancelled) return;
        if (res.results && res.results.length > 0) {
          setResults(res.results);
          setCacheAge(res.cache_age_seconds ?? null);
        } else {
          // No cache — start scan
          doScan();
        }
      })
      .catch(() => {
        if (!cancelled) doScan();
      });

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [doScan]);

  const handleRescan = useCallback(() => {
    setScanning(true);
    setProgress(null);
    setResults([]);
    setError(null);
    clearScanCache()
      .then(() => doScan())
      .catch(() => {
        setError('Cache temizlenemedi');
        setScanning(false);
      });
  }, [doScan]);

  // Derived datasets
  const pearsonScatter = useMemo(() => derivePearsonScatterData(results), [results]);
  const momentumScatter = useMemo(() => deriveMomentumScatterData(results), [results]);
  const emaDistribution = useMemo(() => deriveEMADistribution(results), [results]);
  const topPearson = useMemo(() => deriveTopPearson(results), [results]);

  return (
    <div className="market-analysis">
      {/* Header */}
      <div className="analysis-header">
        <div className="analysis-header-left">
          <h2 className="analysis-title">Piyasa Analizi</h2>
          {results.length > 0 && (
            <span className="analysis-subtitle">
              {results.length} hisse analiz edildi
              {cacheAge !== null && cacheAge > 0 && (
                <span className="cache-age"> (cache: {Math.round(cacheAge / 60)} dk)</span>
              )}
            </span>
          )}
        </div>
        <div className="analysis-header-right">
          <button className="rescan-btn" onClick={handleRescan} disabled={scanning}>
            {scanning ? 'Taraniyor...' : 'Yeniden Tara'}
          </button>
        </div>
      </div>

      {/* Progress bar — always visible when scanning */}
      {scanning && (
        <div className="scan-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: progress ? `${(progress.completed / progress.total) * 100}%` : '2%',
              }}
            />
          </div>
          <div className="progress-text">
            {progress
              ? `${progress.completed} / ${progress.total} hisse tarandi (${progress.found} sonuc)`
              : 'Tarama baslatiliyor...'}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="scan-error">Hata: {error}</div>}

      {/* Charts 2x2 grid */}
      {results.length > 0 && (
        <>
          <div className="analysis-grid">
            <div className="analysis-card">
              <PearsonScatter data={pearsonScatter} onSymbolClick={onSymbolClick} />
            </div>
            <div className="analysis-card">
              <TopPearsonTable data={topPearson} onSymbolClick={onSymbolClick} />
            </div>
            <div className="analysis-card">
              <EMAPieChart data={emaDistribution} />
            </div>
            <div className="analysis-card">
              <MomentumScatter data={momentumScatter} onSymbolClick={onSymbolClick} />
            </div>
          </div>

          {/* Full table */}
          <div className="analysis-table-section">
            <ScanResultsTable data={results} onSymbolClick={onSymbolClick} />
          </div>
        </>
      )}

      {/* Loading placeholder when no results yet */}
      {scanning && results.length === 0 && !error && (
        <div className="scan-loading">
          <div className="scan-loading-spinner" />
          <div className="scan-loading-text">Tum hisseler taraniyor, bu islem ~2 dakika surebilir...</div>
        </div>
      )}
    </div>
  );
}
