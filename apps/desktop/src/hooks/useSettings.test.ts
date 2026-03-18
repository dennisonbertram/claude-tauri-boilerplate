import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import {
  useSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from './useSettings';
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
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    })) as typeof fetch;
  });

  afterEach(() => {
    localStorageMock.clear();
    globalThis.fetch = originalFetch;
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

    it('has correct default accentColor', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.accentColor).toBe('slate');
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

    it('has correct default chatFont', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.chatFont).toBe('proportional');
    });

    it('has correct default monoFontFamily', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.monoFontFamily).toBe('system');
    });

    it('has correct default chatDensity', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.chatDensity).toBe('comfortable');
    });

    it('has correct default tabDensity', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.tabDensity).toBe('comfortable');
    });

    it('has correct default chatWidth', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.chatWidth).toBe('standard');
    });

    it('has correct default showThinking', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.showThinking).toBe(true);
    });

    it('has correct default showToolCalls', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.showToolCalls).toBe(true);
    });

    it('has correct default showResourceUsage', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect((result.current.settings as any).showResourceUsage).toBe(false);
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

    it('has correct default fastMode', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect((result.current.settings as any).fastMode).toBe(false);
    });

    it('has correct default prReviewModel', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect((result.current.settings as any).prReviewModel).toBe('claude-haiku-4-5-20251001');
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

    it('has empty default runtime environment', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.runtimeEnv).toEqual({});
    });

    it('does not auto-load runtime env from process env', () => {
      const previous = process.env.RUNTIME_RUNTIME_ENV;
      process.env.RUNTIME_RUNTIME_ENV = 'should-not-load';

      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.runtimeEnv.RUNTIME_RUNTIME_ENV).toBeUndefined();

      process.env.RUNTIME_RUNTIME_ENV = previous;
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

    it('adds and updates runtime env variables', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({
          runtimeEnv: { API_KEY: 'sk-test', REGION: 'us-east-1' },
        });
      });

      const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
      expect(stored.runtimeEnv).toEqual({ API_KEY: 'sk-test', REGION: 'us-east-1' });

      act(() => {
        result.current.updateSettings({
          runtimeEnv: { API_KEY: 'rotated', REGION: 'us-east-1' },
        });
      });

      const updated = JSON.parse(localStorageMock._store['claude-tauri-settings']);
      expect(updated.runtimeEnv).toEqual({ API_KEY: 'rotated', REGION: 'us-east-1' });
    });

    it('removes runtime env variables when cleared', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({
          runtimeEnv: { API_KEY: 'sk-test', REGION: 'us-east-1' },
        });
      });

      act(() => {
        result.current.updateSettings({ runtimeEnv: {} });
      });

      const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
      expect(stored.runtimeEnv).toEqual({});
    });

    it('loads saved settings from localStorage on mount', () => {
      const savedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        provider: 'bedrock',
        model: 'claude-opus-4-6',
        bedrockBaseUrl: 'https://bedrock.example.com',
        runtimeEnv: { RUNTIME_TOKEN: 'abc', FEATURE_FLAG: 'true' },
        theme: 'light',
        accentColor: 'rose',
        chatFont: 'mono',
        monoFontFamily: 'courier',
        chatDensity: 'compact',
        tabDensity: 'compact',
        chatWidth: 'wide',
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
      expect(result.current.settings.runtimeEnv).toEqual({
        RUNTIME_TOKEN: 'abc',
        FEATURE_FLAG: 'true',
      });
      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.accentColor).toBe('rose');
      expect(result.current.settings.chatFont).toBe('mono');
      expect(result.current.settings.monoFontFamily).toBe('courier');
      expect(result.current.settings.chatDensity).toBe('compact');
      expect(result.current.settings.tabDensity).toBe('compact');
      expect(result.current.settings.chatWidth).toBe('wide');
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
      expect(result.current.settings.accentColor).toBe('slate');
      expect(result.current.settings.fontSize).toBe(14);
      expect(result.current.settings.chatFont).toBe('proportional');
      expect(result.current.settings.chatDensity).toBe('comfortable');
      expect(result.current.settings.chatWidth).toBe('standard');
    });

    it('handles invalid JSON in localStorage gracefully', () => {
      localStorageMock.setItem('claude-tauri-settings', 'not-json{{{');

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Should fall back to defaults
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('does not persist repository workflow prompts to localStorage', () => {
      saveSettings({
        ...DEFAULT_SETTINGS,
        workflowPrompts: {
          review: 'Repo review prompt',
          pr: 'Repo PR prompt',
          branch: 'Repo branch prompt',
        },
      });

      const savedValue = JSON.parse(
        localStorageMock.setItem.mock.calls.at(-1)![1]
      );
      expect(savedValue.workflowPrompts).toBeUndefined();
    });

    it('hydrates repository workflow prompt overrides on mount', async () => {
      globalThis.fetch = vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.endsWith('/workflow-review.md')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ content: 'Repo review override' }),
          } as Response;
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response;
      }) as typeof fetch;

      const { result } = renderHook(() => useSettings(), { wrapper });

      await waitFor(() => {
        expect(result.current.settings.workflowPrompts.review).toBe(
          'Repo review override'
        );
      });
      expect(result.current.settings.workflowPrompts.pr).toBe(
        DEFAULT_SETTINGS.workflowPrompts.pr
      );
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
          accentColor: 'emerald',
          chatFont: 'mono',
          chatDensity: 'compact',
          chatWidth: 'wide',
          fontSize: 16,
        });
      });

      expect(result.current.settings.model).toBe('claude-haiku-4-5-20251001');
      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.accentColor).toBe('emerald');
      expect(result.current.settings.chatFont).toBe('mono');
      expect(result.current.settings.chatDensity).toBe('compact');
      expect(result.current.settings.chatWidth).toBe('wide');
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
      const { workflowPrompts: _workflowPrompts, ...expectedStored } =
        DEFAULT_SETTINGS;
      expect(stored).toEqual(expectedStored);
    });
  });
});
