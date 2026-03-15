import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface WorkspaceMergeDialogProps {
  isOpen: boolean;
  mode: 'merge' | 'discard';
  workspaceName: string;
  branch: string;
  baseBranch: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function WorkspaceMergeDialog({ isOpen, mode, workspaceName, branch, baseBranch, onClose, onConfirm }: WorkspaceMergeDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} workspace`);
    } finally {
      setSubmitting(false);
    }
  }, [mode, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-popover p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">
          {mode === 'merge' ? 'Merge Workspace' : 'Discard Workspace'}
        </h2>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          {mode === 'merge' ? (
            <p>
              This will merge branch <span className="font-mono text-foreground">{branch}</span> into{' '}
              <span className="font-mono text-foreground">{baseBranch}</span>.
            </p>
          ) : (
            <>
              <p>
                This will delete the worktree and branch for{' '}
                <span className="font-medium text-foreground">{workspaceName}</span>.
              </p>
              <p className="text-destructive">This cannot be undone.</p>
            </>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={mode === 'discard' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting
              ? (mode === 'merge' ? 'Merging...' : 'Discarding...')
              : (mode === 'merge' ? 'Merge' : 'Discard')
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
