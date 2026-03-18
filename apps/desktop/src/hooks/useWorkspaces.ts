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
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workspaces');
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addWorkspace = useCallback(
    async (
      name: string,
      baseBranch?: string,
      sourceBranch?: string,
      linearIssue?: Parameters<typeof api.createWorkspace>[4],
      branchPrefix?: Parameters<typeof api.createWorkspace>[5]
    ) => {
      if (!projectId) return;
      const ws = await api.createWorkspace(
        projectId,
        name,
        baseBranch,
        sourceBranch,
        linearIssue,
        branchPrefix
      );
      setWorkspaces((prev) => [...prev, ws]);
      return ws;
    },
    [projectId]
  );

  const renameWorkspace = useCallback(async (id: string, updates: Parameters<typeof api.renameWorkspace>[1]) => {
    if (!projectId) return;
    const updatedWorkspace = await api.renameWorkspace(id, updates);
    setWorkspaces((prev) => prev.map((ws) => (ws.id === id ? updatedWorkspace : ws)));
    return updatedWorkspace;
  }, [projectId]);

  const removeWorkspace = useCallback(async (id: string, force?: boolean) => {
    await api.deleteWorkspace(id, force);
    setWorkspaces(prev => prev.filter(w => w.id !== id));
  }, []);

  return {
    workspaces,
    loading,
    error,
    addWorkspace,
    renameWorkspace,
    removeWorkspace,
    refresh,
  };
}
