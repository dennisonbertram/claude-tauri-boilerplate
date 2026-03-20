import { useState } from 'react';
import type { Session, Project, Workspace } from '@claude-tauri/shared';
import {
  MessageSquare,
  FolderOpen,
  Users,
  Bot,
  Plus,
  Settings,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProfileBadge } from '@/components/agent-builder/shared/ProfileBadge';
import { WorkspaceStatusBadge } from '@/components/workspaces/WorkspaceStatusBadge';
import { getProjectDisplayName } from '@/lib/project-display';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ActiveView = 'chat' | 'workspaces' | 'teams' | 'agents';

export interface AppSidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  // Sessions (for chat view recents)
  sessions: Session[];
  activeSessionId: string | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession?: (id: string) => void;
  // Workspaces (for projects view)
  projects: Project[];
  workspacesByProject: Record<string, Workspace[]>;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onAddProject: () => void;
  // Sidebar collapse
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  // User
  email?: string;
  plan?: string;
  onOpenSettings: () => void;
}

/* ------------------------------------------------------------------ */
/*  Date bucketing (ported from SessionSidebar)                        */
/* ------------------------------------------------------------------ */

const DATE_BUCKETS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'] as const;
type DateBucket = (typeof DATE_BUCKETS)[number];

function getDateBucket(date: Date): DateBucket {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  if (d >= monthStart) return 'This Month';
  return 'Older';
}

function groupSessionsByDate(sessions: Session[]): { bucket: DateBucket; sessions: Session[] }[] {
  const groups = new Map<DateBucket, Session[]>();
  for (const session of sessions) {
    const bucket = getDateBucket(new Date(session.createdAt));
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(session);
  }
  return DATE_BUCKETS
    .filter((b) => groups.has(b))
    .map((b) => ({ bucket: b, sessions: groups.get(b)! }));
}

/* ------------------------------------------------------------------ */
/*  Nav configuration                                                  */
/* ------------------------------------------------------------------ */

const navItems: { view: ActiveView; icon: typeof MessageSquare; label: string }[] = [
  { view: 'chat', icon: MessageSquare, label: 'Chat' },
  { view: 'workspaces', icon: FolderOpen, label: 'Projects' },
  { view: 'teams', icon: Users, label: 'Teams' },
  { view: 'agents', icon: Bot, label: 'Agents' },
];

const navItemClass = (active: boolean) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left transition-colors ${
    active
      ? 'bg-white shadow-sm border border-black/5 font-medium text-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent/50'
  }`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AppSidebar({
  activeView,
  onSelectView,
  sessions,
  activeSessionId,
  searchQuery,
  onSearchQueryChange,
  onSelectSession,
  onNewChat,
  onDeleteSession: _onDeleteSession,
  projects,
  workspacesByProject,
  selectedWorkspaceId,
  onSelectWorkspace,
  onAddProject,
  sidebarOpen = true,
  onToggleSidebar,
  email,
  plan,
  onOpenSettings,
}: AppSidebarProps) {
  const initial = email ? email.charAt(0).toUpperCase() : '?';
  const displayName = email ?? 'User';

  // Filter sessions by search query
  const filteredSessions = searchQuery
    ? sessions.filter((s) =>
        (s.title || 'New Chat').toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : sessions;

  // Collapsed strip — icon-only nav
  if (!sidebarOpen) {
    return (
      <aside className="w-14 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full items-center py-3 gap-2">
        <button
          title="Expand sidebar"
          onClick={onToggleSidebar}
          className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground"
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <button
          title="New Chat"
          onClick={onNewChat}
          className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground"
        >
          <Plus className="h-[18px] w-[18px]" />
        </button>
        {navItems.map((item) => (
          <button
            key={item.view}
            title={item.label}
            onClick={() => onSelectView(item.view)}
            className={`rounded-md p-2 transition-colors ${
              activeView === item.view
                ? 'bg-white shadow-sm border border-black/5 text-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/50'
            }`}
          >
            <item.icon className="h-[18px] w-[18px]" />
          </button>
        ))}
        <div className="flex-1" />
        <button
          title="Settings"
          onClick={onOpenSettings}
          className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[260px] flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center px-4 gap-4 text-muted-foreground">
        <button
          title="Toggle sidebar"
          onClick={onToggleSidebar}
          className="rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors"
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <div className="flex items-center gap-2">
          <button className="opacity-50 rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="opacity-50 rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="py-2 flex flex-col gap-6 px-3">
          {/* Primary nav links */}
          <nav className="flex flex-col gap-0.5">
            {/* New Chat action button */}
            <button onClick={onNewChat} className={navItemClass(false)}>
              <Plus className="h-[18px] w-[18px]" /> New Chat
            </button>
            {/* View nav items */}
            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => onSelectView(item.view)}
                className={navItemClass(activeView === item.view)}
              >
                <item.icon className="h-[18px] w-[18px]" /> {item.label}
              </button>
            ))}
          </nav>

          {/* Recents — shown when in chat view */}
          {activeView === 'chat' && (
            <div className="flex flex-col gap-1">
              <div className="px-3 py-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Recents
                </span>
              </div>
              {/* Inline search */}
              <div className="px-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder="Filter conversations..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {filteredSessions.length > 0 ? (
                groupSessionsByDate(filteredSessions).map(({ bucket, sessions: groupSessions }) => (
                  <div key={bucket}>
                    <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                      {bucket}
                    </div>
                    {groupSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm w-full text-left transition-colors truncate ${
                          session.id === activeSessionId
                            ? 'bg-white shadow-sm border border-black/5 font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-sidebar-accent/50'
                        }`}
                      >
                        <span className="truncate block">
                          {session.title || 'New Chat'}
                        </span>
                        {session.profile && (
                          <div className="mt-0.5">
                            <ProfileBadge profile={session.profile} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              ) : searchQuery ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No sessions match &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center text-muted-foreground">
                  <MessageSquare className="h-6 w-6 mb-2 opacity-40" />
                  <p className="text-sm font-medium mb-0.5">No conversations yet</p>
                  <p className="text-xs opacity-70">Start a conversation with Claude</p>
                </div>
              )}
            </div>
          )}

          {/* Projects — shown when in workspaces view */}
          {activeView === 'workspaces' && (
            <ProjectsSection
              projects={projects}
              workspacesByProject={workspacesByProject}
              selectedWorkspaceId={selectedWorkspaceId}
              onSelectWorkspace={onSelectWorkspace}
              onAddProject={onAddProject}
            />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <div
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
          onClick={onOpenSettings}
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-medium text-xs">
              {initial}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-500 border-2 border-sidebar rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{plan || 'Free'}</p>
          </div>
          <Settings className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Projects Section (inline simplified version of ProjectSidebar)     */
/* ------------------------------------------------------------------ */

function ProjectsSection({
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
                          ? 'bg-white shadow-sm border border-black/5 font-medium text-foreground'
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
