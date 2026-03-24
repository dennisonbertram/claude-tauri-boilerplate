import { useState, useEffect, useCallback } from 'react';
import type { TrackerIssue, TrackerProjectWithDetails, TrackerComment, TrackerPriority } from '@claude-tauri/shared';

const priorityOptions: { value: TrackerPriority; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Low' },
];

interface IssueDetailPanelProps {
  issue: TrackerIssue;
  project: TrackerProjectWithDetails;
  comments?: TrackerComment[];
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (issueId: string, content: string) => Promise<void>;
}

export function IssueDetailPanel({
  issue,
  project,
  comments = [],
  onClose,
  onUpdate,
  onDelete,
  onAddComment,
}: IssueDetailPanelProps) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? '');
  const [statusId, setStatusId] = useState(issue.statusId);
  const [priority, setPriority] = useState<TrackerPriority>(issue.priority);
  const [assignee, setAssignee] = useState(issue.assignee ?? '');
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset local state when issue changes
  useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description ?? '');
    setStatusId(issue.statusId);
    setPriority(issue.priority);
    setAssignee(issue.assignee ?? '');
    setConfirmDelete(false);
  }, [issue]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSaveField = useCallback(async (field: string, value: unknown) => {
    try {
      setSaving(true);
      await onUpdate(issue.id, { [field]: value });
    } finally {
      setSaving(false);
    }
  }, [issue.id, onUpdate]);

  const handleTitleBlur = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== issue.title) {
      handleSaveField('title', trimmed);
    }
  }, [title, issue.title, handleSaveField]);

  const handleDescriptionBlur = useCallback(() => {
    const trimmed = description.trim();
    if (trimmed !== (issue.description ?? '')) {
      handleSaveField('description', trimmed || null);
    }
  }, [description, issue.description, handleSaveField]);

  const handleAssigneeBlur = useCallback(() => {
    const trimmed = assignee.trim();
    if (trimmed !== (issue.assignee ?? '')) {
      handleSaveField('assignee', trimmed || null);
    }
  }, [assignee, issue.assignee, handleSaveField]);

  const handleStatusChange = useCallback((newStatusId: string) => {
    setStatusId(newStatusId);
    handleSaveField('statusId', newStatusId);
  }, [handleSaveField]);

  const handlePriorityChange = useCallback((newPriority: TrackerPriority) => {
    setPriority(newPriority);
    handleSaveField('priority', newPriority);
  }, [handleSaveField]);

  const handleAddComment = useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    await onAddComment(issue.id, trimmed);
    setCommentText('');
  }, [commentText, issue.id, onAddComment]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(issue.id);
    onClose();
  }, [confirmDelete, issue.id, onDelete, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        data-testid="issue-detail-overlay"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Panel - slides in from right */}
      <div
        data-testid="issue-detail-panel"
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl border-l border-border bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm text-muted-foreground font-mono">{issue.identifier}</span>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}
            <button
              data-testid="issue-detail-close"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Title */}
          <input
            data-testid="issue-detail-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full text-lg font-semibold text-foreground bg-transparent outline-none border-b border-transparent hover:border-border focus:border-ring pb-1 transition-colors"
          />

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <select
                data-testid="issue-detail-status"
                value={statusId}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {project.statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</label>
              <select
                data-testid="issue-detail-priority"
                value={priority}
                onChange={(e) => handlePriorityChange(Number(e.target.value) as TrackerPriority)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assignee</label>
            <input
              data-testid="issue-detail-assignee"
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              onBlur={handleAssigneeBlur}
              placeholder="Unassigned"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {/* Labels */}
          {issue.labels && issue.labels.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {issue.labels.map((label) => (
                  <span
                    key={label.id}
                    className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground"
                    style={label.color ? { backgroundColor: label.color + '20', color: label.color } : undefined}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
            <textarea
              data-testid="issue-detail-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description..."
              rows={6}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {/* Comments */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comments</label>

            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 py-2">No comments yet</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{comment.author}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment */}
            <div className="space-y-2">
              <textarea
                data-testid="issue-detail-comment-input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <button
                data-testid="issue-detail-add-comment"
                type="button"
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="h-7 rounded-lg bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3 flex items-center justify-between">
          <button
            data-testid="issue-detail-delete"
            type="button"
            onClick={handleDelete}
            className={`h-8 rounded-lg px-3 text-sm transition-colors ${
              confirmDelete
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'text-destructive hover:bg-destructive/10'
            }`}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete Issue'}
          </button>
          <span className="text-xs text-muted-foreground">
            Created {new Date(issue.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </>
  );
}
