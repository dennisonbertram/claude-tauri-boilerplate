import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (repoPath: string) => Promise<void>;
}

export function AddProjectDialog({ isOpen, onClose, onSubmit }: AddProjectDialogProps) {
  const [repoPath, setRepoPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoPath.trim();
    if (!trimmed) return;

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(trimmed);
      setRepoPath('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project');
    } finally {
      setSubmitting(false);
    }
  }, [repoPath, onSubmit, onClose]);

  const handleClose = useCallback(() => {
    setRepoPath('');
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-popover p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Add Project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the path to a local git repository.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Input
              type="text"
              placeholder="/path/to/your/repo"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="mt-1.5 text-sm text-destructive">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!repoPath.trim() || submitting}>
              {submitting ? 'Adding...' : 'Add Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
