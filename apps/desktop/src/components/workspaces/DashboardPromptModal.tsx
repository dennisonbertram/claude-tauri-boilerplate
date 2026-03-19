// Modal for collecting a dashboard generation prompt from the user.
// Replaces window.prompt() across all dashboard creation/regeneration flows.

import { useEffect, useRef } from 'react';

export interface DashboardPromptModalProps {
  isOpen: boolean;
  title: string;
  defaultValue?: string;
  isLoading: boolean;
  error?: string | null;
  onConfirm: (prompt: string) => void;
  onCancel: () => void;
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function DashboardPromptModal({
  isOpen,
  title,
  defaultValue = '',
  isLoading,
  error,
  onConfirm,
  onCancel,
}: DashboardPromptModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when opened and populate with defaultValue
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.value = defaultValue;
      textareaRef.current.focus();
    }
  }, [isOpen, defaultValue]);

  // Escape key to cancel, Cmd+Enter to submit
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        const value = textareaRef.current?.value ?? '';
        if (value.trim() && !isLoading) {
          onConfirm(value.trim());
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onConfirm, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const value = textareaRef.current?.value ?? '';
    if (value.trim() && !isLoading) {
      onConfirm(value.trim());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-popover p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>

        <div className="mt-4">
          <textarea
            ref={textareaRef}
            rows={4}
            placeholder="Describe what this dashboard should show..."
            disabled={isLoading}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            aria-label="Dashboard prompt"
          />
          {error && (
            <p className="mt-1.5 text-sm text-destructive">{error}</p>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Press <kbd className="font-mono">Cmd+Enter</kbd> to generate
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading && <SpinnerIcon />}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
