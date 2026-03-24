import { useCallback } from 'react';
import type { TrackerProjectWithDetails, TrackerIssue } from '@claude-tauri/shared';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  project: TrackerProjectWithDetails;
  issues: TrackerIssue[];
  onIssueClick: (issue: TrackerIssue) => void;
  onMoveIssue: (issueId: string, statusId: string, sortOrder: number) => void;
}

export function KanbanBoard({ project, issues, onIssueClick, onMoveIssue }: KanbanBoardProps) {
  const handleDragStart = useCallback((e: React.DragEvent, issue: TrackerIssue) => {
    e.dataTransfer.setData('text/plain', issue.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div data-testid="kanban-board" className="flex gap-3 overflow-x-auto p-4 flex-1 min-h-0">
      {project.statuses.map((status) => {
        const columnIssues = issues
          .filter((i) => i.statusId === status.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        return (
          <KanbanColumn
            key={status.id}
            status={status}
            issues={columnIssues}
            onIssueClick={onIssueClick}
            onDrop={onMoveIssue}
            onDragStart={handleDragStart}
          />
        );
      })}
    </div>
  );
}
