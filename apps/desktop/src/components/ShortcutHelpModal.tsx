import { useMemo } from 'react';
import {
  formatShortcut,
  isMacPlatform,
  type ShortcutDefinition,
  type ShortcutCategory,
} from '@/hooks/useKeyboardShortcuts';

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  general: 'General',
  chat: 'Chat',
  navigation: 'Navigation',
};

const CATEGORY_ORDER: ShortcutCategory[] = ['general', 'chat', 'navigation'];

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutDefinition[];
  /** Override platform detection for testing */
  isMac?: boolean;
}

export function ShortcutHelpModal({
  isOpen,
  onClose,
  shortcuts,
  isMac,
}: ShortcutHelpModalProps) {
  const mac = isMac ?? isMacPlatform();

  const grouped = useMemo(() => {
    const groups: { category: ShortcutCategory; label: string; shortcuts: ShortcutDefinition[] }[] = [];

    for (const cat of CATEGORY_ORDER) {
      const items = shortcuts.filter((s) => s.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, label: CATEGORY_LABELS[cat], shortcuts: items });
      }
    }

    return groups;
  }, [shortcuts]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="shortcut-help-backdrop"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        data-testid="shortcut-help-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-label="Keyboard Shortcuts"
      >
        <div className="w-full max-w-lg rounded-lg border border-border bg-popover shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-popover-foreground">
              Keyboard Shortcuts
            </h2>
            <button
              data-testid="shortcut-help-close"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto px-6 py-4">
            {grouped.map((group) => (
              <div key={group.category} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-popover-foreground">
                        {shortcut.label}
                      </span>
                      <kbd
                        data-testid="shortcut-kbd"
                        className="ml-4 shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
                      >
                        {formatShortcut(shortcut, mac)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
