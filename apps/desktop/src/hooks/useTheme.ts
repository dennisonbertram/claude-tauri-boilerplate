import { useEffect, useState, useCallback } from 'react';
import { useSettings } from './useSettings';

type EffectiveTheme = 'dark' | 'light';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Resolves the effective theme based on the user's setting and system preference.
 */
function resolveTheme(
  setting: 'dark' | 'light' | 'system',
  systemPrefersDark: boolean
): EffectiveTheme {
  if (setting === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return setting;
}

/**
 * Applies the resolved theme to the document element by toggling the `dark` class.
 */
function applyThemeToDocument(effectiveTheme: EffectiveTheme): void {
  const root = document.documentElement;
  if (effectiveTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Hook that bridges the theme setting from useSettings to the DOM.
 *
 * - Reads the theme preference ('dark' | 'light' | 'system') from settings
 * - Detects system preference via matchMedia
 * - Applies the `dark` class to <html> for Tailwind dark mode
 * - Adds `theme-transition` class for smooth CSS transitions
 * - Listens for OS preference changes when theme is 'system'
 */
export function useTheme() {
  const { settings } = useSettings();
  const theme = settings.theme;

  // Track system preference
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    return window.matchMedia(MEDIA_QUERY).matches;
  });

  // Listen for system preference changes
  useEffect(() => {
    const mql = window.matchMedia(MEDIA_QUERY);

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  const effectiveTheme = resolveTheme(theme, systemPrefersDark);

  // Apply theme class to document
  useEffect(() => {
    applyThemeToDocument(effectiveTheme);
  }, [effectiveTheme]);

  // Add transition class on mount for smooth theme switches
  useEffect(() => {
    document.documentElement.classList.add('theme-transition');
  }, []);

  return {
    /** The user's raw theme setting: 'dark' | 'light' | 'system' */
    theme,
    /** The resolved theme actually applied: 'dark' | 'light' */
    effectiveTheme,
  };
}
