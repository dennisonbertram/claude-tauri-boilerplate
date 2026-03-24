import { useState, useCallback, useEffect } from 'react';
import type { TrackerProjectWithDetails, TrackerPriority } from '@claude-tauri/shared';

const priorityOptions: { value: TrackerPriority; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Low' },
];

interface CreateIssueDialogProps {
  project: TrackerProjectWithDetails;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority?: number;
    statusId?: string;
    assignee?: string;
  }) => Promise<void>;
}

export function CreateIssueDialog({ project, onClose, onSubmit }: CreateIssueDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TrackerPriority>(3);
  const [statusId, setStatusId] = useState(() =>
    project.statuses.length > 0 ? project.statuses[0].id : ''
  );
  const [assignee, setAssignee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setTitle('');
    setDescription('');
    setPriority(3);
    setStatusId(project.statuses.length > 0 ? project.statuses[0].id : '');
    setAssignee('');
    setError(null);
    onClose();
  }, [onClose, project.statuses]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || undefined,
        priority,
        statusId: statusId || undefined,
        assignee: assignee.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, priority, statusId, assignee, onSubmit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  return (
    <>
      {/* Overlay */}
      <div
        data-testid="create-issue-overlay"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        data-testid="create-issue-dialog"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-lg rounded-lg border border-border bg-background shadow-xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold">Create Issue</h2>
            <button
              data-testid="create-issue-close"
              onClick={handleClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <input
                data-testid="create-issue-title"
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(null); }}
                placeholder="Issue title"
                autoFocus
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <textarea
                data-testid="create-issue-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue..."
                rows={4}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {/* Priority & Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Priority</label>
                <select
                  data-testid="create-issue-priority"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) as TrackerPriority)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {priorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Status</label>
                <select
                  data-testid="create-issue-status"
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {project.statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Assignee</label>
              <input
                data-testid="create-issue-assignee"
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Optional assignee"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {/* Error */}
            {error && (
              <p data-testid="create-issue-error" className="text-sm text-destructive">{error}</p>
            )}
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <button
              data-testid="create-issue-cancel"
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="h-8 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="create-issue-submit"
              type="button"
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
              disabled={submitting || !title.trim()}
              className="h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
