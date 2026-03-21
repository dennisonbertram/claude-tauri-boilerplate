import { useState } from 'react';
import type { Project, Workspace } from '@claude-tauri/shared';
import {
  SquaresFour,
  MagnifyingGlass,
  PlusCircle,
  FolderOpen,
  DotsThreeVertical,
  ListBullets,
} from '@phosphor-icons/react';
import { getProjectDisplayName } from '@/lib/project-display';

interface ProjectsGridViewProps {
  projects: Project[];
  workspacesByProject: Record<string, Workspace[]>;
  onAddProject: () => void;
  onSelectWorkspace: (ws: Workspace) => void;
}

const BADGE_COLORS = [
  'bg-orange-50 border-orange-100 text-orange-600',
  'bg-blue-50 border-blue-100 text-blue-600',
  'bg-purple-50 border-purple-100 text-purple-600',
  'bg-emerald-50 border-emerald-100 text-emerald-600',
  'bg-amber-50 border-amber-100 text-amber-600',
];

export function ProjectsGridView({
  projects,
  workspacesByProject,
  onAddProject,
  onSelectWorkspace,
}: ProjectsGridViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filtered = searchQuery
    ? projects.filter((p) =>
        getProjectDisplayName(p).toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : projects;

  if (projects.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-border/20 flex items-center justify-center">
            <FolderOpen size={32} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">No projects yet</p>
            <p className="text-sm text-muted-foreground">
              Add your first project to get started
            </p>
          </div>
          <button
            onClick={onAddProject}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[var(--app-cta)] transition-colors shadow-sm"
          >
            <PlusCircle size={16} />
            Add Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-8 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-foreground">Projects</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-border/40 text-muted-foreground font-medium">
            {projects.length} total
          </span>
        </div>
        <button
          onClick={onAddProject}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[var(--app-cta)] transition-colors shadow-sm"
        >
          <PlusCircle size={16} />
          New Project
        </button>
      </div>

      {/* Filter bar */}
      <div className="px-8 py-4 border-b border-border/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border w-56"
            />
          </div>
          <button className="h-8 px-3 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:text-foreground transition-colors">
            Status
          </button>
          <button className="h-8 px-3 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:text-foreground transition-colors">
            Tech Stack
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-white overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-border/40 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <SquaresFour size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-border/40 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <ListBullets size={16} />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">Sort by: Last edited</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((project, i) => {
            const wsCount = workspacesByProject[project.id]?.length ?? 0;
            return (
              <div
                key={project.id}
                className="group bg-white border border-border rounded-2xl p-5 hover:shadow-soft hover:border-[#d4d2cc] transition-all cursor-pointer flex flex-col gap-4"
                onClick={() => {
                  const ws = workspacesByProject[project.id]?.[0];
                  if (ws) onSelectWorkspace(ws);
                }}
              >
                {/* Icon + menu */}
                <div className="flex items-start justify-between">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center ${BADGE_COLORS[i % BADGE_COLORS.length]}`}
                  >
                    <SquaresFour size={20} />
                  </div>
                  <button
                    className="text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DotsThreeVertical size={18} />
                  </button>
                </div>

                {/* Name + workspace count */}
                <div>
                  <h3 className="font-medium text-[15px] text-foreground mb-1">
                    {getProjectDisplayName(project)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {wsCount} workspace{wsCount !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Progress */}
                <div className="mt-auto space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="text-muted-foreground">Workspaces</span>
                    <span className="text-foreground">{wsCount}</span>
                  </div>
                  <div className="h-1 w-full bg-border/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full"
                      style={{ width: `${Math.min(100, wsCount * 25)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* New Project card */}
          <button
            onClick={onAddProject}
            className="group border-2 border-dashed border-border rounded-2xl p-5 hover:border-muted-foreground hover:bg-sidebar/50 transition-all flex flex-col items-center justify-center gap-3 min-h-[180px]"
          >
            <div className="w-12 h-12 rounded-full bg-white border border-border flex items-center justify-center text-muted-foreground group-hover:scale-110 transition-transform">
              <PlusCircle size={24} />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">New Project</p>
              <p className="text-xs text-muted-foreground">Import from GitHub or local</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
