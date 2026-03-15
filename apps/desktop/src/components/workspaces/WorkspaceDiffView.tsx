import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspaceDiff } from '@/hooks/useWorkspaceDiff';

interface WorkspaceDiffViewProps {
  workspaceId: string;
}

const statusLabels: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
};

const statusColors: Record<string, string> = {
  modified: 'text-yellow-400',
  added: 'text-green-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
  untracked: 'text-muted-foreground',
};

export function WorkspaceDiffView({ workspaceId }: WorkspaceDiffViewProps) {
  const { diff, changedFiles, loading, error, fetchDiff } = useWorkspaceDiff(workspaceId);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        {error}
        <Button variant="ghost" size="sm" className="ml-2" onClick={fetchDiff}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with refresh */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium text-foreground">
          {changedFiles.length} changed file{changedFiles.length !== 1 ? 's' : ''}
        </span>
        <Button variant="ghost" size="sm" onClick={fetchDiff}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      {/* File list */}
      {changedFiles.length > 0 && (
        <div className="border-b border-border px-4 py-2 space-y-1">
          {changedFiles.map((file) => (
            <div key={file.path} className="flex items-center gap-2 text-xs font-mono">
              <span className={`font-bold ${statusColors[file.status] || 'text-muted-foreground'}`}>
                {statusLabels[file.status] || '?'}
              </span>
              <span className="text-foreground truncate">{file.path}</span>
            </div>
          ))}
        </div>
      )}

      {/* Diff content */}
      <ScrollArea className="flex-1 min-h-0">
        {diff ? (
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
            {diff}
          </pre>
        ) : (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            No changes
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
