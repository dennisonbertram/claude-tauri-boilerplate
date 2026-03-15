import { formatShortcut, isMacPlatform } from '@/hooks/useKeyboardShortcuts';

interface ShortcutBadgeProps {
  /** Shortcut to display. Can be a full ShortcutDefinition or a partial with just key info. */
  shortcut: {
    key: string;
    meta?: boolean;
    shift?: boolean;
  };
  /** Override platform detection for testing */
  isMac?: boolean;
  className?: string;
}

/**
 * A small inline badge showing a keyboard shortcut hint.
 * Uses platform-aware display (Cmd on Mac, Ctrl on Windows/Linux).
 */
export function ShortcutBadge({ shortcut, isMac, className = '' }: ShortcutBadgeProps) {
  const mac = isMac ?? isMacPlatform();

  // Build a minimal ShortcutDefinition for formatShortcut
  const displayText = formatShortcut(
    {
      id: '',
      key: shortcut.key,
      meta: shortcut.meta,
      shift: shortcut.shift,
      label: '',
      category: 'general',
      handler: () => {},
    },
    mac
  );

  return (
    <kbd
      data-testid="shortcut-badge"
      className={`hidden sm:inline-block shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ${className}`}
    >
      {displayText}
    </kbd>
  );
}
