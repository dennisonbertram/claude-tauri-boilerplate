import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Toaster } from 'sonner';
import { isTauri } from './lib/platform';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/components/auth/AuthGate';
import { ChatPage } from '@/components/chat/ChatPage';
import { WelcomeScreen } from '@/components/chat/WelcomeScreen';
import { ChatTabsBar } from '@/components/chat/ChatTabsBar';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { TeamsView } from '@/components/teams/TeamsView';
import { AgentBuilderView } from '@/components/agent-builder';
import { AppSidebar } from '@/components/AppSidebar';
import { WorkspacePanel } from '@/components/workspaces/WorkspacePanel';
import { ProjectsGridView } from '@/components/workspaces/ProjectsGridView';
import { AddProjectDialog } from '@/components/workspaces/AddProjectDialog';
import { CreateWorkspaceDialog } from '@/components/workspaces/CreateWorkspaceDialog';
import { StatusBar } from '@/components/StatusBar';
import type { StatusBarProps } from '@/components/StatusBar';
import { useSessions } from '@/hooks/useSessions';
import { useAgentProfiles } from '@/hooks/useAgentProfiles';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useTheme } from '@/hooks/useTheme';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { Agentation } from 'agentation';
import type { Project, Workspace } from '@claude-tauri/shared';
import { useSettings } from './hooks/useSettings';
import { useUnread } from './hooks/useUnread';
import {
  requestNotificationPermission,
  sendNotification,
  playNotificationSound,
} from './lib/notifications';

const defaultStatusData: StatusBarProps & { sessionInfo?: ChatPageStatusData['sessionInfo'] } = {
  model: null,
  isStreaming: false,
  toolCalls: new Map(),
  cumulativeUsage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  },
  sessionTotalCost: 0,
  subagentActiveCount: 0,
  sessionInfo: null,
};

function AppLayout({ email, plan }: { email?: string; plan?: string }) {
  // Initialize theme inside SettingsProvider so useSettings() works correctly
  useTheme();

  const [sessionSearchQuery, setSessionSearchQuery] = useState('');

  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    renameSession,
    exportSession,
    autoNameSession,
  } = useSessions(sessionSearchQuery);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openSessionIds, setOpenSessionIds] = useState<string[]>([]);

  const handleOpenSettings = useCallback((tab?: string) => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  }, []);

  const [statusData, setStatusData] = useState<StatusBarProps & { sessionInfo?: ChatPageStatusData['sessionInfo'] }>(defaultStatusData);
  const [activeView, setActiveView] = useState<'chat' | 'teams' | 'workspaces' | 'agents'>('chat');
  const [activeSessionHasMessages, setActiveSessionHasMessages] = useState(false);

  // Global keyboard shortcuts (work from any view)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        if (activeView !== 'chat') return;
        e.preventDefault();
        void createSession();
        setActiveSessionHasMessages(false);
        return;
      }

      if (e.ctrlKey && e.key === 'Tab') {
        if (activeView !== 'chat') return;
        if (openSessionIds.length < 2) return;
        e.preventDefault();
        const currentIndex = activeSessionId
          ? openSessionIds.indexOf(activeSessionId)
          : -1;
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + openSessionIds.length) % openSessionIds.length
          : (currentIndex + 1) % openSessionIds.length;
        const nextId = openSessionIds[nextIndex];
        if (nextId) {
          setActiveSessionId(nextId);
        }
        return;
      }

      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenSettings();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleOpenSettings, activeView, openSessionIds, activeSessionId, setActiveSessionId, createSession]);
  const selectedSessionHasMessages = (session?: (typeof sessions)[number]) => {
    if (!session) return false;
    return session.claudeSessionId != null || (session.messageCount ?? 0) > 0;
  };

  // Agent profiles
  const { profiles: agentProfiles } = useAgentProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Workspace state
  const { projects, addProject, removeProject } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [createWorkspaceProject, setCreateWorkspaceProject] = useState<Project | null>(null);
  const { settings } = useSettings();

  // Unread workspace tracking
  const { markAsUnread, markAsRead } = useUnread();

  // Track active subagent count for quit confirmation
  const subagentActiveCountRef = useRef(0);

  // Request notification permission on app load
  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  // Handle task completion: send notification and mark workspace unread
  const handleTaskComplete = useCallback(
    (params: {
      status: 'completed' | 'failed' | 'stopped';
      summary: string;
      workspaceId?: string;
      branch?: string;
      workspaceName?: string;
    }) => {
      if (!settings.notificationsEnabled) return;

      const label = params.workspaceName
        ? `${params.workspaceName} (${params.branch ?? ''})`
        : 'Agent task';

      const statusLabel =
        params.status === 'completed'
          ? 'completed'
          : params.status === 'failed'
            ? 'failed'
            : 'stopped';

      sendNotification(`Task ${statusLabel}`, `${label}: ${params.summary}`);
      playNotificationSound(settings.notificationSound);

      // Mark workspace unread if we have an ID and it is not focused
      if (settings.notificationsWorkspaceUnread && params.workspaceId) {
        markAsUnread(params.workspaceId);
      }
    },
    [settings.notificationsEnabled, settings.notificationSound, settings.notificationsWorkspaceUnread, markAsUnread]
  );

  // Stable workspace-scoped task-complete handler — avoids re-creating an
  // inline arrow on every render which would cause cascading re-renders.
  const handleWorkspaceTaskComplete = useCallback(
    (params: {
      status: 'completed' | 'failed' | 'stopped';
      summary: string;
      branch?: string;
      workspaceName?: string;
    }) => {
      handleTaskComplete({ ...params, workspaceId: selectedWorkspace?.id });
    },
    [handleTaskComplete, selectedWorkspace?.id]
  );

  // Quit confirmation when agents are running
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (subagentActiveCountRef.current > 0) {
        e.preventDefault();
        // returnValue is required for Chrome/legacy browsers
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  const {
    workspaces,
    addWorkspace,
    refresh: refreshWorkspaces,
  } = useWorkspaces(selectedProjectId);

  // Build workspaces-by-project map for all projects
  // For simplicity in MVP, we only load workspaces for the selected project
  const workspacesByProject: Record<string, Workspace[]> = useMemo(() => {
    const next: Record<string, Workspace[]> = {};
    if (selectedProjectId) {
      next[selectedProjectId] = workspaces;
    }
    return next;
  }, [selectedProjectId, workspaces]);

  const handleNewChat = async (profileId?: string) => {
    // If there's already a truly empty session active, don't create another.
    // Use messageCount (from the server) as the reliable signal — timestamp
    // comparison is unreliable due to SQLite second-level precision.
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const hasActiveSessionMessages = activeSession ? selectedSessionHasMessages(activeSession) : false;
    if (activeSessionId !== null && !hasActiveSessionMessages) {
      // If a profile was selected, update the selected profile even for existing empty session
      if (profileId !== undefined) {
        setSelectedProfileId(profileId);
      }
      return;
    }
    if (profileId !== undefined) {
      setSelectedProfileId(profileId);
    }
    await createSession();
    setActiveSessionHasMessages(false);
  };

  const handleStatusChange = useCallback((data: ChatPageStatusData) => {
    if (data.isStreaming) {
      setActiveSessionHasMessages(true);
    }
    subagentActiveCountRef.current = data.subagentActiveCount;
    setStatusData(data);
  }, []);

  const handleSelectWorkspace = useCallback((ws: Workspace) => {
    setSelectedProjectId(ws.projectId);
    setSelectedWorkspace(ws);
    markAsRead(ws.id);
  }, [markAsRead]);

  const handleAddProject = useCallback(async (repoPath: string) => {
    const project = await addProject(repoPath);
    setSelectedProjectId(project.id);
  }, [addProject]);

  const handleCreateWorkspace = useCallback(async (
    name: string,
    baseBranch?: string,
    sourceBranch?: string,
    githubIssue?: import('@/lib/workspace-api').GithubIssue
  ) => {
    const ws = await addWorkspace(
      name,
      baseBranch,
      sourceBranch,
      undefined,
      settings.workspaceBranchPrefix,
      githubIssue
        ? { number: githubIssue.number, title: githubIssue.title, url: githubIssue.url }
        : undefined
    );
    if (ws) {
      setSelectedWorkspace(ws);
    }
  }, [addWorkspace, settings.workspaceBranchPrefix]);

  const handleWorkspaceUpdate = useCallback(async () => {
    const updated = await refreshWorkspaces();
    if (!selectedWorkspace) {
      return;
    }
    setSelectedWorkspace(updated?.find((ws) => ws.id === selectedWorkspace.id) ?? null);
  }, [refreshWorkspaces, selectedWorkspace]);

  const handleOpenSessions = useCallback(() => {
    setActiveView('chat');
    setSidebarOpen(true);
  }, []);

  const handleOpenPullRequests = useCallback(() => {
    setActiveView('teams');
  }, []);

  // Keep the active session in the open tab list.
  useEffect(() => {
    if (!activeSessionId) return;
    setOpenSessionIds((prev) =>
      prev.includes(activeSessionId) ? prev : [...prev, activeSessionId]
    );
  }, [activeSessionId]);

  // If a session is deleted, drop it from open tabs.
  useEffect(() => {
    setOpenSessionIds((prev) =>
      prev.filter((id) => sessions.some((s) => s.id === id))
    );
  }, [sessions]);

  const handleActivateTab = useCallback(
    (id: string) => {
      setActiveView('chat');
      setActiveSessionId(id);
      const session = sessions.find((s) => s.id === id);
      setActiveSessionHasMessages(selectedSessionHasMessages(session));
    },
    [setActiveSessionId, sessions]
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      setOpenSessionIds((prev) => {
        const next = prev.filter((x) => x !== id);
        if (id === activeSessionId) {
          const nextActive = next[next.length - 1] ?? null;
          setActiveSessionId(nextActive);
        }
        return next;
      });
    },
    [activeSessionId, setActiveSessionId]
  );

  const handleDeleteProject = useCallback(async (projectId: string) => {
    await removeProject(projectId);
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setSelectedWorkspace(null);
    }
  }, [removeProject, selectedProjectId]);

  // Auto-select first project when workspaces view is active and projects finish loading
  useEffect(() => {
    if (activeView === 'workspaces' && !selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [activeView, selectedProjectId, projects]);

  // When switching to workspaces view, auto-select first project
  const handleSwitchView = useCallback((view: 'chat' | 'teams' | 'workspaces' | 'agents') => {
    setActiveView(view);
    if (view === 'workspaces' && !selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [selectedProjectId, projects]);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 min-h-0">
        <AppSidebar
          activeView={activeView}
          onSelectView={handleSwitchView}
          sessions={sessions}
          activeSessionId={activeSessionId}
          searchQuery={sessionSearchQuery}
          onSearchQueryChange={setSessionSearchQuery}
          onSelectSession={(id) => {
            setActiveView('chat');
            setActiveSessionId(id);
            const session = sessions.find(s => s.id === id);
            setActiveSessionHasMessages(selectedSessionHasMessages(session));
          }}
          onNewChat={handleNewChat}
          onDeleteSession={deleteSession}
          projects={projects}
          workspacesByProject={workspacesByProject}
          selectedWorkspaceId={selectedWorkspace?.id ?? null}
          onSelectWorkspace={handleSelectWorkspace}
          onAddProject={() => setAddProjectOpen(true)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          email={email}
          plan={plan}
          onOpenSettings={handleOpenSettings}
        />
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0 opacity-40" />
          {activeView === 'chat' && (
            <header className="h-14 flex items-center justify-center w-full absolute top-0 z-20 pointer-events-none">
              <div className="bg-sidebar/80 backdrop-blur-md border border-border rounded-full p-1 flex items-center gap-1 shadow-sm pointer-events-auto">
                <button
                  onClick={() => handleSwitchView('chat')}
                  className="px-4 py-1.5 rounded-full text-sm font-medium bg-card shadow-sm border border-border text-foreground"
                >
                  Chat
                </button>
                <button
                  onClick={() => handleSwitchView('workspaces')}
                  className="px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Code
                </button>
                <button
                  onClick={() => handleSwitchView('teams')}
                  className="px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cowork
                </button>
              </div>
            </header>
          )}
          <div className={`relative z-10 flex-1 min-h-0 flex flex-col ${activeView === 'chat' ? 'pt-14' : ''}`}>
        {activeView === 'chat' ? (
          <div className="flex flex-1 flex-col min-w-0 min-h-0">
            {openSessionIds.length > 0 && (
              <ChatTabsBar
                sessions={sessions}
                openSessionIds={openSessionIds}
                activeSessionId={activeSessionId}
                onActivate={handleActivateTab}
                onClose={handleCloseTab}
                onRename={renameSession}
                onNewTab={handleNewChat}
              />
            )}

            {activeSessionId ? (
              <ChatPage
                sessionId={activeSessionId}
                onCreateSession={handleNewChat}
                onExportSession={() => exportSession(activeSessionId, 'json')}
                onStatusChange={handleStatusChange}
                onAutoName={autoNameSession}
                onToggleSidebar={() => setSidebarOpen((open) => !open)}
                onOpenSettings={handleOpenSettings}
                onOpenSessions={handleOpenSessions}
                onOpenPullRequests={handleOpenPullRequests}
                onTaskComplete={(params) => handleTaskComplete(params)}
                profileId={selectedProfileId}
                agentProfiles={agentProfiles}
                onSelectProfile={setSelectedProfileId}
              />
            ) : (
              <WelcomeScreen
                onNewChat={handleNewChat}
                agentProfiles={agentProfiles}
                selectedProfileId={selectedProfileId}
                onSelectProfile={setSelectedProfileId}
              />
            )}
          </div>
        ) : activeView === 'workspaces' ? (
          selectedWorkspace ? (
            <WorkspacePanel
              workspace={selectedWorkspace}
              onStatusChange={handleStatusChange}
              onWorkspaceUpdate={handleWorkspaceUpdate}
              onOpenSettings={handleOpenSettings}
              onTaskComplete={handleWorkspaceTaskComplete}
            />
          ) : (
            <ProjectsGridView
              projects={projects}
              workspacesByProject={workspacesByProject}
              onAddProject={() => setAddProjectOpen(true)}
              onSelectWorkspace={handleSelectWorkspace}
            />
          )
        ) : activeView === 'agents' ? (
          <AgentBuilderView />
        ) : (
          <TeamsView />
        )}
          </div>
        </div>
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          initialTab={settingsInitialTab as any}
          sessionInfo={statusData.sessionInfo ? {
            model: statusData.sessionInfo.model,
            tools: statusData.sessionInfo.tools,
            mcpServers: statusData.sessionInfo.mcpServers,
            claudeCodeVersion: statusData.sessionInfo.claudeCodeVersion,
            sessionId: statusData.sessionInfo.sessionId,
          } : undefined}
          email={email}
          plan={plan}
        />
      </div>
      <StatusBar {...statusData} onShowSettings={handleOpenSettings} />

      {/* Workspace dialogs */}
      <AddProjectDialog
        isOpen={addProjectOpen}
        onClose={() => setAddProjectOpen(false)}
        onSubmit={handleAddProject}
      />
      {createWorkspaceProject && (
        <CreateWorkspaceDialog
          isOpen={true}
          projectId={createWorkspaceProject.id}
          projectName={createWorkspaceProject.name}
          defaultBranch={createWorkspaceProject.defaultBranch}
          repoPath={createWorkspaceProject.repoPathCanonical || createWorkspaceProject.repoPath}
          onClose={() => setCreateWorkspaceProject(null)}
          onSubmit={handleCreateWorkspace}
        />
      )}
    </div>
  );
}

function App() {
  const [serverReady, setServerReady] = useState(!isTauri());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    async function boot() {
      try {
        const { startSidecar, waitForServer } = await import('./lib/sidecar');
        await startSidecar();
        const ready = await waitForServer();
        if (cancelled) return;
        if (ready) {
          setServerReady(true);
        } else {
          setError('Server failed to start');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to start server');
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
      if (isTauri()) {
        import('./lib/sidecar').then(({ stopSidecar }) => stopSidecar());
      }
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-destructive">Error</h1>
          <p className="mt-4 text-lg text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!serverReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <h1 className="text-2xl font-bold">Claude Tauri</h1>
          <p className="text-muted-foreground">Starting server...</p>
        </div>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AuthGate>
          {(auth) => <AppLayout email={auth.email} plan={auth.plan} />}
        </AuthGate>
        {import.meta.env.DEV && <Agentation />}
      </SettingsProvider>
      <Toaster position="top-right" theme="dark" />
    </ErrorBoundary>
  );
}

export default App;
