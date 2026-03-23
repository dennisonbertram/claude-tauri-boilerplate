import { getApiBase } from '@/lib/api-config';

const API_BASE = getApiBase();

export async function fetchWorkspaceNotes(workspaceId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/notes`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch workspace notes: ${res.status}`);
  }
  const data: { content: string } = await res.json();
  return data.content;
}

export async function saveWorkspaceNotes(workspaceId: string, content: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to save workspace notes: ${res.status}`);
  }
}

export interface CodeReviewRequest {
  prompt?: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
}

export async function fetchCodeReview(workspaceId: string, request: CodeReviewRequest = {}): Promise<import('@claude-tauri/shared').CodeReviewResult> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/code-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Code review failed: ${res.status}`);
  }
  return res.json();
}
