import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/components/auth/AuthGate';
import { ChatPage } from '@/components/chat/ChatPage';
import { WelcomeScreen } from '@/components/chat/WelcomeScreen';
import { ChatTabsBar } from '@/components/chat/ChatTabsBar';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { TeamsView } from '@/components/teams/TeamsView';
import { AgentBuilderView } from '@/components/agent-builder';
import { DocumentsView } from '@/components/documents/DocumentsView';
import { TrackerView } from '@/components/tracker/TrackerView';
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
import { getModelDisplay } from './lib/models';
import { pathToView } from './lib/routes';
import { ThemedToaster, useSidecarBoot, ViewSwitcherHeader, useAppKeyboardShortcuts, useTaskNotifications, defaultStatusData, ErrorScreen, LoadingScreen } from './app/index';

function AppLayout({ email, plan }: { email?: string; plan?: string }) {
  useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = pathToView(location.pathname);
  // Redirect bare "/" to "/chat" so the app always has a valid view route
  useEffect(() => { if (location.pathname === '/') navigate('/chat', { replace: true }); }, [location.pathname, navigate]);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const { sessions, activeSessionId, setActiveSessionId, deleteSession, renameSession, forkSession, exportSession, autoNameSession, fetchSessions } = useSessions(sessionSearchQuery);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openSessionIds, setOpenSessionIds] = useState<string[]>([]);
  const handleOpenSettings = useCallback((tab?: string) => { setSettingsInitialTab(tab); setSettingsOpen(true); }, []);
  const [statusData, setStatusData] = useState<StatusBarProps & { sessionInfo?: ChatPageStatusData['sessionInfo'] }>(defaultStatusData);
  const [activeSessionHasMessages, setActiveSessionHasMessages] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingWelcomeSessionId, setPendingWelcomeSessionId] = useState<string | null>(null);
  useAppKeyboardShortcuts({ activeView, activeSessionId, openSessionIds, setActiveSessionId, setActiveSessionHasMessages, handleOpenSettings });
  const hasMessages = (s?: (typeof sessions)[number]) => s ? (s.claudeSessionId != null || (s.messageCount ?? 0) > 0) : false;
  const { profiles: agentProfiles } = useAgentProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const { projects, addProject, removeProject } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [createWorkspaceProject, setCreateWorkspaceProject] = useState<Project | null>(null);
  const { settings } = useSettings();
  const { handleTaskComplete, markAsRead } = useTaskNotifications();
  const subagentActiveCountRef = useRef(0);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (subagentActiveCountRef.current > 0) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, []);
  const { workspaces, addWorkspace, renameWorkspace, refresh: refreshWorkspaces } = useWorkspaces(selectedProjectId);
  const workspacesByProject = useMemo(() => { const m: Record<string, Workspace[]> = {}; if (selectedProjectId) m[selectedProjectId] = workspaces; return m; }, [selectedProjectId, workspaces]);
  const handleWorkspaceTaskComplete = useCallback((p: { status: 'completed' | 'failed' | 'stopped'; summary: string; branch?: string; workspaceName?: string }) => handleTaskComplete({ ...p, workspaceId: selectedWorkspace?.id }), [handleTaskComplete, selectedWorkspace?.id]);
  const handleNewChat = async (profileId?: string) => { if (profileId !== undefined) setSelectedProfileId(profileId); setActiveSessionId(null); setPendingMessage(null); setPendingWelcomeSessionId(null); navigate('/chat'); setActiveSessionHasMessages(false); };
  const handleWelcomeSubmit = async (msg: string) => { setPendingWelcomeSessionId(null); setActiveSessionHasMessages(false); navigate('/chat'); setPendingMessage(msg); };
  const handleSessionInitialized = useCallback((sid: string) => { if (!pendingMessage) return; setPendingWelcomeSessionId((c) => c ?? sid); }, [pendingMessage]);
  const handleInitialMessageConsumed = useCallback(() => {
    // No-op: the welcome flow keeps pendingMessage set so ChatPage stays
    // mounted with a stable key. Transition happens when the user navigates
    // away (e.g., clicks another session or New Chat).
  }, []);
  // When the server responds with the app session ID, refresh the sidebar
  // so the new session appears without changing the ChatPage key.
  useEffect(() => { if (pendingMessage && pendingWelcomeSessionId && !activeSessionId) { void fetchSessions(sessionSearchQuery); } }, [pendingMessage, pendingWelcomeSessionId, activeSessionId, fetchSessions, sessionSearchQuery]);
  const handleStatusChange = useCallback((d: ChatPageStatusData) => { if (d.isStreaming) setActiveSessionHasMessages(true); subagentActiveCountRef.current = d.subagentActiveCount; setStatusData({ ...d, checkpoints: d.checkpoints ?? [] }); }, []);
  const handleSelectWorkspace = useCallback((ws: Workspace) => { setSelectedProjectId(ws.projectId); setSelectedWorkspace(ws); markAsRead(ws.id); }, [markAsRead]);
  const handleAddProject = useCallback(async (p: string) => { const proj = await addProject(p); setSelectedProjectId(proj.id); }, [addProject]);
  const handleCreateWorkspace = useCallback(async (name: string, base?: string, src?: string, issue?: import('@/lib/workspace-api').GithubIssue) => { const ws = await addWorkspace(name, base, src, undefined, settings.workspaceBranchPrefix, issue ? { number: issue.number, title: issue.title, url: issue.url } : undefined); if (ws) setSelectedWorkspace(ws); }, [addWorkspace, settings.workspaceBranchPrefix]);
  const handleWorkspaceUpdate = useCallback(async () => { const u = await refreshWorkspaces(); if (selectedWorkspace) setSelectedWorkspace(u?.find((w) => w.id === selectedWorkspace.id) ?? null); }, [refreshWorkspaces, selectedWorkspace]);
  const handleSwitchView = useCallback((v: 'chat' | 'teams' | 'workspaces' | 'agents' | 'documents' | 'tracker') => { navigate('/' + v); if (v === 'workspaces' && !selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id); }, [navigate, selectedProjectId, projects]);
  useEffect(() => { if (activeSessionId) setOpenSessionIds((p) => p.includes(activeSessionId) ? p : [...p, activeSessionId]); }, [activeSessionId]);
  useEffect(() => { setOpenSessionIds((p) => p.filter((id) => sessions.some((s) => s.id === id))); }, [sessions]);
  useEffect(() => { if (activeView === 'workspaces' && !selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id); }, [activeView, selectedProjectId, projects]);
  const handleActivateTab = useCallback((id: string) => { navigate('/chat'); setActiveSessionId(id); setPendingMessage(null); setPendingWelcomeSessionId(null); setActiveSessionHasMessages(hasMessages(sessions.find((s) => s.id === id))); }, [navigate, setActiveSessionId, sessions]);
  const handleCloseTab = useCallback((id: string) => { setOpenSessionIds((p) => { const n = p.filter((x) => x !== id); if (id === activeSessionId) setActiveSessionId(n[n.length - 1] ?? null); return n; }); }, [activeSessionId, setActiveSessionId]);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 min-h-0">
        <AppSidebar activeView={activeView} onSelectView={handleSwitchView} sessions={sessions} activeSessionId={activeSessionId ?? pendingWelcomeSessionId} searchQuery={sessionSearchQuery} onSearchQueryChange={setSessionSearchQuery}
          onSelectSession={(id) => { navigate('/chat'); setActiveSessionId(id); setPendingMessage(null); setPendingWelcomeSessionId(null); setActiveSessionHasMessages(hasMessages(sessions.find(s => s.id === id))); }}
          onNewChat={handleNewChat} onDeleteSession={deleteSession} onRenameSession={renameSession} onForkSession={async (id: string) => { await forkSession(id); navigate('/chat'); }} onExportSession={exportSession}
          projects={projects} workspacesByProject={workspacesByProject} selectedWorkspaceId={selectedWorkspace?.id ?? null} onSelectWorkspace={handleSelectWorkspace}
          onAddProject={() => setAddProjectOpen(true)} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(p => !p)} email={email} plan={plan} onOpenSettings={handleOpenSettings} />
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0 opacity-40" />
          <ViewSwitcherHeader activeView={activeView} onSwitchView={handleSwitchView} />
          <div className={`relative z-10 flex-1 min-h-0 flex flex-col ${activeView === 'chat' ? 'pt-14' : ''}`}>
            {activeView === 'chat' ? (
              <div className="flex flex-1 flex-col min-w-0 min-h-0">
                {openSessionIds.length > 0 && <ChatTabsBar sessions={sessions} openSessionIds={openSessionIds} activeSessionId={activeSessionId} onActivate={handleActivateTab} onClose={handleCloseTab} onRename={renameSession} onNewTab={handleNewChat} />}
                {activeSessionId || pendingMessage ? (
                  <ChatPage key={activeSessionId ?? 'new-chat'} sessionId={activeSessionId ?? pendingWelcomeSessionId} onCreateSession={handleNewChat}
                    onExportSession={activeSessionId ? () => exportSession(activeSessionId, 'json') : undefined} onStatusChange={handleStatusChange} onAutoName={autoNameSession}
                    onToggleSidebar={() => setSidebarOpen(o => !o)} onOpenSettings={handleOpenSettings} onOpenSessions={() => { navigate('/chat'); setSidebarOpen(true); }} onOpenPullRequests={() => navigate('/teams')}
                    onTaskComplete={p => handleTaskComplete(p)} profileId={selectedProfileId} agentProfiles={agentProfiles} onSelectProfile={setSelectedProfileId}
                    initialMessage={pendingMessage} onSessionInitialized={handleSessionInitialized} onInitialMessageConsumed={handleInitialMessageConsumed} />
                ) : <WelcomeScreen onNewChat={handleNewChat} onSubmit={handleWelcomeSubmit} agentProfiles={agentProfiles} selectedProfileId={selectedProfileId} onSelectProfile={setSelectedProfileId} modelDisplay={getModelDisplay(settings.model)} />}
              </div>
            ) : activeView === 'workspaces' ? (
              selectedWorkspace ? <WorkspacePanel workspace={selectedWorkspace} onStatusChange={handleStatusChange} onWorkspaceUpdate={handleWorkspaceUpdate} onOpenSettings={handleOpenSettings} onTaskComplete={handleWorkspaceTaskComplete} onRenameWorkspace={async (id, updates) => { await renameWorkspace(id, updates); await handleWorkspaceUpdate(); }} />
                : <ProjectsGridView projects={projects} workspacesByProject={workspacesByProject} onAddProject={() => setAddProjectOpen(true)} onSelectWorkspace={handleSelectWorkspace} onSelectProject={(id) => setSelectedProjectId(id)} />
            ) : activeView === 'tracker' ? <TrackerView /> : activeView === 'documents' ? <DocumentsView /> : activeView === 'agents' ? <AgentBuilderView /> : <TeamsView />}
          </div>
        </div>
        <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsInitialTab as any}
          sessionInfo={statusData.sessionInfo ? { model: statusData.sessionInfo.model, tools: statusData.sessionInfo.tools, mcpServers: statusData.sessionInfo.mcpServers, claudeCodeVersion: statusData.sessionInfo.claudeCodeVersion, sessionId: statusData.sessionInfo.sessionId } : undefined}
          email={email} plan={plan} />
      </div>
      <StatusBar {...statusData} onShowSettings={handleOpenSettings} />
      <AddProjectDialog isOpen={addProjectOpen} onClose={() => setAddProjectOpen(false)} onSubmit={handleAddProject} />
      {createWorkspaceProject && <CreateWorkspaceDialog isOpen={true} projectId={createWorkspaceProject.id} projectName={createWorkspaceProject.name} defaultBranch={createWorkspaceProject.defaultBranch} repoPath={createWorkspaceProject.repoPathCanonical || createWorkspaceProject.repoPath} onClose={() => setCreateWorkspaceProject(null)} onSubmit={handleCreateWorkspace} />}
    </div>
  );
}

function App() {
  const { serverReady, error } = useSidecarBoot();
  if (error) return <ErrorScreen error={error} />;
  if (!serverReady) return <LoadingScreen />;
  return (
    <ErrorBoundary>
      <HashRouter>
        <SettingsProvider>
          <AuthGate>{(auth) => (
            <Routes>
              <Route path="/*" element={<AppLayout email={auth.email} plan={auth.plan} />} />
            </Routes>
          )}</AuthGate>
          {import.meta.env.DEV && <Agentation />}
          <ThemedToaster />
        </SettingsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
