import { useState, useEffect, useCallback } from 'react';
import { ArrowsClockwise, Check, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useConnectBank } from '@/hooks/usePlaid';

interface LinkFlowFallbackProps {
  sessionId: string;
  state?: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function LinkFlowFallback({ sessionId, onComplete, onCancel }: LinkFlowFallbackProps) {
  const { checkSessionStatus } = useConnectBank();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const result = await checkSessionStatus(sessionId);
      if (result) {
        setStatus(result.status);
        if (result.status === 'finalized') {
          onComplete();
        }
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }, [sessionId, checkSessionStatus, onComplete]);

  // Poll every 3 seconds while visible
  useEffect(() => {
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <Card>
      <CardContent className="py-6">
        <div className="text-center space-y-4">
          {status === 'finalized' ? (
            <>
              <Check className="h-10 w-10 mx-auto text-green-500" />
              <div>
                <h3 className="text-base font-semibold text-foreground">Connection Complete</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your bank account has been successfully connected.
                </p>
              </div>
            </>
          ) : status === 'failed' || status === 'expired' ? (
            <>
              <Warning className="h-10 w-10 mx-auto text-destructive" />
              <div>
                <h3 className="text-base font-semibold text-foreground">Connection Failed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {status === 'expired'
                    ? 'The connection session has expired. Please try again.'
                    : 'Something went wrong. Please try connecting again.'}
                </p>
              </div>
              <Button variant="outline" onClick={onCancel}>
                Try Again
              </Button>
            </>
          ) : (
            <>
              <ArrowsClockwise className={`h-10 w-10 mx-auto text-muted-foreground ${checking ? 'animate-spin' : ''}`} />
              <div>
                <h3 className="text-base font-semibold text-foreground">Complete Your Connection</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  If you completed bank authentication in your browser, click below to finish setup.
                  Otherwise, return to your browser to complete the process.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={checkStatus} disabled={checking}>
                  {checking ? 'Checking...' : 'Check Status'}
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
              {status && status !== 'initiated' && (
                <p className="text-xs text-muted-foreground">
                  Status: {status}
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
