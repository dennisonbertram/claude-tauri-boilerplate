import { useEffect, useState, useCallback } from 'react';
import { isTauri } from './lib/platform';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/components/auth/AuthGate';
import { SessionSidebar } from '@/components/sessions/SessionSidebar';
import { ChatPage } from '@/components/chat/ChatPage';
import { WelcomeScreen } from '@/components/chat/WelcomeScreen';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { TeamsView } from '@/components/teams/TeamsView';
import { ProjectSidebar } from '@/components/workspaces/ProjectSidebar';
import { WorkspacePanel } from '@/components/workspaces/WorkspacePanel';
import { AddProjectDialog } from '@/components/workspaces/AddProjectDialog';
import { CreateWorkspaceDialog } from '@/components/workspaces/CreateWorkspaceDialog';
import { StatusBar } from '@/components/StatusBar';
import type { StatusBarProps } from '@/components/StatusBar';
import { useSessions } from '@/hooks/useSessions';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useTheme } from '@/hooks/useTheme';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { Agentation } from 'agentation';
import type { Project, Workspace } from '@claude-tauri/shared';

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
  } = useSessions();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusData, setStatusData] = useState<StatusBarProps & { sessionInfo?: ChatPageStatusData['sessionInfo'] }>(defaultStatusData);
  const [activeView, setActiveView] = useState<'chat' | 'teams' | 'workspaces'>('chat');
  const [activeSessionHasMessages, setActiveSessionHasMessages] = useState(false);

  // Workspace state
  const { projects, addProject, removeProject } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [createWorkspaceProject, setCreateWorkspaceProject] = useState<Project | null>(null);
  const { workspaces, addWorkspace, refresh: refreshWorkspaces } = useWorkspaces(selectedProjectId);

  // Build workspaces-by-project map for all projects
  // For simplicity in MVP, we only load workspaces for the selected project
  const workspacesByProject: Record<string, Workspace[]> = {};
  if (selectedProjectId) {
    workspacesByProject[selectedProjectId] = workspaces;
  }

  const handleNewChat = async () => {
    // If there's already a truly empty session active, don't create another.
    // A "truly empty" session is one that has never been updated (updatedAt === createdAt)
    // AND has no claudeSessionId. This correctly handles forked sessions, which copy
    // messages and therefore have updatedAt > createdAt even with claudeSessionId === null.
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const isTrulyEmpty = activeSession &&
      activeSession.updatedAt === activeSession.createdAt &&
      !activeSession.claudeSessionId;
    if (activeSessionId !== null && isTrulyEmpty) {
      return;
    }
    await createSession();
    setActiveSessionHasMessages(false);
  };

  const handleStatusChange = useCallback((data: ChatPageStatusData) => {
    if (data.isStreaming) {
      setActiveSessionHasMessages(true);
    }
    setStatusData(data);
  }, []);

  const handleSelectWorkspace = useCallback((ws: Workspace) => {
    setSelectedProjectId(ws.projectId);
    setSelectedWorkspace(ws);
  }, []);

  const handleAddProject = useCallback(async (repoPath: string) => {
    const project = await addProject(repoPath);
    setSelectedProjectId(project.id);
  }, [addProject]);

  const handleCreateWorkspace = useCallback(async (name: string, baseBranch?: string) => {
    await addWorkspace(name, baseBranch);
  }, [addWorkspace]);

  const handleWorkspaceUpdate = useCallback(() => {
    refreshWorkspaces();
    setSelectedWorkspace(null);
  }, [refreshWorkspaces]);

  // When switching to workspaces view, auto-select first project
  const handleSwitchView = useCallback((view: 'chat' | 'teams' | 'workspaces') => {
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
            onSelectSession={(id) => { setActiveView('chat'); setActiveSessionId(id); const session = sessions.find(s => s.id === id); setActiveSessionHasMessages(session?.claudeSessionId != null); }}
            onNewChat={handleNewChat}
            onDeleteSession={deleteSession}
            onRenameSession={renameSession}
            onForkSession={forkSession}
            onExportSession={exportSession}
            onOpenSettings={() => setSettingsOpen(true)}
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
            onDeleteProject={removeProject}
            activeView={activeView}
            onSwitchView={handleSwitchView}
          />
        )}
        {activeView === 'teams' && (
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
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors border-b-2 border-primary text-foreground"
              >
                Teams
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
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : (
            <WelcomeScreen onNewChat={handleNewChat} />
          )
        ) : activeView === 'workspaces' ? (
          selectedWorkspace ? (
            <WorkspacePanel
              workspace={selectedWorkspace}
              onStatusChange={handleStatusChange}
              onWorkspaceUpdate={handleWorkspaceUpdate}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a workspace or create one to get started
              </p>
            </div>
          )
        ) : (
          <TeamsView />
        )}
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
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
      <StatusBar {...statusData} />

      {/* Workspace dialogs */}
      <AddProjectDialog
        isOpen={addProjectOpen}
        onClose={() => setAddProjectOpen(false)}
        onSubmit={handleAddProject}
      />
      {createWorkspaceProject && (
        <CreateWorkspaceDialog
          isOpen={true}
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
    </ErrorBoundary>
  );
}

export default App;
