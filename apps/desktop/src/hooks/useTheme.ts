import { useEffect, useState, useCallback } from 'react';
import { useSettings } from './useSettings';

type EffectiveTheme = 'dark' | 'light';
type AccentColor = 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';

type AccentTokens = {
  primary: string;
  primaryForeground: string;
  ring: string;
  accent: string;
  accentForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
};

const ACCENT_PALETTES: Record<
  AccentColor,
  Record<EffectiveTheme, AccentTokens>
> = {
  slate: {
    light: {
      primary: '#334155',
      primaryForeground: '#ffffff',
      ring: '#94a3b8',
      accent: '#e2e8f0',
      accentForeground: '#0f172a',
      sidebarPrimary: '#334155',
      sidebarPrimaryForeground: '#ffffff',
    },
    dark: {
      primary: '#e2e8f0',
      primaryForeground: '#0f172a',
      ring: '#94a3b8',
      accent: '#334155',
      accentForeground: '#f8fafc',
      sidebarPrimary: '#e2e8f0',
      sidebarPrimaryForeground: '#0f172a',
    },
  },
  blue: {
    light: {
      primary: '#2563eb',
      primaryForeground: '#ffffff',
      ring: '#3b82f6',
      accent: '#dbeafe',
      accentForeground: '#1e3a8a',
      sidebarPrimary: '#2563eb',
      sidebarPrimaryForeground: '#ffffff',
    },
    dark: {
      primary: '#60a5fa',
      primaryForeground: '#0f172a',
      ring: '#93c5fd',
      accent: '#1d4ed8',
      accentForeground: '#dbeafe',
      sidebarPrimary: '#60a5fa',
      sidebarPrimaryForeground: '#0f172a',
    },
  },
  emerald: {
    light: {
      primary: '#059669',
      primaryForeground: '#ffffff',
      ring: '#10b981',
      accent: '#d1fae5',
      accentForeground: '#064e3b',
      sidebarPrimary: '#059669',
      sidebarPrimaryForeground: '#ffffff',
    },
    dark: {
      primary: '#34d399',
      primaryForeground: '#052e16',
      ring: '#6ee7b7',
      accent: '#064e3b',
      accentForeground: '#d1fae5',
      sidebarPrimary: '#34d399',
      sidebarPrimaryForeground: '#052e16',
    },
  },
  amber: {
    light: {
      primary: '#d97706',
      primaryForeground: '#ffffff',
      ring: '#f59e0b',
      accent: '#fef3c7',
      accentForeground: '#78350f',
      sidebarPrimary: '#d97706',
      sidebarPrimaryForeground: '#ffffff',
    },
    dark: {
      primary: '#f59e0b',
      primaryForeground: '#451a03',
      ring: '#fbbf24',
      accent: '#78350f',
      accentForeground: '#fef3c7',
      sidebarPrimary: '#f59e0b',
      sidebarPrimaryForeground: '#451a03',
    },
  },
  rose: {
    light: {
      primary: '#e11d48',
      primaryForeground: '#ffffff',
      ring: '#fb7185',
      accent: '#ffe4e6',
      accentForeground: '#881337',
      sidebarPrimary: '#e11d48',
      sidebarPrimaryForeground: '#ffffff',
    },
    dark: {
      primary: '#fb7185',
      primaryForeground: '#4c0519',
      ring: '#fda4af',
      accent: '#881337',
      accentForeground: '#ffe4e6',
      sidebarPrimary: '#fb7185',
      sidebarPrimaryForeground: '#4c0519',
    },
  },
};

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

function applyAccentToDocument(
  effectiveTheme: EffectiveTheme,
  accentColor: AccentColor
): void {
  const root = document.documentElement;
  const tokens = ACCENT_PALETTES[accentColor][effectiveTheme];
  root.style.setProperty('--primary', tokens.primary);
  root.style.setProperty('--primary-foreground', tokens.primaryForeground);
  root.style.setProperty('--ring', tokens.ring);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--accent-foreground', tokens.accentForeground);
  root.style.setProperty('--sidebar-primary', tokens.sidebarPrimary);
  root.style.setProperty('--sidebar-primary-foreground', tokens.sidebarPrimaryForeground);
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
  const accentColor = settings.accentColor;

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

  // Apply theme and accent tokens to document
  useEffect(() => {
    applyThemeToDocument(effectiveTheme);
    applyAccentToDocument(effectiveTheme, accentColor);
  }, [accentColor, effectiveTheme]);

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
