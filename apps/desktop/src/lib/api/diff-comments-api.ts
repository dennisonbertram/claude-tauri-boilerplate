import type { DiffComment, CreateDiffCommentRequest } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

export async function fetchDiffComments(workspaceId: string): Promise<DiffComment[]> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/diff-comments`);
  if (!res.ok) throw new Error(`Failed to fetch diff comments: ${res.status}`);
  return res.json();
}

export async function createDiffComment(workspaceId: string, request: CreateDiffCommentRequest): Promise<DiffComment> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/diff-comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to create diff comment: ${res.status}`);
  }
  return res.json();
}

export async function deleteDiffComment(workspaceId: string, commentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/diff-comments/${commentId}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to delete diff comment: ${res.status}`);
  }
}
