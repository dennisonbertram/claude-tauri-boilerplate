import type { WorkspaceStatus } from '@claude-tauri/shared';

const statusConfig: Record<WorkspaceStatus, { label: string; classes: string }> = {
  creating: { label: 'Creating', classes: 'bg-amber-900/50 text-amber-400 border border-amber-700/50 animate-pulse' },
  setup_running: { label: 'Setting up', classes: 'bg-amber-900/50 text-amber-400 border border-amber-700/50 animate-pulse' },
  ready: { label: 'Ready', classes: 'bg-green-900/50 text-green-400 border border-green-700/50' },
  active: { label: 'Active', classes: 'bg-blue-900/50 text-blue-400 border border-blue-700/50' },
  merging: { label: 'Merging', classes: 'bg-purple-900/50 text-purple-400 border border-purple-700/50 animate-pulse' },
  discarding: { label: 'Discarding', classes: 'bg-orange-900/50 text-orange-400 border border-orange-700/50 animate-pulse' },
  merged: { label: 'Merged', classes: 'bg-purple-900/40 text-purple-300 border border-purple-700/50' },
  archived: { label: 'Archived', classes: 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50' },
  error: { label: 'Error', classes: 'bg-red-900/50 text-red-400 border border-red-700/50' },
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
