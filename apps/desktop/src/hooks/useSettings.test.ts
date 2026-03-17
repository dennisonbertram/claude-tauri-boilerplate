import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { useSettings, DEFAULT_SETTINGS, loadSettings } from './useSettings';
import type { AppSettings } from './useSettings';
import { SettingsProvider } from '@/contexts/SettingsContext';

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

// Wrapper to provide SettingsProvider context
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(SettingsProvider, null, children);
}

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
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('has correct default provider', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.provider).toBe('anthropic');
    });

    it('has correct default model (full model ID)', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.model).toBe('claude-sonnet-4-6');
    });

    it('has correct default theme', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.theme).toBe('dark');
    });

    it('has correct default maxTokens', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.maxTokens).toBe(4096);
    });

    it('has correct default temperature', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.temperature).toBe(1.0);
    });

    it('has correct default fontSize', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.fontSize).toBe(14);
    });

    it('has correct default showThinking', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.showThinking).toBe(true);
    });

    it('has correct default showToolCalls', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.showToolCalls).toBe(true);
    });

    it('has correct default permissionMode', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.permissionMode).toBe('default');
    });

    it('has correct default autoCompact', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.autoCompact).toBe(false);
    });

    it('has correct default maxTurns', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.maxTurns).toBe(25);
    });

    it('has correct default effort', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.effort).toBe('high');
    });

    it('has an empty default apiKey', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.apiKey).toBe('');
    });

    it('has an empty default systemPrompt', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.systemPrompt).toBe('');
    });

    it('has empty default provider config values', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.bedrockBaseUrl).toBe('');
      expect(result.current.settings.bedrockProjectId).toBe('');
      expect(result.current.settings.vertexProjectId).toBe('');
      expect(result.current.settings.vertexBaseUrl).toBe('');
      expect(result.current.settings.customBaseUrl).toBe('');
    });
  });

  describe('localStorage persistence', () => {
    it('saves settings to localStorage when updateSettings is called', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({ model: 'claude-opus-4-6' });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claude-tauri-settings',
        expect.any(String)
      );

      const savedValue = JSON.parse(
        localStorageMock.setItem.mock.calls.at(-1)![1]
      );
      expect(savedValue.model).toBe('claude-opus-4-6');
    });

    it('loads saved settings from localStorage on mount', () => {
      const savedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        provider: 'bedrock',
        model: 'claude-opus-4-6',
        bedrockBaseUrl: 'https://bedrock.example.com',
        theme: 'light',
        maxTokens: 8192,
      };
      localStorageMock.setItem(
        'claude-tauri-settings',
        JSON.stringify(savedSettings)
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.model).toBe('claude-opus-4-6');
      expect(result.current.settings.provider).toBe('bedrock');
      expect(result.current.settings.bedrockBaseUrl).toBe('https://bedrock.example.com');
      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.maxTokens).toBe(8192);
    });

    it('merges saved settings with defaults for missing keys', () => {
      // Save only partial settings (simulates a schema upgrade)
      localStorageMock.setItem(
        'claude-tauri-settings',
        JSON.stringify({ model: 'claude-haiku-4-5-20251001' })
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.model).toBe('claude-haiku-4-5-20251001');
      // Other fields should have defaults
      expect(result.current.settings.theme).toBe('dark');
      expect(result.current.settings.fontSize).toBe(14);
    });

    it('handles invalid JSON in localStorage gracefully', () => {
      localStorageMock.setItem('claude-tauri-settings', 'not-json{{{');

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Should fall back to defaults
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('model migration', () => {
    it('migrates old "sonnet" short name to full model ID', () => {
      localStorageMock.setItem(
        'claude-tauri-settings',
        JSON.stringify({ ...DEFAULT_SETTINGS, model: 'sonnet' })
      );

      const settings = loadSettings();
      expect(settings.model).toBe('claude-sonnet-4-6');
    });

    it('migrates old "opus" short name to full model ID', () => {
      localStorageMock.setItem(
        'claude-tauri-settings',
        JSON.stringify({ ...DEFAULT_SETTINGS, model: 'opus' })
      );

      const settings = loadSettings();
      expect(settings.model).toBe('claude-opus-4-6');
    });

    it('migrates old "haiku" short name to full model ID', () => {
      localStorageMock.setItem(
        'claude-tauri-settings',
        JSON.stringify({ ...DEFAULT_SETTINGS, model: 'haiku' })
      );

      const settings = loadSettings();
      expect(settings.model).toBe('claude-haiku-4-5-20251001');
    });

    it('does not change already-full model IDs', () => {
      localStorageMock.setItem(
        'claude-tauri-settings',
        JSON.stringify({ ...DEFAULT_SETTINGS, model: 'claude-opus-4-6' })
      );

      const settings = loadSettings();
      expect(settings.model).toBe('claude-opus-4-6');
    });
  });

  describe('updateSettings', () => {
    it('updates a single setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({ model: 'claude-opus-4-6' });
      });

      expect(result.current.settings.model).toBe('claude-opus-4-6');
      // Other settings unchanged
      expect(result.current.settings.theme).toBe('dark');
    });

    it('updates multiple settings at once', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({
          model: 'claude-haiku-4-5-20251001',
          theme: 'light',
          fontSize: 16,
        });
      });

      expect(result.current.settings.model).toBe('claude-haiku-4-5-20251001');
      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.fontSize).toBe(16);
    });

    it('persists updates to localStorage', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({ temperature: 0.5 });
      });

      const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
      expect(stored.temperature).toBe(0.5);
    });
  });

  describe('resetSettings', () => {
    it('resets all settings to defaults', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({
          model: 'claude-opus-4-6',
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
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({ model: 'claude-opus-4-6' });
      });

      act(() => {
        result.current.resetSettings();
      });

      const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
      expect(stored).toEqual(DEFAULT_SETTINGS);
    });
  });
});
