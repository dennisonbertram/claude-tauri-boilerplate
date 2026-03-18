import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

// We need to mock useSettings so we can control the theme value
const mockUpdateSettings = vi.fn();
let mockTheme: 'dark' | 'light' | 'system' = 'dark';
let mockAccent: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' = 'slate';
let mockMonoFontFamily: 'system' | 'menlo' | 'courier' = 'system';

vi.mock('./useSettings', () => ({
  useSettings: () => ({
    settings: {
      theme: mockTheme,
      accentColor: mockAccent,
      monoFontFamily: mockMonoFontFamily,
    },
    updateSettings: mockUpdateSettings,
  }),
}));

// Mock matchMedia for system preference detection
function createMatchMediaMock(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    // Helper to simulate a system preference change
    _triggerChange(newMatches: boolean) {
      listeners.forEach((cb) =>
        cb({ matches: newMatches } as MediaQueryListEvent)
      );
    },
    _listeners: listeners,
  };
}

let matchMediaMock: ReturnType<typeof createMatchMediaMock>;

describe('useTheme', () => {
  beforeEach(() => {
    // Reset theme setting
    mockTheme = 'dark';
    mockAccent = 'slate';
    mockMonoFontFamily = 'system';
    mockUpdateSettings.mockClear();

    // Clean up html classes
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.remove('theme-transition');
    document.documentElement.removeAttribute('style');

    // Setup matchMedia mock
    matchMediaMock = createMatchMediaMock(false); // system prefers light by default
    vi.stubGlobal('matchMedia', vi.fn(() => matchMediaMock));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('dark', 'light', 'theme-transition');
  });

  describe('applying dark/light class to document', () => {
    it('adds "dark" class to <html> when theme is "dark"', async () => {
      mockTheme = 'dark';
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('removes "dark" class from <html> when theme is "light"', async () => {
      mockTheme = 'light';
      // Pre-set dark to make sure it gets removed
      document.documentElement.classList.add('dark');
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('does not add "dark" class when theme is "light"', async () => {
      mockTheme = 'light';
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('accent color application', () => {
    it('applies the selected accent palette to CSS variables', async () => {
      mockTheme = 'light';
      mockAccent = 'rose';
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(
        document.documentElement.style.getPropertyValue('--primary')
      ).toBe('#e11d48');
      expect(
        document.documentElement.style.getPropertyValue('--primary-foreground')
      ).toBe('#ffffff');
      expect(
        document.documentElement.style.getPropertyValue('--ring')
      ).toBe('#fb7185');
    });
  });

  describe('chat mono font application', () => {
    it('applies the selected mono font stack to CSS variables', async () => {
      mockMonoFontFamily = 'courier';
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(
        document.documentElement.style.getPropertyValue('--chat-mono-font')
      ).toContain('"Courier New"');
    });
  });

  describe('system preference detection', () => {
    it('applies dark mode when theme is "system" and OS prefers dark', async () => {
      mockTheme = 'system';
      matchMediaMock = createMatchMediaMock(true); // OS prefers dark
      vi.stubGlobal('matchMedia', vi.fn(() => matchMediaMock));
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('applies light mode when theme is "system" and OS prefers light', async () => {
      mockTheme = 'system';
      matchMediaMock = createMatchMediaMock(false); // OS prefers light
      vi.stubGlobal('matchMedia', vi.fn(() => matchMediaMock));
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('calls matchMedia with the correct query', async () => {
      mockTheme = 'system';
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });
  });

  describe('responds to setting changes', () => {
    it('switches from dark to light when theme setting changes', async () => {
      mockTheme = 'dark';
      const { useTheme } = await import('./useTheme');

      const { rerender } = renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Simulate settings change
      mockTheme = 'light';
      rerender();

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('switches from light to dark when theme setting changes', async () => {
      mockTheme = 'light';
      const { useTheme } = await import('./useTheme');

      const { rerender } = renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Simulate settings change
      mockTheme = 'dark';
      rerender();

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('responds to OS preference change when theme is "system"', async () => {
      mockTheme = 'system';
      matchMediaMock = createMatchMediaMock(false); // starts light
      vi.stubGlobal('matchMedia', vi.fn(() => matchMediaMock));
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // OS changes to dark
      act(() => {
        matchMediaMock._triggerChange(true);
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('theme transition class', () => {
    it('adds theme-transition class to <html> element on mount', async () => {
      mockTheme = 'dark';
      const { useTheme } = await import('./useTheme');

      renderHook(() => useTheme());

      expect(document.documentElement.classList.contains('theme-transition')).toBe(true);
    });
  });

  describe('return value', () => {
    it('returns the effective theme (dark or light), not the setting', async () => {
      mockTheme = 'dark';
      const { useTheme } = await import('./useTheme');

      const { result } = renderHook(() => useTheme());

      expect(result.current.effectiveTheme).toBe('dark');
    });

    it('returns "dark" when system preference is dark and theme is "system"', async () => {
      mockTheme = 'system';
      matchMediaMock = createMatchMediaMock(true);
      vi.stubGlobal('matchMedia', vi.fn(() => matchMediaMock));
      const { useTheme } = await import('./useTheme');

      const { result } = renderHook(() => useTheme());

      expect(result.current.effectiveTheme).toBe('dark');
    });

    it('returns "light" when system preference is light and theme is "system"', async () => {
      mockTheme = 'system';
      matchMediaMock = createMatchMediaMock(false);
      vi.stubGlobal('matchMedia', vi.fn(() => matchMediaMock));
      const { useTheme } = await import('./useTheme');

      const { result } = renderHook(() => useTheme());

      expect(result.current.effectiveTheme).toBe('light');
    });

    it('returns the raw theme setting value', async () => {
      mockTheme = 'system';
      const { useTheme } = await import('./useTheme');

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('system');
    });
  });

  describe('cleanup', () => {
    it('removes matchMedia listener on unmount', async () => {
      mockTheme = 'system';
      matchMediaMock = createMatchMediaMock(false);
      vi.stubGlobal('matchMedia', vi.fn(() => matchMediaMock));
      const { useTheme } = await import('./useTheme');

      const { unmount } = renderHook(() => useTheme());

      expect(matchMediaMock.addEventListener).toHaveBeenCalled();

      unmount();

      expect(matchMediaMock.removeEventListener).toHaveBeenCalled();
    });
  });
});
