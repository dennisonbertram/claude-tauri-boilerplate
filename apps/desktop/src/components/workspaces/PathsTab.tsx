import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as api from '@/lib/workspace-api';

function getDirectoryLabel(path: string): string {
  const normalized = path.replace(/\/+$/, '');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

interface PathsTabProps {
  workspaceId: string;
  initialDirectories: string[];
  pendingPath?: string;
  onWorkspaceUpdate?: () => void;
}

export function PathsTab({ workspaceId, initialDirectories, pendingPath, onWorkspaceUpdate }: PathsTabProps) {
  const [additionalDirectories, setAdditionalDirectories] = useState<string[]>(initialDirectories);
  const [newDirectory, setNewDirectory] = useState(pendingPath ?? '');
  const [directoryFilter, setDirectoryFilter] = useState('');
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  useEffect(() => {
    setAdditionalDirectories(initialDirectories);
  }, [initialDirectories]);

  // Auto-add pendingPath when it changes
  useEffect(() => {
    if (pendingPath) {
      setNewDirectory(pendingPath);
      void addDirectoryValueDirect(pendingPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPath]);

  const filteredDirectories = useMemo(() => {
    const filter = directoryFilter.trim().toLowerCase();
    if (!filter) return additionalDirectories;
    return additionalDirectories.filter((dir) => {
      const label = getDirectoryLabel(dir).toLowerCase();
      return label.includes(filter) || dir.toLowerCase().includes(filter);
    });
  }, [additionalDirectories, directoryFilter]);

  const persistDirectories = useCallback(
    async (nextDirectories: string[]) => {
      const updated = await api.renameWorkspace(workspaceId, {
        additionalDirectories: nextDirectories,
      });
      setAdditionalDirectories(updated.additionalDirectories ?? nextDirectories);
      setDirectoryError(null);
      onWorkspaceUpdate?.();
      return updated;
    },
    [workspaceId, onWorkspaceUpdate]
  );

  const addDirectoryValueDirect = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const nextDirectories = [...new Set([...additionalDirectories, trimmed])];
    try {
      await persistDirectories(nextDirectories);
      setNewDirectory('');
    } catch (err) {
      setDirectoryError(err instanceof Error ? err.message : 'Failed to add directory');
    }
  }, [additionalDirectories, persistDirectories]);

  const handleAddDirectory = useCallback(async () => {
    await addDirectoryValueDirect(newDirectory);
  }, [addDirectoryValueDirect, newDirectory]);

  const handleRemoveDirectory = useCallback(async (directory: string) => {
    try {
      await persistDirectories(additionalDirectories.filter((item) => item !== directory));
    } catch (err) {
      setDirectoryError(err instanceof Error ? err.message : 'Failed to update directories');
    }
  }, [additionalDirectories, persistDirectories]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Workspace settings</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage which additional repositories and directories Claude can use alongside this workspace.
          </p>
        </div>

        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Additional writable directories
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Repo names are derived from the attached directory path so you can search and review multi-repo attachments quickly.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={newDirectory}
            onChange={(e) => setNewDirectory(e.target.value)}
            placeholder="/path/to/another-repo"
            aria-label="Additional writable directory"
          />
          <Button type="button" onClick={() => void handleAddDirectory()} disabled={!newDirectory.trim()}>
            Add directory
          </Button>
        </div>

        <Input
          value={directoryFilter}
          onChange={(e) => setDirectoryFilter(e.target.value)}
          placeholder="Filter repos or paths"
          aria-label="Filter directories"
        />

        <div className="space-y-2">
          {filteredDirectories.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No additional directories configured.
            </p>
          ) : (
            filteredDirectories.map((directory) => (
              <div
                key={directory}
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {getDirectoryLabel(directory)}
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Repo: {getDirectoryLabel(directory)}
                  </div>
                  <div className="break-all text-xs text-muted-foreground">
                    {directory}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleRemoveDirectory(directory)}>
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>

        {directoryError && (
          <p className="text-sm text-destructive">{directoryError}</p>
        )}
      </div>
    </div>
  );
}
