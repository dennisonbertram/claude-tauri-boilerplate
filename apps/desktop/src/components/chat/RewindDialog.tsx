import { useState, useEffect } from 'react';
import type { Checkpoint, RewindPreview } from '@claude-tauri/shared';

export type RewindMode = 'code_and_conversation' | 'conversation_only' | 'code_only';

interface RewindDialogProps {
  checkpoint: Checkpoint;
  preview: RewindPreview | null;
  isLoadingPreview: boolean;
  onRewind: (mode: RewindMode) => void;
  onCancel: () => void;
}

const modeDescriptions: Record<RewindMode, string> = {
  code_and_conversation: 'Code & Conversation (restore both)',
  conversation_only: 'Conversation only (keep current code)',
  code_only: 'Code only (keep conversation)',
};

export function RewindDialog({
  checkpoint,
  preview,
  isLoadingPreview,
  onRewind,
  onCancel,
}: RewindDialogProps) {
  const [mode, setMode] = useState<RewindMode>('code_and_conversation');

  // Reset mode on open
  useEffect(() => {
    setMode('code_and_conversation');
  }, [checkpoint.id]);

  return (
    <div
      data-testid="rewind-dialog-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        data-testid="rewind-dialog"
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Rewind to Checkpoint"
      >
        {/* Title */}
        <h2
          data-testid="rewind-dialog-title"
          className="text-lg font-semibold text-foreground mb-4"
        >
          Rewind to Checkpoint
        </h2>

        {/* Checkpoint info */}
        <div data-testid="rewind-checkpoint-info" className="mb-4">
          <p className="text-sm text-foreground">
            <span className="font-medium">Turn {checkpoint.turnIndex + 1}:</span>{' '}
            "{checkpoint.promptPreview}"
          </p>
        </div>

        {/* Preview data */}
        <div data-testid="rewind-preview-section" className="mb-4">
          {isLoadingPreview ? (
            <p data-testid="rewind-preview-loading" className="text-sm text-muted-foreground">
              Loading preview...
            </p>
          ) : preview ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <p data-testid="rewind-files-affected">
                {preview.filesAffected.length} file{preview.filesAffected.length !== 1 ? 's' : ''} affected
              </p>
              <p data-testid="rewind-messages-removed">
                {preview.messagesRemoved} message{preview.messagesRemoved !== 1 ? 's' : ''} removed
              </p>
            </div>
          ) : null}
        </div>

        {/* Mode selection */}
        <div data-testid="rewind-mode-section" className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Rewind Mode:</p>
          <div className="space-y-2">
            {(Object.entries(modeDescriptions) as [RewindMode, string][]).map(([key, label]) => (
              <label
                key={key}
                data-testid={`rewind-mode-${key}`}
                className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
              >
                <input
                  type="radio"
                  name="rewind-mode"
                  value={key}
                  checked={mode === key}
                  onChange={() => setMode(key)}
                  className="text-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div data-testid="rewind-warning" className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-600 dark:text-yellow-400">
          This action cannot be undone
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            data-testid="rewind-cancel-btn"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="rewind-confirm-btn"
            onClick={() => onRewind(mode)}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Rewind
          </button>
        </div>
      </div>
    </div>
  );
}
