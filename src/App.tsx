import { useState, useCallback, useEffect, useRef } from 'react';
import Toolbar from './components/Toolbar/Toolbar';
import ChartContainer from './components/Chart/ChartContainer';
import Legend from './components/Legend/Legend';
import Financials from './components/Financials/Financials';
import MarketAnalysis from './components/Analysis/MarketAnalysis';
import type { Interval, LegendData } from './components/Chart/types';
import { fetchHistory, fetchSymbols } from './api/borsaApi';
import type { OHLCVData, SymbolInfo } from './api/borsaApi';
import './App.css';

export default function App() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [symbol, setSymbol] = useState('THYAO');
  const [interval, setInterval_] = useState<Interval>('1d');
  const [logScale, setLogScale] = useState(false);
  const [legendData, setLegendData] = useState<LegendData | null>(null);
  const [data, setData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFinancials, setShowFinancials] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [showWilliamsR, setShowWilliamsR] = useState(false);
  const [showNizamiCedid, setShowNizamiCedid] = useState(false);
  const [showMATLRNS, setShowMATLRNS] = useState(false);
  const [activeView, setActiveView] = useState<'chart' | 'analysis'>('chart');
  const [finHeight, setFinHeight] = useState(300);
  const splitterRef = useRef<HTMLDivElement>(null);

  // Fetch symbol list on mount
  useEffect(() => {
    fetchSymbols()
      .then((res) => {
        const all = [...res.stocks, ...res.indices];
        setSymbols(all);
      })
      .catch(() => {
        setSymbols([
          { name: 'THYAO', displayName: 'Türk Hava Yolları' },
          { name: 'GARAN', displayName: 'Garanti Bankası' },
          { name: 'AKBNK', displayName: 'Akbank' },
          { name: 'ASELS', displayName: 'Aselsan' },
          { name: 'EREGL', displayName: 'Ereğli Demir Çelik' },
        ]);
      });
  }, []);

  // Fetch all history data when symbol or interval changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchHistory(symbol, 'max', interval)
      .then((records) => {
        if (!cancelled) {
          setData(records);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  // Splitter drag
  useEffect(() => {
    if (!showFinancials) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = finHeight;

      const onMove = (ev: MouseEvent) => {
        const diff = startY - ev.clientY;
        setFinHeight(Math.max(120, Math.min(window.innerHeight - 200, startH + diff)));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    const splitter = splitterRef.current;
    splitter?.addEventListener('mousedown', onMouseDown);
    return () => splitter?.removeEventListener('mousedown', onMouseDown);
  }, [showFinancials, finHeight]);

  const lastBar = data.length > 0 ? data[data.length - 1] : null;
  const prevBar = data.length > 1 ? data[data.length - 2] : null;

  const handleLegendUpdate = useCallback((d: LegendData | null) => {
    setLegendData(d);
  }, []);

  const handleAnalysisSymbolClick = useCallback((sym: string) => {
    setSymbol(sym);
    setActiveView('chart');
  }, []);

  return (
    <div className="app">
      <Toolbar
        symbol={symbol}
        symbols={symbols}
        interval={interval}
        onSymbolChange={setSymbol}
        onIntervalChange={setInterval_}
        onToggleFinancials={() => setShowFinancials((v) => !v)}
        showFinancials={showFinancials}
        onToggleChannels={() => setShowChannels((v) => !v)}
        showChannels={showChannels}
        onToggleWilliamsR={() => setShowWilliamsR((v) => !v)}
        showWilliamsR={showWilliamsR}
        onToggleNizamiCedid={() => setShowNizamiCedid((v) => !v)}
        showNizamiCedid={showNizamiCedid}
        onToggleMATLRNS={() => setShowMATLRNS((v) => !v)}
        showMATLRNS={showMATLRNS}
        logScale={logScale}
        onToggleLogScale={() => setLogScale((v) => !v)}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      {activeView === 'chart' ? (
        <>
          <div className="chart-wrapper" style={showFinancials ? { flex: '1 1 0', minHeight: 200 } : undefined}>
            <Legend
              data={legendData}
              symbol={symbol}
              lastClose={lastBar?.close ?? 0}
              prevClose={prevBar?.close ?? lastBar?.close ?? 0}
            />
            {loading ? (
              <div className="loading-overlay">Veri yükleniyor...</div>
            ) : (
              <ChartContainer
                data={data}
                symbol={symbol}
                interval={interval}
                onLegendUpdate={handleLegendUpdate}
                showChannels={showChannels}
                showWilliamsR={showWilliamsR}
                showNizamiCedid={showNizamiCedid}
                showMATLRNS={showMATLRNS}
                logScale={logScale}
              />
            )}
          </div>
          {showFinancials && (
            <>
              <div ref={splitterRef} className="splitter" />
              <div className="financials-panel" style={{ height: finHeight }}>
                <Financials symbol={symbol} />
              </div>
            </>
          )}
        </>
      ) : (
        <div className="analysis-wrapper">
          <MarketAnalysis onSymbolClick={handleAnalysisSymbolClick} />
        </div>
      )}
    </div>
  );
}
