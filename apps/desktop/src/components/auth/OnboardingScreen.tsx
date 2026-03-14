import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OnboardingScreenProps {
  onRetry: () => Promise<void>;
  error?: string;
}

export function OnboardingScreen({ onRetry, error }: OnboardingScreenProps) {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await onRetry();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Claude Tauri</CardTitle>
          <CardDescription>
            Get started by connecting your Claude account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Step number={1} title="Install Claude Code">
              <p className="text-sm text-muted-foreground">
                If you haven't already, install Claude Code via npm:
              </p>
              <code className="mt-1 block rounded bg-muted px-3 py-2 text-sm font-mono">
                npm install -g @anthropic-ai/claude-code
              </code>
            </Step>

            <Step number={2} title="Log in to Claude">
              <p className="text-sm text-muted-foreground">
                Run the following command and follow the prompts:
              </p>
              <code className="mt-1 block rounded bg-muted px-3 py-2 text-sm font-mono">
                claude login
              </code>
            </Step>

            <Step number={3} title="Verify connection">
              <p className="text-sm text-muted-foreground">
                Once logged in, click the button below to verify your setup.
              </p>
            </Step>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            onClick={handleCheck}
            disabled={checking}
            className="w-full"
            size="lg"
          >
            {checking ? 'Checking...' : 'Check Connection'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
        {number}
      </div>
      <div className="flex-1">
        <h3 className="font-medium leading-7">{title}</h3>
        {children}
      </div>
    </div>
  );
}
