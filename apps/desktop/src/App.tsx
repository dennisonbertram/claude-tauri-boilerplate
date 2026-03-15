import { useEffect, useState, useCallback } from 'react';
import { isTauri } from './lib/platform';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/components/auth/AuthGate';
import { SessionSidebar } from '@/components/sessions/SessionSidebar';
import { ChatPage } from '@/components/chat/ChatPage';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { TeamsView } from '@/components/teams/TeamsView';
import { StatusBar } from '@/components/StatusBar';
import type { StatusBarProps } from '@/components/StatusBar';
import { useSessions } from '@/hooks/useSessions';
import { useTheme } from '@/hooks/useTheme';

const defaultStatusData: StatusBarProps = {
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
};

function AppLayout({ email, plan }: { email?: string; plan?: string }) {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    renameSession,
    forkSession,
    exportSession,
  } = useSessions();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusData, setStatusData] = useState<StatusBarProps>(defaultStatusData);
  const [activeView, setActiveView] = useState<'chat' | 'teams'>('chat');

  const handleNewChat = async () => {
    await createSession();
  };

  const handleStatusChange = useCallback((data: ChatPageStatusData) => {
    setStatusData(data);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 min-h-0">
        {activeView === 'chat' && (
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            email={email}
            plan={plan}
            onSelectSession={(id) => { setActiveView('chat'); setActiveSessionId(id); }}
            onNewChat={handleNewChat}
            onDeleteSession={deleteSession}
            onRenameSession={renameSession}
            onForkSession={forkSession}
            onExportSession={exportSession}
            onOpenSettings={() => setSettingsOpen(true)}
            activeView={activeView}
            onSwitchView={setActiveView}
          />
        )}
        {activeView === 'teams' && (
          <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-sidebar">
            {/* View toggle tabs */}
            <div className="flex border-b border-border">
              <button
                data-testid="view-tab-chat"
                onClick={() => setActiveView('chat')}
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
              >
                Chat
              </button>
              <button
                data-testid="view-tab-teams"
                onClick={() => setActiveView('teams')}
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors border-b-2 border-primary text-foreground"
              >
                Teams
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground p-4 text-center">
                Select a team from the main area or create a new one.
              </p>
            </div>
          </div>
        )}
        {activeView === 'chat' ? (
          <ChatPage
            sessionId={activeSessionId}
            onCreateSession={handleNewChat}
            onExportSession={activeSessionId ? () => exportSession(activeSessionId, 'json') : undefined}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <TeamsView />
        )}
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
      <StatusBar {...statusData} />
    </div>
  );
}

function App() {
  // Initialize theme: applies dark/light class to <html> and listens for system preference changes
  useTheme();

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
      <AuthGate>
        {(auth) => <AppLayout email={auth.email} plan={auth.plan} />}
      </AuthGate>
    </ErrorBoundary>
  );
}

export default App;
