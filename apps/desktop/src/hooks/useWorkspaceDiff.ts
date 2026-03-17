import { useState, useCallback } from 'react';
import * as api from '@/lib/workspace-api';

type DiffRange = api.WorkspaceDiffRange | undefined;

export interface ChangedFile {
  path: string;
  status: string;
}

export function useWorkspaceDiff(workspaceId: string | null, range: DiffRange = undefined) {
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
        api.fetchWorkspaceDiff(workspaceId, range),
        api.fetchChangedFiles(workspaceId, range),
      ]);
      setDiff(diffResult.diff);
      setChangedFiles(filesResult.files);
      return { diff: diffResult.diff, changedFiles: filesResult.files };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch diff');
      return;
    } finally {
      setLoading(false);
    }
  }, [workspaceId, range?.fromRef, range?.toRef]);

  return { diff, changedFiles, loading, error, fetchDiff };
}
