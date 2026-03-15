import type { WorkspaceStatus } from '@claude-tauri/shared';

const statusConfig: Record<WorkspaceStatus, { label: string; classes: string }> = {
  creating: { label: 'Creating', classes: 'bg-yellow-500/20 text-yellow-400' },
  setup_running: { label: 'Setting up', classes: 'bg-yellow-500/20 text-yellow-400 animate-pulse' },
  ready: { label: 'Ready', classes: 'bg-muted text-muted-foreground' },
  active: { label: 'Active', classes: 'bg-green-500/20 text-green-400' },
  merging: { label: 'Merging', classes: 'bg-blue-500/20 text-blue-400 animate-pulse' },
  discarding: { label: 'Discarding', classes: 'bg-orange-500/20 text-orange-400 animate-pulse' },
  merged: { label: 'Merged', classes: 'bg-green-500/20 text-green-400' },
  archived: { label: 'Archived', classes: 'bg-muted text-muted-foreground' },
  error: { label: 'Error', classes: 'bg-red-500/20 text-red-400' },
};

interface WorkspaceStatusBadgeProps {
  status: WorkspaceStatus;
}

export function WorkspaceStatusBadge({ status }: WorkspaceStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.classes}`}>
      {status === 'merged' && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {config.label}
    </span>
  );
}
