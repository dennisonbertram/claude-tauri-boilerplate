import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Toaster } from 'sonner';
import { isTauri } from './lib/platform';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/components/auth/AuthGate';
import { SessionSidebar } from '@/components/sessions/SessionSidebar';
import { ChatPage } from '@/components/chat/ChatPage';
import { WelcomeScreen } from '@/components/chat/WelcomeScreen';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { TeamsView } from '@/components/teams/TeamsView';
import { AgentBuilderView } from '@/components/agent-builder';
import { ProjectSidebar } from '@/components/workspaces/ProjectSidebar';
import { WorkspacePanel } from '@/components/workspaces/WorkspacePanel';
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
    forkSession,
    exportSession,
    autoNameSession,
  } = useSessions(sessionSearchQuery);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleOpenSettings = useCallback((tab?: string) => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  }, []);

  // Global keyboard shortcuts (work from any view)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenSettings();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleOpenSettings]);
  const [statusData, setStatusData] = useState<StatusBarProps & { sessionInfo?: ChatPageStatusData['sessionInfo'] }>(defaultStatusData);
  const [activeView, setActiveView] = useState<'chat' | 'teams' | 'workspaces' | 'agents'>('chat');
  const [activeSessionHasMessages, setActiveSessionHasMessages] = useState(false);
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
  const { markAsUnread, markAsRead, isUnread } = useUnread();

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
    renameWorkspace,
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

  const handleRenameWorkspace = useCallback(async (id: string, branch: string) => {
    const updatedWorkspace = await renameWorkspace(id, { branch });
    if (selectedWorkspace && selectedWorkspace.id === id) {
      setSelectedWorkspace(updatedWorkspace ?? selectedWorkspace);
    }
  }, [renameWorkspace, selectedWorkspace]);

  const handleOpenSessions = useCallback(() => {
    setActiveView('chat');
    setSidebarOpen(true);
  }, []);

  const handleOpenPullRequests = useCallback(() => {
    setActiveView('teams');
  }, []);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    await removeProject(projectId);
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setSelectedWorkspace(null);
    }
  }, [removeProject, selectedProjectId]);

  // When switching to workspaces view, auto-select first project
  const handleSwitchView = useCallback((view: 'chat' | 'teams' | 'workspaces' | 'agents') => {
    setActiveView(view);
    if (view === 'workspaces' && !selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [selectedProjectId, projects]);

  // Track when a project is clicked in the sidebar (expand + load workspaces)
  const handleProjectClick = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 min-h-0">
        {activeView === 'chat' && sidebarOpen && (
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            email={email}
            plan={plan}
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
            onRenameSession={renameSession}
            onForkSession={forkSession}
            onExportSession={exportSession}
            onOpenSettings={handleOpenSettings}
            activeView={activeView}
            onSwitchView={handleSwitchView}
          />
        )}
        {activeView === 'workspaces' && (
          <ProjectSidebar
            projects={projects}
            workspacesByProject={workspacesByProject}
            selectedWorkspaceId={selectedWorkspace?.id ?? null}
            onSelectWorkspace={handleSelectWorkspace}
            onAddProject={() => setAddProjectOpen(true)}
            onCreateWorkspace={(project) => {
              handleProjectClick(project.id);
              setCreateWorkspaceProject(project);
            }}
            onRenameWorkspace={handleRenameWorkspace}
            onDeleteProject={handleDeleteProject}
            activeView={activeView}
            onSwitchView={handleSwitchView}
            isWorkspaceUnread={isUnread}
          />
        )}
        {(activeView === 'teams' || activeView === 'agents') && (
          <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-sidebar">
            {/* View toggle tabs */}
            <div className="flex border-b border-border">
              <button
                data-testid="view-tab-chat"
                onClick={() => handleSwitchView('chat')}
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
              >
                Chat
              </button>
              <button
                onClick={() => handleSwitchView('workspaces')}
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
              >
                Workspaces
              </button>
              <button
                data-testid="view-tab-teams"
                onClick={() => handleSwitchView('teams')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeView === 'teams'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Teams
              </button>
              <button
                data-testid="view-tab-agents"
                onClick={() => handleSwitchView('agents')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeView === 'agents'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Agents
              </button>
            </div>
            <div className="flex-1" />
          </div>
        )}
        {activeView === 'chat' ? (
          activeSessionId ? (
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
          )
        ) : activeView === 'workspaces' ? (
          selectedWorkspace ? (
            <WorkspacePanel
              workspace={selectedWorkspace}
              onStatusChange={handleStatusChange}
              onWorkspaceUpdate={handleWorkspaceUpdate}
              onOpenSettings={handleOpenSettings}
              onTaskComplete={(params) => handleTaskComplete({
                ...params,
                workspaceId: selectedWorkspace.id,
              })}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a workspace or create one to get started
              </p>
            </div>
          )
        ) : activeView === 'agents' ? (
          <AgentBuilderView />
        ) : (
          <TeamsView />
        )}
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
