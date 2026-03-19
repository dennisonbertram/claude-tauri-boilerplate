import { useState, useEffect, useMemo } from 'react';
import type { Project, Workspace } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { WorkspaceStatusBadge } from './WorkspaceStatusBadge';
import { copyTextToClipboard } from '@/lib/clipboard';
import * as api from '@/lib/workspace-api';
import type { GitStatus } from '@claude-tauri/shared';
import { FolderOpen, GitBranch, Plus } from 'lucide-react';
import { getProjectDisplayName } from '@/lib/project-display';

interface ProjectSidebarProps {
  projects: Project[];
  workspacesByProject: Record<string, Workspace[]>;
  selectedWorkspaceId: string | null;
  /** The currently selected project ID — used to load workspaces for that project */
  selectedProjectId?: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  /** Called when a project header is clicked so the parent can load that project's workspaces */
  onProjectClick?: (projectId: string) => void;
  onAddProject: () => void;
  onCreateWorkspace: (project: Project) => void;
  onRenameWorkspace: (id: string, branch: string) => void;
  onDeleteProject?: (id: string) => void;
  /** Returns true if the given workspace ID has unread activity */
  isWorkspaceUnread?: (workspaceId: string) => boolean;
}

export function ProjectSidebar({
  projects,
  workspacesByProject,
  selectedWorkspaceId,
  onSelectWorkspace,
  onProjectClick,
  onAddProject,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteProject,
  isWorkspaceUnread,
}: ProjectSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(projects.map(p => p.id))
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingBranch, setEditingBranch] = useState('');
  const [workspaceStatus, setWorkspaceStatus] = useState<Record<string, GitStatus | null>>({});

  // Close confirmation if the project disappears (e.g. already deleted)
  useEffect(() => {
    if (confirmDeleteId && !projects.find(p => p.id === confirmDeleteId)) {
      setConfirmDeleteId(null);
    }
  }, [projects, confirmDeleteId]);

  const allWorkspaces = useMemo(() => Object.values(workspacesByProject).flat(), [workspacesByProject]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadStatuses = async () => {
      const nextStatus: Record<string, GitStatus | null> = {};
      for (const workspace of allWorkspaces) {
        try {
          nextStatus[workspace.id] = await api.fetchWorkspaceStatus(workspace.worktreePath);
        } catch {
          if (controller.signal.aborted) return;
          nextStatus[workspace.id] = null;
        }
      }

      if (!cancelled && !controller.signal.aborted) {
        setWorkspaceStatus((current) => ({
          ...current,
          ...nextStatus,
        }));
      }
    };

    loadStatuses();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [allWorkspaces]);

  const beginRename = (workspace: Workspace) => {
    setEditingWorkspaceId(workspace.id);
    setEditingBranch(workspace.branch);
  };

  const cancelRename = () => {
    setEditingWorkspaceId(null);
    setEditingBranch('');
  };

  const copyBranchName = async (branch: string) => {
    try {
      await copyTextToClipboard(branch);
    } catch {
      // Clipboard access is best-effort; the branch is still visible on screen.
    }
  };

  const commitRename = async (workspaceId: string, workspaceBranch: string) => {
    const trimmedBranch = workspaceBranch.trim();
    if (!trimmedBranch) {
      cancelRename();
      return;
    }

    const originalWorkspace = allWorkspaces.find(ws => ws.id === workspaceId);
    if (!originalWorkspace) {
      cancelRename();
      return;
    }

    if (trimmedBranch !== originalWorkspace.branch) {
      try {
        await onRenameWorkspace(workspaceId, trimmedBranch);
      } catch {
        // no-op; leave the row in edit mode so user can retry
        return;
      }
    }

    setEditingWorkspaceId(null);
    setEditingBranch('');
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Notify parent to load workspaces for this project
        onProjectClick?.(id);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col min-h-0 overflow-hidden border-r border-border bg-sidebar">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Projects
        </span>
        <button
          onClick={onAddProject}
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Add project"
          title="Add project"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <Button onClick={onAddProject} className="w-full" variant="secondary">
          + Add Project
        </Button>
      </div>
      <Separator />

      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-2 space-y-1">
          {projects.length === 0 && (
            <div className="flex flex-col items-center px-3 py-8 text-center space-y-3">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground">
                  Add a project to start working with git worktrees
                </p>
              </div>
              <Button onClick={onAddProject} size="sm" variant="secondary">
                Add Project
              </Button>
            </div>
          )}
          {projects.map(project => {
            const expanded = expandedProjects.has(project.id);
            const workspaces = workspacesByProject[project.id] || [];

            return (
              <div key={project.id}>
                {/* Project header */}
                <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-sidebar-accent/50 group">
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="text-sm font-medium text-foreground truncate">
                      {getProjectDisplayName(project)}
                    </span>
                  </button>
                  {confirmDeleteId === project.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        data-testid={`confirm-delete-project-${project.id}`}
                        onClick={() => {
                          setConfirmDeleteId(null);
                          onDeleteProject?.(project.id);
                        }}
                        className="rounded px-1.5 py-0.5 text-xs text-destructive border border-destructive/40 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded px-1.5 py-0.5 text-xs text-muted-foreground border border-border hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onCreateWorkspace(project)}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="New workspace"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                      {onDeleteProject && (
                        <button
                          data-testid={`delete-project-${project.id}`}
                          onClick={() => setConfirmDeleteId(project.id)}
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove project"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Workspace list */}
                {expanded && (
                  <div className="ml-4 space-y-0.5">
                    {workspaces.length === 0 && (
                      <div className="flex flex-col items-center px-2 py-3 text-center space-y-1.5">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">No workspaces</p>
                        <button
                          onClick={() => onCreateWorkspace(project)}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          + New Workspace
                        </button>
                      </div>
                    )}
                    {workspaces.map(ws => (
                      <div
                        key={ws.id}
                        className={`group rounded-md px-2 py-1.5 text-left transition-colors space-y-1 ${
                          ws.id === selectedWorkspaceId
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectWorkspace(ws)}
                            className="min-w-0 flex-1 text-left flex items-center gap-1.5"
                          >
                            <span className="text-sm truncate">{ws.name}</span>
                            {isWorkspaceUnread?.(ws.id) && (
                              <span
                                data-testid={`unread-dot-${ws.id}`}
                                className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                                aria-label="Unread activity"
                              />
                            )}
                          </button>
                          <WorkspaceStatusBadge status={ws.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {editingWorkspaceId === ws.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                className="h-6 min-w-0 rounded border border-border bg-background px-2 text-xs text-foreground"
                                value={editingBranch}
                                onChange={(e) => setEditingBranch(e.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    commitRename(ws.id, editingBranch);
                                  } else if (event.key === 'Escape') {
                                    cancelRename();
                                  }
                                }}
                                onBlur={() => commitRename(ws.id, editingBranch)}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="rounded px-1.5 py-0.5 text-xs text-foreground border border-border hover:bg-accent transition-colors"
                                onClick={() => commitRename(ws.id, editingBranch)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground border border-border hover:bg-accent transition-colors"
                                onClick={cancelRename}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <p className="truncate font-mono text-[11px] text-foreground">
                                  {ws.branch}
                                </p>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    className="rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                    aria-label={`Copy branch name for ${ws.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void copyBranchName(ws.branch);
                                    }}
                                  >
                                    Copy
                                  </button>
                                  <button
                                    type="button"
                                    className="text-[10px] text-muted-foreground underline hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      beginRename(ws);
                                    }}
                                  >
                                    Rename
                                  </button>
                                </div>
                              </div>
                              {workspaceStatus[ws.id] ? (
                                workspaceStatus[ws.id]!.isClean ? (
                                  <p className="truncate text-[11px] text-emerald-400">Clean</p>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                                    {workspaceStatus[ws.id]!.stagedFiles.length > 0 && (
                                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-blue-300">
                                        Committed {workspaceStatus[ws.id]!.stagedFiles.length}
                                      </span>
                                    )}
                                    {workspaceStatus[ws.id]!.modifiedFiles.length > 0 && (
                                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
                                        Uncommitted {workspaceStatus[ws.id]!.modifiedFiles.length}
                                      </span>
                                    )}
                                  </div>
                                )
                              ) : (
                                <p className="truncate text-[11px]">Loading status...</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
