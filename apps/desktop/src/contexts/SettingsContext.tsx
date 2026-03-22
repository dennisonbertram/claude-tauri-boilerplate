import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppSettings } from '@/hooks/useSettings';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  loadCredentials,
  saveCredentials,
} from '@/hooks/useSettings';
import { loadRepoWorkflowPrompts } from '@/lib/workflowPrompts';

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Fields that are stored in the secure credential store. */
const CREDENTIAL_FIELDS: ReadonlySet<string> = new Set(['apiKey', 'githubToken']);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // Load credentials from the secure store on mount
  useEffect(() => {
    let cancelled = false;

    void loadCredentials().then((creds) => {
      if (cancelled || Object.keys(creds).length === 0) return;
      setSettings((prev) => ({ ...prev, ...creds }));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadRepoWorkflowPrompts()
      .then((workflowPrompts) => {
        if (cancelled || Object.keys(workflowPrompts).length === 0) return;

        setSettings((prev) => ({
          ...prev,
          workflowPrompts: {
            ...prev.workflowPrompts,
            ...workflowPrompts,
          },
        }));
      })
      .catch(() => {
        // Keep defaults/local settings when repository overrides are unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      // Persist non-credential settings synchronously
      saveSettings(next);
      // Persist credential fields asynchronously
      const hasCredentials = Object.keys(updates).some((k) => CREDENTIAL_FIELDS.has(k));
      if (hasCredentials) {
        void saveCredentials(updates);
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS };
    setSettings(defaults);
    saveSettings(defaults);
    // Clear credentials in the secure store
    void saveCredentials({ apiKey: '', githubToken: '' });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return ctx;
}
