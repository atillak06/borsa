import { useState, useEffect, useRef } from 'react';
import { fetchFinancials } from '../../api/borsaApi';
import type { FinancialsResponse } from '../../api/borsaApi';
import './Financials.css';

type ReportType = 'income_stmt' | 'balance_sheet' | 'cashflow';

const REPORT_LABELS: Record<ReportType, string> = {
  income_stmt: 'Gelir Tablosu',
  balance_sheet: 'Bilanço',
  cashflow: 'Nakit Akış',
};

interface FinancialsProps {
  symbol: string;
}

function formatCell(val: number | string | null): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'string') return val;
  if (val === 0) return '0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + ' Mlr';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + ' Mln';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + ' B';
  return val.toFixed(0);
}

function formatPeriod(dateStr: string): string {
  // Format: "2024/12" → "2024", "2024/3" → "2024/Q1", "2024/6" → "2024/Q2", etc.
  const slashParts = dateStr.split('/');
  if (slashParts.length === 2) {
    const year = slashParts[0];
    const month = parseInt(slashParts[1], 10);
    if (month === 12) return year;
    const qMap: Record<number, string> = { 3: 'Q1', 6: 'Q2', 9: 'Q3' };
    return year + '/' + (qMap[month] || `M${month}`);
  }
  // Format: "2024-01-01" style
  const dashParts = dateStr.split('-');
  if (dashParts.length >= 2) {
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const month = parseInt(dashParts[1], 10);
    return months[month - 1] + ' ' + dashParts[0];
  }
  return dateStr;
}

export default function Financials({ symbol }: FinancialsProps) {
  const [report, setReport] = useState<ReportType>('income_stmt');
  const [quarterly, setQuarterly] = useState(false);
  const [data, setData] = useState<FinancialsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const tableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchFinancials(symbol, report, quarterly)
      .then((res) => {
        if (!cancelled) {
          if (res.error) setError(res.error);
          setData(res);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [symbol, report, quarterly]);

  // Scroll table to the right (newest data) when data loads
  useEffect(() => {
    if (data && data.data.length > 0 && tableWrapRef.current) {
      tableWrapRef.current.scrollLeft = tableWrapRef.current.scrollWidth;
    }
  }, [data]);

  return (
    <div className="financials">
      <div className="financials-header">
        <div className="financials-tabs">
          {(Object.keys(REPORT_LABELS) as ReportType[]).map((key) => (
            <button
              key={key}
              className={`fin-tab ${report === key ? 'active' : ''}`}
              onClick={() => setReport(key)}
            >
              {REPORT_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="financials-toggle">
          <button
            className={`fin-tab ${!quarterly ? 'active' : ''}`}
            onClick={() => setQuarterly(false)}
          >
            Yıllık
          </button>
          <button
            className={`fin-tab ${quarterly ? 'active' : ''}`}
            onClick={() => setQuarterly(true)}
          >
            Çeyreklik
          </button>
        </div>
      </div>

      {loading && <div className="fin-loading">Yükleniyor...</div>}
      {error && <div className="fin-error">{error}</div>}

      {!loading && data && data.data.length > 0 && (
        <div className="fin-table-wrap" ref={tableWrapRef}>
          <table className="fin-table">
            <thead>
              <tr>
                <th className="fin-item-col">Kalem</th>
                {data.periods.map((p) => (
                  <th key={p}>{formatPeriod(p)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((row, i) => (
                <tr key={i}>
                  <td className="fin-item-col" title={row.item}>{row.item}</td>
                  {data.periods.map((p) => {
                    const val = row[p];
                    const isNeg = typeof val === 'number' && val < 0;
                    return (
                      <td key={p} className={isNeg ? 'negative' : ''}>
                        {formatCell(val as number | null)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && data && data.data.length === 0 && !error && (
        <div className="fin-empty">Finansal veri bulunamadı.</div>
      )}
    </div>
  );
}
