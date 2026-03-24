import { useState, useCallback, useMemo } from 'react';
import { useProjectTracker } from '@/hooks/useProjectTracker';
import { KanbanBoard } from '@/components/tracker/KanbanBoard';
import { IssueListView } from '@/components/tracker/IssueListView';
import { IssueDetailPanel } from '@/components/tracker/IssueDetailPanel';
import { CreateIssueDialog } from '@/components/tracker/CreateIssueDialog';
import { TrackerFilters } from '@/components/tracker/TrackerFilters';
import type { TrackerIssue } from '@claude-tauri/shared';

interface WorkspaceIssuesTabProps {
  projectId: string;
  projectName: string;
}

export function WorkspaceIssuesTab({ projectId, projectName }: WorkspaceIssuesTabProps) {
  const { loading, project, issues, createIssue, updateIssue, moveIssue, deleteIssue, addComment } =
    useProjectTracker(projectId, projectName);

  const [selectedIssue, setSelectedIssue] = useState<TrackerIssue | null>(null);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filters, setFilters] = useState({ search: '', category: '', priority: '', assignee: '' });

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (
        filters.search &&
        !issue.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !issue.identifier.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      if (filters.category && issue.status?.category !== filters.category) return false;
      if (filters.priority && issue.priority !== Number(filters.priority)) return false;
      if (filters.assignee && issue.assignee !== filters.assignee) return false;
      return true;
    });
  }, [issues, filters]);

  const handleIssueClick = useCallback((issue: TrackerIssue) => {
    setSelectedIssue(issue);
  }, []);

  const handleMoveIssue = useCallback(
    async (issueId: string, statusId: string, sortOrder: number) => {
      await moveIssue(issueId, statusId, sortOrder);
    },
    [moveIssue],
  );

  const handleCreateIssue = useCallback(
    async (data: { title: string; description?: string; statusId?: string; priority?: number; assignee?: string }) => {
      await createIssue(data);
      setCreateIssueOpen(false);
    },
    [createIssue],
  );

  const handleUpdateIssue = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      await updateIssue(id, updates);
      const refreshed = issues.find((i) => i.id === id);
      if (refreshed) setSelectedIssue(refreshed);
    },
    [updateIssue, issues],
  );

  const handleDeleteIssue = useCallback(
    async (id: string) => {
      await deleteIssue(id);
      setSelectedIssue(null);
    },
    [deleteIssue],
  );

  const handleAddComment = useCallback(
    async (issueId: string, content: string) => {
      await addComment(issueId, content);
    },
    [addComment],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div data-testid="workspace-issues-tab" className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 h-14 shrink-0">
        <h2 className="text-base font-semibold text-foreground">Issues</h2>

        <div className="flex-1" />

        {/* View mode toggle */}
        {project && (
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              data-testid="view-mode-kanban"
              onClick={() => setViewMode('kanban')}
              className={`text-xs px-2.5 py-1 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-foreground text-background font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Board
            </button>
            <button
              data-testid="view-mode-list"
              onClick={() => setViewMode('list')}
              className={`text-xs px-2.5 py-1 transition-colors ${
                viewMode === 'list'
                  ? 'bg-foreground text-background font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              List
            </button>
          </div>
        )}

        {/* Create issue button */}
        {project && (
          <button
            data-testid="create-issue-button"
            onClick={() => setCreateIssueOpen(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors"
          >
            + Issue
          </button>
        )}
      </div>

      {/* Filters bar */}
      {project && (
        <TrackerFilters filters={filters} onFiltersChange={setFilters} />
      )}

      {/* Board / List area */}
      {project ? (
        viewMode === 'kanban' ? (
          <KanbanBoard
            project={project}
            issues={filteredIssues}
            onIssueClick={handleIssueClick}
            onMoveIssue={handleMoveIssue}
          />
        ) : (
          <IssueListView
            project={project}
            issues={filteredIssues}
            onIssueClick={handleIssueClick}
          />
        )
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No tracker project available</p>
        </div>
      )}

      {/* Issue detail slide-over */}
      {selectedIssue && project && (
        <IssueDetailPanel
          issue={selectedIssue}
          project={project}
          onClose={() => setSelectedIssue(null)}
          onUpdate={handleUpdateIssue}
          onDelete={handleDeleteIssue}
          onAddComment={handleAddComment}
        />
      )}

      {/* Create issue dialog */}
      {createIssueOpen && project && (
        <CreateIssueDialog
          project={project}
          onClose={() => setCreateIssueOpen(false)}
          onSubmit={handleCreateIssue}
        />
      )}
    </div>
  );
}
