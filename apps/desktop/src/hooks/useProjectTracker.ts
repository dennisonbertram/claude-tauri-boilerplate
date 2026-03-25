import { useState, useEffect, useCallback } from 'react';
import { useTrackerProject } from '@/hooks/useTracker';
import { apiFetch } from '@/lib/api-config';

/**
 * Hook that links a workspace project to a tracker project.
 * On mount, looks up the tracker project by workspace projectId.
 * If none exists (404), idempotently creates one via the ensure endpoint.
 * Once resolved, delegates to useTrackerProject for full issue management.
 */
export function useProjectTracker(projectId: string, projectName: string) {
  const [trackerProjectId, setTrackerProjectId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  const resolve = useCallback(async () => {
    setResolving(true);
    try {
      const res = await apiFetch(`/api/tracker/projects/by-project/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setTrackerProjectId(data.id);
      } else if (res.status === 404) {
        // No linked tracker project yet — create one
        const ensureRes = await apiFetch('/api/tracker/projects/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, name: projectName }),
        });
        if (ensureRes.ok) {
          const created = await ensureRes.json();
          setTrackerProjectId(created.id);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setResolving(false);
    }
  }, [projectId, projectName]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  const {
    project,
    issues,
    loading: projectLoading,
    createIssue,
    updateIssue,
    moveIssue,
    deleteIssue,
    addComment,
  } = useTrackerProject(trackerProjectId);

  const loading = resolving || projectLoading;

  return {
    loading,
    project,
    issues,
    createIssue,
    updateIssue,
    moveIssue,
    deleteIssue,
    addComment,
  };
}
