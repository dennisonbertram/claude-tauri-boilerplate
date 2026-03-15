import { useState, useEffect, useCallback } from 'react';
import type { Workspace } from '@claude-tauri/shared';
import * as api from '@/lib/workspace-api';

export function useWorkspaces(projectId: string | null) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setWorkspaces([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await api.fetchWorkspaces(projectId);
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workspaces');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addWorkspace = useCallback(async (name: string, baseBranch?: string) => {
    if (!projectId) return;
    const ws = await api.createWorkspace(projectId, name, baseBranch);
    setWorkspaces(prev => [...prev, ws]);
    return ws;
  }, [projectId]);

  const removeWorkspace = useCallback(async (id: string, force?: boolean) => {
    await api.deleteWorkspace(id, force);
    setWorkspaces(prev => prev.filter(w => w.id !== id));
  }, []);

  return { workspaces, loading, error, addWorkspace, removeWorkspace, refresh };
}
