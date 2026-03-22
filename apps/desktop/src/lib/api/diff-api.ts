const API_BASE = 'http://localhost:3131';

export interface WorkspaceDiffRange {
  fromRef: string;
  toRef: string;
}

export interface WorkspaceRevision {
  id: string;
  shortId: string;
  message: string;
  parent: string | null;
  committedAt: string;
}

function toQueryString(range?: WorkspaceDiffRange): string {
  if (!range) return '';
  const params = new URLSearchParams({ fromRef: range.fromRef, toRef: range.toRef });
  return `?${params.toString()}`;
}

export async function fetchWorkspaceDiff(id: string, range?: WorkspaceDiffRange): Promise<{ diff: string; workspaceId: string }> {
  const query = toQueryString(range);
  const res = await fetch(`${API_BASE}/api/workspaces/${id}/diff${query}`);
  if (!res.ok) throw new Error(`Failed to fetch diff: ${res.status}`);
  return res.json();
}

export async function fetchChangedFiles(id: string, range?: WorkspaceDiffRange): Promise<{ files: Array<{ path: string; status: string }>; workspaceId: string }> {
  const query = toQueryString(range);
  const res = await fetch(`${API_BASE}/api/workspaces/${id}/changed-files${query}`);
  if (!res.ok) throw new Error(`Failed to fetch changed files: ${res.status}`);
  return res.json();
}

export async function mergeWorkspace(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${id}/merge`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to merge workspace: ${res.status}`);
  }
  return res.json();
}

export async function fetchWorkspaceRevisions(id: string): Promise<{ workspaceId: string; revisions: WorkspaceRevision[] }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${id}/revisions`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch workspace revisions: ${res.status}`);
  }
  return res.json();
}

export async function discardWorkspace(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${id}/discard`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to discard workspace: ${res.status}`);
  }
  return res.json();
}
