import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@claude-tauri/shared';
import * as api from '@/lib/workspace-api';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await api.fetchProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 30 seconds
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const addProject = useCallback(async (repoPath: string) => {
    const project = await api.createProject(repoPath);
    setProjects(prev => [project, ...prev]);
    return project;
  }, []);

  const removeProject = useCallback(async (id: string) => {
    await api.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  return { projects, loading, error, addProject, removeProject, refresh };
}
