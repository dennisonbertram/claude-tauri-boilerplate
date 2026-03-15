import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings, DEFAULT_SETTINGS } from './useSettings';
import type { AppSettings } from './useSettings';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get _store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useSettings', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('default values', () => {
    it('returns default settings when localStorage is empty', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('has correct default model', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.model).toBe('sonnet');
    });

    it('has correct default theme', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.theme).toBe('dark');
    });

    it('has correct default maxTokens', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.maxTokens).toBe(4096);
    });

    it('has correct default temperature', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.temperature).toBe(1.0);
    });

    it('has correct default fontSize', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.fontSize).toBe(14);
    });

    it('has correct default showThinking', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.showThinking).toBe(true);
    });

    it('has correct default showToolCalls', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.showToolCalls).toBe(true);
    });

    it('has correct default permissionMode', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.permissionMode).toBe('default');
    });

    it('has correct default autoCompact', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.autoCompact).toBe(false);
    });

    it('has correct default maxTurns', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.maxTurns).toBe(25);
    });

    it('has correct default effort', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.effort).toBe('high');
    });

    it('has an empty default apiKey', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.apiKey).toBe('');
    });

    it('has an empty default systemPrompt', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.systemPrompt).toBe('');
    });
  });

  describe('localStorage persistence', () => {
    it('saves settings to localStorage when updateSettings is called', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ model: 'opus' });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claude-tauri-settings',
        expect.any(String)
      );

      const savedValue = JSON.parse(
        localStorageMock.setItem.mock.calls.at(-1)![1]
      );
      expect(savedValue.model).toBe('opus');
    });

    it('loads saved settings from localStorage on mount', () => {
      const savedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        model: 'opus',
        theme: 'light',
        maxTokens: 8192,
      };
      localStorageMock.setItem(
        'claude-tauri-settings',
        JSON.stringify(savedSettings)
      );

      const { result } = renderHook(() => useSettings());

      expect(result.current.settings.model).toBe('opus');
      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.maxTokens).toBe(8192);
    });

    it('merges saved settings with defaults for missing keys', () => {
      // Save only partial settings (simulates a schema upgrade)
      localStorageMock.setItem(
        'claude-tauri-settings',
        JSON.stringify({ model: 'haiku' })
      );

      const { result } = renderHook(() => useSettings());

      expect(result.current.settings.model).toBe('haiku');
      // Other fields should have defaults
      expect(result.current.settings.theme).toBe('dark');
      expect(result.current.settings.fontSize).toBe(14);
    });

    it('handles invalid JSON in localStorage gracefully', () => {
      localStorageMock.setItem('claude-tauri-settings', 'not-json{{{');

      const { result } = renderHook(() => useSettings());

      // Should fall back to defaults
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('updateSettings', () => {
    it('updates a single setting', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ model: 'opus' });
      });

      expect(result.current.settings.model).toBe('opus');
      // Other settings unchanged
      expect(result.current.settings.theme).toBe('dark');
    });

    it('updates multiple settings at once', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({
          model: 'haiku',
          theme: 'light',
          fontSize: 16,
        });
      });

      expect(result.current.settings.model).toBe('haiku');
      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.fontSize).toBe(16);
    });

    it('persists updates to localStorage', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ temperature: 0.5 });
      });

      const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
      expect(stored.temperature).toBe(0.5);
    });
  });

  describe('resetSettings', () => {
    it('resets all settings to defaults', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({
          model: 'opus',
          theme: 'light',
          fontSize: 20,
          maxTurns: 50,
        });
      });

      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('persists reset to localStorage', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ model: 'opus' });
      });

      act(() => {
        result.current.resetSettings();
      });

      const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
      expect(stored).toEqual(DEFAULT_SETTINGS);
    });
  });
});
