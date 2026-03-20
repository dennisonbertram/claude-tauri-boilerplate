import { useState, useCallback, useEffect } from 'react';
import { Warning, GitMerge } from '@phosphor-icons/react';
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-popover p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
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
              <div className="flex items-start gap-2">
                <Warning className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p>
                  This will delete the worktree and branch for{' '}
                  <span className="font-medium text-foreground">{workspaceName}</span>.
                </p>
              </div>
              <p className="text-destructive">This cannot be undone.</p>
            </>
          )}
        </div>
        {/* Confirmation summary */}
        <div className="mt-3 border rounded-md p-3 bg-muted/30 text-sm">
          {mode === 'merge' ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <GitMerge className="h-4 w-4 shrink-0" />
              <span>
                Merge workspace <span className="font-medium text-foreground">{workspaceName}</span> (<span className="font-mono text-foreground">{branch}</span>) into <span className="font-mono text-foreground">{baseBranch}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Warning className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                Permanently discard workspace <span className="font-medium text-foreground">{workspaceName}</span> and branch <span className="font-mono text-foreground">{branch}</span>
              </span>
            </div>
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
