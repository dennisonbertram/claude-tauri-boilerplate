import { useAuth } from '@/hooks/useAuth';
import { OnboardingScreen } from './OnboardingScreen';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">Connecting...</p>
      </div>
    </div>
  );
}

interface AuthGateProps {
  children: (auth: { email?: string; plan?: string }) => React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { auth, loading, checkAuth } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!auth?.authenticated) {
    return <OnboardingScreen onRetry={checkAuth} error={auth?.error} />;
  }

  return <>{children({ email: auth.email, plan: auth.plan })}</>;
}
