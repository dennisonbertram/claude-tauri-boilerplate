import { useEffect, useMemo } from 'react';

export type ShortcutCategory = 'general' | 'chat' | 'navigation';

export interface ShortcutDefinition {
  /** Unique identifier for this shortcut */
  id: string;
  /** The key to listen for (e.g. 'k', 'n', 'Escape', 'Enter', '?', '/') */
  key: string;
  /** Require meta key (Cmd on Mac, Ctrl on Windows/Linux) */
  meta?: boolean;
  /** Require shift key */
  shift?: boolean;
  /** Human-readable label shown in help modal */
  label: string;
  /** Category for grouping in the help modal */
  category: ShortcutCategory;
  /** Handler called when the shortcut is triggered */
  handler: () => void;
  /** Whether this shortcut is enabled (default: true) */
  enabled?: boolean;
}

export interface UseKeyboardShortcutsReturn {
  /** The registered shortcuts (for rendering help modal, badges, etc.) */
  shortcuts: ShortcutDefinition[];
}

/**
 * Detect if the current platform is Mac.
 * Uses navigator.platform for reliable detection (userAgentData is not
 * universally available and navigator.platform works fine for Mac vs others).
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/** Special key display names */
const KEY_DISPLAY: Record<string, string> = {
  Escape: 'Esc',
  Enter: '\u23CE', // Return symbol
  ArrowUp: '\u2191',
  ArrowDown: '\u2193',
  ArrowLeft: '\u2190',
  ArrowRight: '\u2192',
  Backspace: '\u232B',
  Delete: '\u2326',
  Tab: '\u21E5',
  ' ': 'Space',
};

/**
 * Format a shortcut definition for display.
 *
 * @param shortcut - The shortcut to format
 * @param isMac - Whether to use Mac symbols (Cmd) or Windows/Linux labels (Ctrl)
 * @returns Human-readable string like "Cmd+K" or "Ctrl+K"
 */
export function formatShortcut(shortcut: ShortcutDefinition, isMac: boolean): string {
  const parts: string[] = [];

  if (shortcut.meta) {
    parts.push(isMac ? '\u2318' : 'Ctrl');
  }

  if (shortcut.shift) {
    parts.push(isMac ? '\u21E7' : 'Shift');
  }

  const keyDisplay = KEY_DISPLAY[shortcut.key] ?? shortcut.key;
  parts.push(keyDisplay);

  return isMac ? parts.join('') : parts.join('+');
}

/**
 * Build a string key for a shortcut combination, used for conflict detection.
 */
function shortcutComboKey(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];
  if (shortcut.meta) parts.push('meta');
  if (shortcut.shift) parts.push('shift');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
}

/**
 * Global keyboard shortcut registry.
 *
 * Registers shortcuts on mount and cleans them up on unmount.
 * Supports modifier keys (meta/ctrl, shift) and conflict detection.
 *
 * @param shortcuts - Array of shortcut definitions to register
 * @returns Object containing the registered shortcuts for rendering
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutDefinition[]
): UseKeyboardShortcutsReturn {
  // Check for conflicts on mount (dev-time warning only)
  useMemo(() => {
    const seenIds = new Set<string>();
    const seenCombos = new Map<string, string>();

    for (const shortcut of shortcuts) {
      // Check duplicate IDs
      if (seenIds.has(shortcut.id)) {
        console.warn(
          `[useKeyboardShortcuts] duplicate shortcut id: "${shortcut.id}"`
        );
      }
      seenIds.add(shortcut.id);

      // Check key combination conflicts
      const combo = shortcutComboKey(shortcut);
      const existingId = seenCombos.get(combo);
      if (existingId) {
        console.warn(
          `[useKeyboardShortcuts] key conflict: "${shortcut.id}" and "${existingId}" both use ${combo}`
        );
      }
      seenCombos.set(combo, shortcut.id);
    }
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        // Skip disabled shortcuts
        if (shortcut.enabled === false) continue;

        // Check key match (case-insensitive)
        if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;

        // Check meta modifier
        const needsMeta = shortcut.meta ?? false;
        const hasMeta = e.metaKey || e.ctrlKey;
        if (needsMeta !== hasMeta) continue;

        // Check shift modifier
        const needsShift = shortcut.shift ?? false;
        if (needsShift !== e.shiftKey) continue;

        // Match found
        e.preventDefault();
        shortcut.handler();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return { shortcuts };
}
