import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  projectName: string;
  defaultBranch: string;
  onClose: () => void;
  onSubmit: (
    name: string,
    baseBranch?: string,
    sourceBranch?: string
  ) => Promise<void>;
}

export function CreateWorkspaceDialog({ isOpen, projectName, defaultBranch, onClose, onSubmit }: CreateWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Workspace name is required');
      return;
    }
    setNameError('');
    const trimmedName = name.trim();

    try {
      setSubmitting(true);
      setError(null);
      const branch = baseBranch.trim() || undefined;
      const source = sourceBranch.trim() || undefined;
      await onSubmit(trimmedName, branch, source);
      setName('');
      setBaseBranch('');
      setSourceBranch('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setSubmitting(false);
    }
  }, [name, baseBranch, sourceBranch, onSubmit, onClose]);

  const handleClose = useCallback(() => {
    setName('');
    setBaseBranch('');
    setSourceBranch('');
    setNameError('');
    setError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-popover p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-foreground">Create Workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          New workspace in <span className="font-medium text-foreground">{projectName}</span>
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input
              type="text"
              placeholder="my-feature"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
              className="mt-1"
              autoFocus
            />
            {nameError && <p className="text-sm text-destructive mt-1">{nameError}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Base Branch</label>
            <Input
              type="text"
              placeholder={defaultBranch}
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Defaults to {defaultBranch}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Source Branch (optional)</label>
            <Input
              type="text"
              placeholder="feature/auth"
              value={sourceBranch}
              onChange={(e) => setSourceBranch(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Optional custom branch to base this workspace on.
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
