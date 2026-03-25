import { WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useReauthBank } from '@/hooks/usePlaid';
import type { PlaidItem } from '@claude-tauri/shared';

interface ReauthBannerProps {
  item: PlaidItem;
  onReauthStarted?: () => void;
}

export function ReauthBanner({ item, onReauthStarted }: ReauthBannerProps) {
  const { reauth, isReauthing, error } = useReauthBank();

  if (!item.error) return null;

  const handleReauth = async () => {
    const session = await reauth(item.itemId);
    if (session) {
      onReauthStarted?.();
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <WarningCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {item.institutionName} needs re-authentication
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.error.message || 'Your bank connection has expired. Please reconnect to continue syncing.'}
        </p>
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleReauth}
        disabled={isReauthing}
      >
        {isReauthing ? 'Reconnecting...' : 'Reconnect'}
      </Button>
    </div>
  );
}
