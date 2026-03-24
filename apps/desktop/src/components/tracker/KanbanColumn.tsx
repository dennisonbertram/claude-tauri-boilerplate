import { useState, useCallback } from 'react';
import type { TrackerStatus, TrackerIssue } from '@claude-tauri/shared';
import { IssueCard } from './IssueCard';

const categoryColors: Record<string, string> = {
  backlog: 'text-muted-foreground',
  todo: 'text-foreground',
  in_progress: 'text-blue-400',
  done: 'text-green-400',
  cancelled: 'text-muted-foreground/50',
};

interface KanbanColumnProps {
  status: TrackerStatus;
  issues: TrackerIssue[];
  onIssueClick: (issue: TrackerIssue) => void;
  onDrop: (issueId: string, statusId: string, sortOrder: number) => void;
  onDragStart: (e: React.DragEvent, issue: TrackerIssue) => void;
}

export function KanbanColumn({ status, issues, onIssueClick, onDrop, onDragStart }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const issueId = e.dataTransfer.getData('text/plain');
    if (issueId) {
      // Place at end of column
      const maxSort = issues.reduce((max, i) => Math.max(max, i.sortOrder), 0);
      onDrop(issueId, status.id, maxSort + 1);
    }
  }, [issues, onDrop, status.id]);

  const colorClass = categoryColors[status.category] || 'text-foreground';

  return (
    <div
      data-testid={`kanban-column-${status.id}`}
      className={`flex flex-col min-w-[280px] max-w-[320px] rounded-xl bg-muted/30 ${dragOver ? 'ring-2 ring-blue-400/50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
        <h3 className={`text-xs font-semibold uppercase tracking-wider ${colorClass}`}>
          {status.name}
        </h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {issues.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        {issues.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 text-center py-6">No issues</p>
        ) : (
          issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onClick={onIssueClick} onDragStart={onDragStart} />
          ))
        )}
      </div>
    </div>
  );
}
