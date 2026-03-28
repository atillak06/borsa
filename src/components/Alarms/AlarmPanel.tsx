import { useState, useEffect, useRef, useCallback } from 'react';
import type { Alarm } from '../../hooks/useAlarms';
import type { QuoteData } from '../../api/borsaApi';
import { usePriceService } from '../../hooks/usePriceService';
import './AlarmPanel.css';

interface AlarmPanelProps {
  alarms: Alarm[];
  currentSymbol: string;
  uniqueActiveSymbols: string[];
  onAdd: (alarm: Omit<Alarm, 'id' | 'triggered' | 'createdAt'>) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Alarm>) => void;
  onResetTriggered: (id: string) => void;
  onClose: () => void;
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(alarm: Alarm) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const conditionText = alarm.condition === 'above' ? 'ustune cikti' : 'altina dustu';
    new Notification(`${alarm.symbol} Alarm`, {
      body: `${alarm.symbol} fiyati ${alarm.targetValue} ${conditionText}!`,
      icon: '/favicon.ico',
    });
  }
}

export default function AlarmPanel({
  alarms,
  currentSymbol,
  uniqueActiveSymbols,
  onAdd,
  onRemove,
  onUpdate,
  onResetTriggered,
  onClose,
}: AlarmPanelProps) {
  const [formSymbol, setFormSymbol] = useState(currentSymbol);
  const [formCondition, setFormCondition] = useState<'above' | 'below'>('above');
  const [formTarget, setFormTarget] = useState('');
  const prevPricesRef = useRef<Map<string, number>>(new Map());

  // Live prices for alarm checking
  const prices = usePriceService(uniqueActiveSymbols);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Update form symbol when current symbol changes
  useEffect(() => {
    setFormSymbol(currentSymbol);
  }, [currentSymbol]);

  // Check alarms against live prices
  const checkAlarms = useCallback(
    (priceMap: Map<string, QuoteData>) => {
      for (const alarm of alarms) {
        if (!alarm.enabled || alarm.triggered) continue;
        const quote = priceMap.get(alarm.symbol);
        if (!quote) continue;

        const prevPrice = prevPricesRef.current.get(alarm.symbol);
        const currentPrice = quote.price;

        // Only trigger on transition (not on initial load)
        if (prevPrice === undefined) continue;

        let shouldTrigger = false;
        if (alarm.condition === 'above' && prevPrice < alarm.targetValue && currentPrice >= alarm.targetValue) {
          shouldTrigger = true;
        } else if (alarm.condition === 'below' && prevPrice > alarm.targetValue && currentPrice <= alarm.targetValue) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          onUpdate(alarm.id, { triggered: true, triggeredAt: Date.now() });
          sendNotification(alarm);
        }
      }

      // Update previous prices
      for (const [sym, quote] of priceMap) {
        prevPricesRef.current.set(sym, quote.price);
      }
    },
    [alarms, onUpdate],
  );

  // Run alarm check whenever prices update
  useEffect(() => {
    if (prices.size > 0) {
      checkAlarms(prices);
    }
  }, [prices, checkAlarms]);

  const handleAdd = () => {
    const target = parseFloat(formTarget);
    if (!formSymbol || isNaN(target) || target <= 0) return;

    onAdd({
      symbol: formSymbol.toUpperCase(),
      condition: formCondition,
      targetValue: target,
      enabled: true,
    });
    setFormTarget('');
  };

  const canAdd = formSymbol.trim() !== '' && !isNaN(parseFloat(formTarget)) && parseFloat(formTarget) > 0;

  return (
    <div className="alarm-panel">
      <div className="alarm-header">
        <span className="alarm-title">ALARMLAR</span>
        <button className="alarm-close-btn" onClick={onClose} title="Kapat">
          ✕
        </button>
      </div>

      {/* Add alarm form */}
      <div className="alarm-form">
        <div className="alarm-form-row">
          <input
            className="alarm-input"
            type="text"
            placeholder="Sembol"
            value={formSymbol}
            onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
            style={{ flex: '0 0 80px' }}
          />
          <select
            className="alarm-select"
            value={formCondition}
            onChange={(e) => setFormCondition(e.target.value as 'above' | 'below')}
          >
            <option value="above">Ustune cikarsa</option>
            <option value="below">Altina duserse</option>
          </select>
        </div>
        <div className="alarm-form-row">
          <input
            className="alarm-input"
            type="number"
            step="0.01"
            placeholder="Hedef fiyat"
            value={formTarget}
            onChange={(e) => setFormTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <button className="alarm-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Ekle
          </button>
        </div>
      </div>

      {/* Alarm list */}
      <div className="alarm-list">
        {alarms.length === 0 ? (
          <div className="alarm-empty">
            Henuz alarm eklenmedi.
            <br />
            Yukaridaki formdan fiyat alarmi ekleyin.
          </div>
        ) : (
          [...alarms].reverse().map((alarm) => (
            <div key={alarm.id} className={`alarm-item ${alarm.triggered ? 'triggered' : ''}`}>
              <div className="alarm-item-info">
                <div className="alarm-item-symbol">{alarm.symbol}</div>
                <div className="alarm-item-condition">
                  <span className={alarm.condition}>
                    {alarm.condition === 'above' ? 'Ustune cikarsa' : 'Altina duserse'}
                  </span>
                </div>
              </div>
              <div className="alarm-item-target">{alarm.targetValue.toFixed(2)}</div>
              {alarm.triggered && <span className="alarm-triggered-badge">TETIKLENDI</span>}
              <div className="alarm-item-actions">
                {alarm.triggered ? (
                  <button
                    className="alarm-action-btn"
                    onClick={() => onResetTriggered(alarm.id)}
                    title="Tekrar etkinlestir"
                  >
                    ↻
                  </button>
                ) : (
                  <button
                    className="alarm-action-btn"
                    onClick={() => onUpdate(alarm.id, { enabled: !alarm.enabled })}
                    title={alarm.enabled ? 'Devre disi birak' : 'Etkinlestir'}
                  >
                    {alarm.enabled ? '⏸' : '▶'}
                  </button>
                )}
                <button className="alarm-action-btn delete" onClick={() => onRemove(alarm.id)} title="Sil">
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
