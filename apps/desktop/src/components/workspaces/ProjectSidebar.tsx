import { useState } from 'react';
import type { Project, Workspace } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { WorkspaceStatusBadge } from './WorkspaceStatusBadge';

type ViewType = 'chat' | 'teams' | 'workspaces';

interface ProjectSidebarProps {
  projects: Project[];
  workspacesByProject: Record<string, Workspace[]>;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onAddProject: () => void;
  onCreateWorkspace: (project: Project) => void;
  onDeleteProject?: (id: string) => void;
  activeView?: ViewType;
  onSwitchView?: (view: ViewType) => void;
}

export function ProjectSidebar({
  projects,
  workspacesByProject,
  selectedWorkspaceId,
  onSelectWorkspace,
  onAddProject,
  onCreateWorkspace,
  onDeleteProject,
  activeView,
  onSwitchView,
}: ProjectSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(projects.map(p => p.id))
  );

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col min-h-0 overflow-hidden border-r border-border bg-sidebar">
      {/* View toggle tabs */}
      {onSwitchView && (
        <div className="flex border-b border-border">
          <button
            onClick={() => onSwitchView('chat')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeView === 'chat'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => onSwitchView('workspaces')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeView === 'workspaces'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Workspaces
          </button>
          <button
            onClick={() => onSwitchView('teams')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeView === 'teams'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Teams
          </button>
        </div>
      )}

      <div className="p-3">
        <Button onClick={onAddProject} className="w-full" variant="secondary">
          + Add Project
        </Button>
      </div>
      <Separator />

      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-2 space-y-1">
          {projects.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No projects yet
            </p>
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
                      {project.name}
                    </span>
                  </button>
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
                        onClick={() => onDeleteProject(project.id)}
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
                </div>

                {/* Workspace list */}
                {expanded && (
                  <div className="ml-4 space-y-0.5">
                    {workspaces.length === 0 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        No workspaces
                      </p>
                    )}
                    {workspaces.map(ws => (
                      <button
                        key={ws.id}
                        onClick={() => onSelectWorkspace(ws)}
                        className={`w-full rounded-md px-2 py-1.5 text-left transition-colors flex items-center justify-between gap-2 ${
                          ws.id === selectedWorkspaceId
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
                        }`}
                      >
                        <span className="text-sm truncate">{ws.name}</span>
                        <WorkspaceStatusBadge status={ws.status} />
                      </button>
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
