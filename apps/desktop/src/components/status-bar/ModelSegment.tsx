import { useState, useEffect, useRef, useCallback } from 'react';
import { AVAILABLE_MODELS, getModelDisplay } from '@/lib/models';
import { useSettings } from '@/hooks/useSettings';

export function ModelSegment({ model }: { model: string | null }) {
  const { settings, updateSettings } = useSettings();
  const selectedModel = settings.model;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectModelByIndex = useCallback((index: number) => {
    const nextModel = AVAILABLE_MODELS[index];
    if (!nextModel) return false;
    updateSettings({ model: nextModel.id });
    setOpen(false);
    return true;
  }, [updateSettings]);

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

  // Fast switching: while picker is open, number keys map to model options.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const index = Number.parseInt(e.key, 10) - 1;
      if (!Number.isFinite(index)) return;
      if (selectModelByIndex(index)) {
        e.preventDefault();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, selectModelByIndex]);

  const displayLabel = selectedModel ? getModelDisplay(selectedModel) : (model ?? 'No model');

  return (
    <div ref={ref} className="relative" data-testid="model-segment">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
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
          <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4Z" />
          <circle cx="12" cy="14" r="2" />
        </svg>
        <span className="truncate max-w-[120px]">{displayLabel}</span>
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
        <div className="absolute bottom-full left-0 mb-1 w-44 rounded-md border border-border bg-popover shadow-lg z-50">
          {AVAILABLE_MODELS.map((m, index) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                selectModelByIndex(index);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted/50 ${
                selectedModel === m.id ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {selectedModel === m.id && (
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
              {selectedModel !== m.id && <span className="w-3" />}
              <span>{m.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">{index + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
