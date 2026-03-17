interface LatestTurnChangesDialogProps {
  open: boolean;
  loading: boolean;
  diff: string;
  error: string | null;
  onClose: () => void;
}

export function LatestTurnChangesDialog({
  open,
  loading,
  diff,
  error,
  onClose,
}: LatestTurnChangesDialogProps) {
  if (!open) return null;

  return (
    <div
      data-testid="latest-changes-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="latest-changes-dialog"
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-3xl mx-4 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Latest Turn Changes"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Latest turn changes</h2>
          <button
            data-testid="latest-changes-close"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        {loading ? (
          <p data-testid="latest-changes-loading" className="text-sm text-muted-foreground">
            Loading diff...
          </p>
        ) : error ? (
          <p data-testid="latest-changes-error" className="text-sm text-red-500">
            {error}
          </p>
        ) : (
          <pre
            data-testid="latest-changes-diff"
            className="text-xs whitespace-pre overflow-auto max-h-[70vh] bg-muted/30 border border-border rounded p-3"
          >
            {diff || 'No changes detected.'}
          </pre>
        )}
      </div>
    </div>
  );
}

