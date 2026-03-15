import { useState, useCallback } from 'react';
import * as api from '@/lib/workspace-api';

export interface ChangedFile {
  path: string;
  status: string;
}

export function useWorkspaceDiff(workspaceId: string | null) {
  const [diff, setDiff] = useState<string>('');
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiff = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      setError(null);
      const [diffResult, filesResult] = await Promise.all([
        api.fetchWorkspaceDiff(workspaceId),
        api.fetchChangedFiles(workspaceId),
      ]);
      setDiff(diffResult.diff);
      setChangedFiles(filesResult.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch diff');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  return { diff, changedFiles, loading, error, fetchDiff };
}
