import { useState, useCallback, useMemo } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

export interface Alarm {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetValue: number;
  enabled: boolean;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

const DEFAULT_KEY = 'borsa_alarms';

export function useAlarms(storageKey = DEFAULT_KEY) {
  const [alarms, setAlarms] = useState<Alarm[]>(() => loadFromStorage<Alarm[]>(storageKey, []));

  const addAlarm = useCallback(
    (alarm: Omit<Alarm, 'id' | 'triggered' | 'createdAt'>) => {
      setAlarms((prev) => {
        const newAlarm: Alarm = {
          ...alarm,
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          triggered: false,
          createdAt: Date.now(),
        };
        const next = [...prev, newAlarm];
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const removeAlarm = useCallback(
    (id: string) => {
      setAlarms((prev) => {
        const next = prev.filter((a) => a.id !== id);
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const updateAlarm = useCallback(
    (id: string, updates: Partial<Alarm>) => {
      setAlarms((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...updates } : a));
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const resetTriggered = useCallback(
    (id: string) => {
      setAlarms((prev) => {
        const next = prev.map((a) =>
          a.id === id ? { ...a, triggered: false, triggeredAt: undefined, enabled: true } : a,
        );
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const uniqueActiveSymbols = useMemo(
    () => [...new Set(alarms.filter((a) => a.enabled && !a.triggered).map((a) => a.symbol))],
    [alarms],
  );

  return { alarms, addAlarm, removeAlarm, updateAlarm, resetTriggered, uniqueActiveSymbols };
}
