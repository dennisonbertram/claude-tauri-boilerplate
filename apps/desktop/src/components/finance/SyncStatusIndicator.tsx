import { ArrowsClockwise, Check, Warning, Clock } from '@phosphor-icons/react';
import type { PlaidSyncStatus } from '@claude-tauri/shared';

interface SyncStatusIndicatorProps {
  status?: PlaidSyncStatus;
  lastSyncedAt?: string;
  compact?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function SyncStatusIndicator({ status, lastSyncedAt, compact }: SyncStatusIndicatorProps) {
  if (status?.status === 'running' || status?.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-500">
        <ArrowsClockwise className="h-3 w-3 animate-spin" />
        {!compact && 'Syncing...'}
      </span>
    );
  }

  if (status?.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive" title={status.error}>
        <Warning className="h-3 w-3" />
        {!compact && 'Sync failed'}
      </span>
    );
  }

  if (status?.status === 'completed' || lastSyncedAt) {
    const syncTime = status?.lastSyncedAt || lastSyncedAt;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {status?.status === 'completed' ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        {!compact && (syncTime ? `Synced ${formatRelativeTime(syncTime)}` : 'Synced')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      {!compact && 'Not synced'}
    </span>
  );
}
