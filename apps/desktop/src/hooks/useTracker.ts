import { useState, useEffect, useCallback } from 'react';
import type {
  TrackerProject,
  TrackerProjectWithDetails,
  TrackerIssue,
} from '@claude-tauri/shared';
import { apiFetch } from '@/lib/api-config';

export function useTrackerProjects() {
  const [projects, setProjects] = useState<TrackerProject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiFetch('/api/tracker/projects');
      if (res.ok) setProjects(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(
    async (data: {
      name: string;
      slug: string;
      description?: string;
      icon?: string;
      color?: string;
    }) => {
      const res = await apiFetch('/api/tracker/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const project = await res.json();
      await fetchProjects();
      return project;
    },
    [fetchProjects],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await apiFetch(`/api/tracker/projects/${id}`, { method: 'DELETE' });
      await fetchProjects();
    },
    [fetchProjects],
  );

  return { projects, loading, fetchProjects, createProject, deleteProject };
}

export function useTrackerProject(projectId: string | null) {
  const [project, setProject] = useState<TrackerProjectWithDetails | null>(null);
  const [issues, setIssues] = useState<TrackerIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setIssues([]);
      setLoading(false);
      return;
    }
    try {
      const [projRes, issuesRes] = await Promise.all([
        apiFetch(`/api/tracker/projects/${projectId}`),
        apiFetch(`/api/tracker/projects/${projectId}/issues`),
      ]);
      if (projRes.ok) setProject(await projRes.json());
      if (issuesRes.ok) setIssues(await issuesRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const createIssue = useCallback(
    async (data: {
      title: string;
      description?: string;
      statusId?: string;
      priority?: number;
      assignee?: string;
      labels?: string[];
    }) => {
      if (!projectId) return;
      const res = await apiFetch(`/api/tracker/projects/${projectId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create issue');
      const issue = await res.json();
      await fetchProject();
      return issue;
    },
    [projectId, fetchProject],
  );

  const updateIssue = useCallback(
    async (issueId: string, updates: Record<string, unknown>) => {
      const res = await apiFetch(`/api/tracker/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update issue');
      await fetchProject();
      return res.json();
    },
    [fetchProject],
  );

  const moveIssue = useCallback(
    async (issueId: string, statusId: string, sortOrder: number) => {
      const res = await apiFetch(`/api/tracker/issues/${issueId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId, sortOrder }),
      });
      if (!res.ok) throw new Error('Failed to move issue');
      await fetchProject();
    },
    [fetchProject],
  );

  const deleteIssue = useCallback(
    async (issueId: string) => {
      await apiFetch(`/api/tracker/issues/${issueId}`, { method: 'DELETE' });
      await fetchProject();
    },
    [fetchProject],
  );

  const createLabel = useCallback(
    async (data: { name: string; color?: string }) => {
      if (!projectId) return;
      const res = await apiFetch(`/api/tracker/projects/${projectId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create label');
      await fetchProject();
      return res.json();
    },
    [projectId, fetchProject],
  );

  const addComment = useCallback(
    async (issueId: string, content: string, author?: string) => {
      const res = await apiFetch(`/api/tracker/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, author }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    [],
  );

  return {
    project,
    issues,
    loading,
    fetchProject,
    createIssue,
    updateIssue,
    moveIssue,
    deleteIssue,
    createLabel,
    addComment,
  };
}
