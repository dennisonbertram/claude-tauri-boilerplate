import { useState, useEffect, useRef } from 'react';
import { useSettings } from '@/hooks/useSettings';

const PERMISSION_MODE_LABELS: Record<string, string> = {
  default: 'Normal',
  acceptEdits: 'Accept Edits',
  plan: 'Plan',
  bypassPermissions: 'Bypass',
};

const PERMISSION_MODES = [
  { value: 'default', label: 'Normal' },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'plan', label: 'Plan' },
  { value: 'bypassPermissions', label: 'Bypass' },
] as const;

export function PermissionModeSegment({ onShowSettings: _onShowSettings }: { onShowSettings?: (tab?: string) => void }) {
  const { settings, updateSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const label = PERMISSION_MODE_LABELS[settings.permissionMode] ?? 'Normal';
  const isDefault = settings.permissionMode === 'default';

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div ref={ref} className="relative" data-testid="permission-mode-segment">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors ${isDefault ? 'text-muted-foreground/50' : ''}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>{label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-50"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-36 rounded-md border border-border bg-popover shadow-lg z-50">
          {PERMISSION_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => {
                updateSettings({ permissionMode: mode.value });
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted/50 ${
                settings.permissionMode === mode.value ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {settings.permissionMode === mode.value && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {settings.permissionMode !== mode.value && <span className="w-3" />}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
