import { useState, useCallback } from 'react';

export interface AppSettings {
  // General
  apiKey: string;
  model: 'sonnet' | 'opus' | 'haiku';
  maxTokens: number;

  // Model
  temperature: number;
  systemPrompt: string;
  effort: 'low' | 'medium' | 'high' | 'max';

  // Appearance
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  showThinking: boolean;
  showToolCalls: boolean;

  // Advanced
  permissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
  autoCompact: boolean;
  maxTurns: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // General
  apiKey: '',
  model: 'sonnet',
  maxTokens: 4096,

  // Model
  temperature: 1.0,
  systemPrompt: '',
  effort: 'high',

  // Appearance
  theme: 'dark',
  fontSize: 14,
  showThinking: true,
  showToolCalls: true,

  // Advanced
  permissionMode: 'default',
  autoCompact: false,
  maxTurns: 25,
};

const STORAGE_KEY = 'claude-tauri-settings';

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(stored);
    // Merge with defaults so new keys get default values
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS };
    setSettings(defaults);
    saveSettings(defaults);
  }, []);

  return { settings, updateSettings, resetSettings };
}
