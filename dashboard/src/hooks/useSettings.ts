import { useState, useCallback } from 'react';

export interface AppSettings {
  heatmapSortBy: 'score' | 'time' | 'agent';
  showLowRisk: boolean;
  alertMinScore: number;
  ruleConfidenceMin: number;
  soundAlerts: boolean;
  pollingIntervalSec: 30 | 60 | 120;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  heatmapSortBy: 'score',
  showLowRisk: true,
  alertMinScore: 0,
  ruleConfidenceMin: 70,
  soundAlerts: false,
  pollingIntervalSec: 30,
};

const STORAGE_KEY = 'eso:settings:v1';

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SETTINGS_DEFAULTS;
    return { ...SETTINGS_DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return SETTINGS_DEFAULTS;
  }
}

function persist(s: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable — settings are session-only
  }
}

export function useSettings(): {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
} {
  const [settings, setSettings] = useState<AppSettings>(load);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    persist(SETTINGS_DEFAULTS);
    setSettings(SETTINGS_DEFAULTS);
  }, []);

  return { settings, update, reset };
}
