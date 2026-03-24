import { useState, useCallback, useMemo } from 'react';
import { useTrackerProjects, useTrackerProject } from '@/hooks/useTracker';
import { KanbanBoard } from './KanbanBoard';
import { IssueListView } from './IssueListView';
import { IssueDetailPanel } from './IssueDetailPanel';
import { CreateIssueDialog } from './CreateIssueDialog';
import { TrackerFilters } from './TrackerFilters';
import type { TrackerIssue } from '@claude-tauri/shared';

export function TrackerView() {
  const { projects, createProject } = useTrackerProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { project, issues, createIssue, updateIssue, moveIssue, deleteIssue, addComment } =
    useTrackerProject(selectedProjectId);
  const [selectedIssue, setSelectedIssue] = useState<TrackerIssue | null>(null);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectSlug, setNewProjectSlug] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filters, setFilters] = useState({ search: '', category: '', priority: '', assignee: '' });

  // Auto-select first project
  if (!selectedProjectId && projects.length > 0) {
    setSelectedProjectId(projects[0].id);
  }

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

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim() || !newProjectSlug.trim()) return;
    const p = await createProject({ name: newProjectName.trim(), slug: newProjectSlug.trim() });
    setSelectedProjectId(p.id);
    setCreateProjectOpen(false);
    setNewProjectName('');
    setNewProjectSlug('');
  }, [newProjectName, newProjectSlug, createProject]);

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
      // Refresh the selected issue
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

  return (
    <div data-testid="tracker-view" className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 h-14 shrink-0">
        <h1 className="text-base font-semibold text-foreground">Tracker</h1>

        {/* Project selector */}
        <select
          data-testid="tracker-project-selector"
          value={selectedProjectId ?? ''}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          className="text-sm bg-muted border border-border rounded-md px-2 py-1 text-foreground"
        >
          {projects.length === 0 && <option value="">No projects</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon ? `${p.icon} ` : ''}{p.name}
            </option>
          ))}
        </select>

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

        {/* Actions */}
        {project && (
          <button
            data-testid="create-issue-button"
            onClick={() => setCreateIssueOpen(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors"
          >
            + Issue
          </button>
        )}
        <button
          data-testid="create-project-button"
          onClick={() => setCreateProjectOpen(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          + Board
        </button>
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
          <div className="text-center space-y-3">
            <p className="text-muted-foreground text-sm">No boards yet</p>
            <button
              onClick={() => setCreateProjectOpen(true)}
              className="text-sm px-4 py-2 rounded-md bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors"
            >
              Create your first board
            </button>
          </div>
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

      {/* Create project dialog */}
      {createProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCreateProjectOpen(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-[400px] shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-foreground">New Board</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Name</label>
                <input
                  data-testid="new-project-name"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => {
                    setNewProjectName(e.target.value);
                    // Auto-generate slug from name
                    setNewProjectSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, ''),
                    );
                  }}
                  placeholder="My Project"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Slug (used in issue identifiers)</label>
                <input
                  data-testid="new-project-slug"
                  type="text"
                  value={newProjectSlug}
                  onChange={(e) => setNewProjectSlug(e.target.value)}
                  placeholder="my-project"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Issues will be named {newProjectSlug ? newProjectSlug.toUpperCase() : 'SLUG'}-1, {newProjectSlug ? newProjectSlug.toUpperCase() : 'SLUG'}-2, ...
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCreateProjectOpen(false)}
                className="text-sm px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="submit-new-project"
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || !newProjectSlug.trim()}
                className="text-sm px-3 py-1.5 rounded-md bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
