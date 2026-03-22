import { useState } from 'react';
import type { Project, Workspace } from '@claude-tauri/shared';
import { FolderOpen, Plus } from '@phosphor-icons/react';
import { WorkspaceStatusBadge } from '@/components/workspaces/WorkspaceStatusBadge';
import { getProjectDisplayName } from '@/lib/project-display';

/* ------------------------------------------------------------------ */
/*  Projects Section (inline simplified version of ProjectSidebar)     */
/* ------------------------------------------------------------------ */

export function ProjectsSection({
  projects,
  workspacesByProject,
  selectedWorkspaceId,
  onSelectWorkspace,
  onAddProject,
}: {
  projects: Project[];
  workspacesByProject: Record<string, Workspace[]>;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onAddProject: () => void;
}) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(projects.map((p) => p.id)),
  );

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 py-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
          Projects
        </span>
        <button
          onClick={onAddProject}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
          title="Add project"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center px-3 py-6 text-center">
          <FolderOpen className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground mb-0.5">No projects yet</p>
          <p className="text-xs text-muted-foreground mb-3">
            Add a project to start working with git worktrees
          </p>
          <button
            onClick={onAddProject}
            className="rounded px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Add Project
          </button>
        </div>
      ) : (
        projects.map((project) => {
          const expanded = expandedProjects.has(project.id);
          const workspaces = workspacesByProject[project.id] || [];

          return (
            <div key={project.id}>
              {/* Project header */}
              <button
                onClick={() => toggleProject(project.id)}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-left hover:bg-sidebar-accent/50 transition-colors"
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
                <span className="min-w-0 text-sm font-medium text-foreground truncate">
                  {getProjectDisplayName(project)}
                </span>
              </button>

              {/* Workspace list */}
              {expanded && (
                <div className="ml-5 space-y-0.5 mt-0.5">
                  {workspaces.length === 0 && (
                    <p className="px-3 py-1 text-xs text-muted-foreground">No workspaces</p>
                  )}
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => onSelectWorkspace(ws)}
                      className={`w-full rounded-lg px-3 py-1.5 text-left transition-colors ${
                        ws.id === selectedWorkspaceId
                          ? 'bg-card shadow-sm border border-border font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/50'
                      }`}
                    >
                      <span className="text-sm truncate block">{ws.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate block mt-0.5">
                        {ws.branch}
                      </span>
                      <div className="mt-0.5">
                        <WorkspaceStatusBadge status={ws.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
