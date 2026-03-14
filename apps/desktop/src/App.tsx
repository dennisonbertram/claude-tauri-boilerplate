import { useEffect, useState } from 'react';
import { isTauri } from './lib/platform';
import { AuthGate } from '@/components/auth/AuthGate';
import { SessionSidebar } from '@/components/sessions/SessionSidebar';
import { ChatPage } from '@/components/chat/ChatPage';
import { useSessions } from '@/hooks/useSessions';

function AppLayout({ email, plan }: { email?: string; plan?: string }) {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
  } = useSessions();

  const handleNewChat = async () => {
    await createSession();
  };

  return (
    <div className="flex h-screen">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        email={email}
        plan={plan}
        onSelectSession={setActiveSessionId}
        onNewChat={handleNewChat}
        onDeleteSession={deleteSession}
      />
      <ChatPage sessionId={activeSessionId} />
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
    <AuthGate>
      {(auth) => <AppLayout email={auth.email} plan={auth.plan} />}
    </AuthGate>
  );
}

export default App;
