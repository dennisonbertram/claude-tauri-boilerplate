import { useRef, useEffect, useCallback } from 'react';
import type { Session, Project, Workspace } from '@claude-tauri/shared';
import {
  ChatCircle,
  FolderOpen,
  UsersThree,
  Robot,
  Plus,
  Gear,
  SidebarSimple,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  FileText,
} from '@phosphor-icons/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { groupSessionsByDate } from '@/components/sidebar/date-utils';
import { SessionItem } from '@/components/sidebar/SessionItem';
import { ProjectsSection } from '@/components/sidebar/ProjectsSection';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ActiveView = 'chat' | 'workspaces' | 'teams' | 'agents' | 'documents';

export interface AppSidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  sessions: Session[];
  activeSessionId: string | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession?: (id: string) => void;
  onRenameSession?: (id: string, name: string) => void;
  onForkSession?: (id: string) => void;
  onExportSession?: (id: string, format: string) => void;
  projects: Project[];
  workspacesByProject: Record<string, Workspace[]>;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onAddProject: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  email?: string;
  plan?: string;
  onOpenSettings: () => void;
}

/* ------------------------------------------------------------------ */
/*  Nav configuration                                                  */
/* ------------------------------------------------------------------ */

const navItems: { view: ActiveView; icon: typeof ChatCircle; label: string }[] = [
  { view: 'documents', icon: FileText, label: 'Documents' },
  { view: 'workspaces', icon: FolderOpen, label: 'Projects' },
  { view: 'agents', icon: Robot, label: 'Agent Profiles' },
  { view: 'teams', icon: UsersThree, label: 'Teams' },
];

const navItemClass = (active: boolean) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left transition-colors ${
    active
      ? 'bg-card shadow-sm border border-border font-medium text-foreground'
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
  onDeleteSession,
  onRenameSession,
  onForkSession,
  onExportSession,
  projects,
  workspacesByProject,
  selectedWorkspaceId,
  onSelectWorkspace,
  onAddProject,
  sidebarOpen = true,
  onToggleSidebar,
  email,
  onOpenSettings,
}: AppSidebarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSessionSearch = useCallback(() => {
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearch = useCallback(() => {
    onSelectView('chat');
    focusSessionSearch();
  }, [onSelectView, focusSessionSearch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isSearchShortcut) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      handleSearch();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSearch]);

  const initial = email ? email.charAt(0).toUpperCase() : '?';
  const displayName = email ?? 'User';
  const filteredSessions = sessions;

  /* Collapsed strip — icon-only nav */
  if (!sidebarOpen) {
    return (
      <aside className="w-14 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full items-center py-3 gap-2">
        <button title="Expand sidebar" onClick={onToggleSidebar} className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground">
          <SidebarSimple className="h-[18px] w-[18px]" />
        </button>
        <button title="New Chat" onClick={onNewChat} className="rounded-md p-2 bg-card shadow-sm border border-border text-foreground transition-colors">
          <Plus className="h-[18px] w-[18px]" />
        </button>
        <button title="Search" onClick={handleSearch} className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground">
          <MagnifyingGlass className="h-[18px] w-[18px]" />
        </button>
        {navItems.map((item) => (
          <button key={item.view} title={item.label} onClick={() => onSelectView(item.view)} className={`rounded-md p-2 transition-colors ${activeView === item.view ? 'bg-card shadow-sm border border-border text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/50'}`}>
            <item.icon className="h-[18px] w-[18px]" />
          </button>
        ))}
        <div className="flex-1" />
        <button title="Settings" aria-label="Settings" onClick={onOpenSettings} className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground">
          <Gear className="h-[18px] w-[18px]" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[260px] flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center px-4 gap-4 text-muted-foreground">
        <button title="Toggle sidebar" onClick={onToggleSidebar} className="rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors">
          <SidebarSimple className="h-[18px] w-[18px]" />
        </button>
        <div className="flex items-center gap-2">
          <button aria-label="Navigate back" className="opacity-50 rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors"><CaretLeft className="h-4 w-4" /></button>
          <button aria-label="Navigate forward" className="opacity-50 rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors"><CaretRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="py-2 flex flex-col gap-6 px-3">
          <nav className="flex flex-col gap-0.5">
            <button onClick={onNewChat} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card shadow-sm border border-border font-medium text-foreground w-full text-left transition-colors hover:shadow">
              <Plus className="h-[18px] w-[18px]" /> New Chat
            </button>
            <button onClick={handleSearch} className={navItemClass(false)}>
              <MagnifyingGlass className="h-[18px] w-[18px]" /> Search
            </button>
            {navItems.map((item) => (
              <button key={item.view} onClick={() => onSelectView(item.view)} className={navItemClass(activeView === item.view)}>
                <item.icon className="h-[18px] w-[18px]" /> {item.label}
              </button>
            ))}
          </nav>

          {/* Recents */}
          {activeView === 'chat' && (
            <div className="flex flex-col gap-1">
              <div className="px-3 py-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">Recents</span>
              </div>
              <div className="px-2">
                <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => onSearchQueryChange(e.target.value)} placeholder="Filter conversations..." className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring" />
              </div>
              {filteredSessions.length > 0 ? (
                groupSessionsByDate(filteredSessions).map(({ bucket, sessions: groupSessions }) => (
                  <div key={bucket}>
                    <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">{bucket}</div>
                    {groupSessions.map((session) => (
                      <SessionItem key={session.id} session={session} isActive={session.id === activeSessionId} onSelect={() => onSelectSession(session.id)} onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined} onRename={onRenameSession ? (title) => onRenameSession(session.id, title) : undefined} onFork={onForkSession ? () => onForkSession(session.id) : undefined} onExport={onExportSession ? (format) => onExportSession(session.id, format) : undefined} />
                    ))}
                  </div>
                ))
              ) : searchQuery ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">No sessions match &ldquo;{searchQuery}&rdquo;</div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center text-muted-foreground">
                  <ChatCircle className="h-6 w-6 mb-2 opacity-40" />
                  <p className="text-sm font-medium mb-0.5">No conversations yet</p>
                  <p className="text-xs opacity-70">Start a conversation with Claude</p>
                </div>
              )}
            </div>
          )}

          {/* Projects */}
          {activeView === 'workspaces' && (
            <ProjectsSection projects={projects} workspacesByProject={workspacesByProject} selectedWorkspaceId={selectedWorkspaceId} onSelectWorkspace={onSelectWorkspace} onAddProject={onAddProject} />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-1 rounded-xl hover:bg-sidebar-accent/50 transition-colors cursor-pointer" onClick={onOpenSettings}>
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-medium text-xs">{initial}</div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 border-2 border-sidebar rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
          </div>
          <button aria-label="Settings" onClick={onOpenSettings} className="rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors">
            <Gear className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}
