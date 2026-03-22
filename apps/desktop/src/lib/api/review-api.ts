import type { WorkspaceReview, WorkspaceReviewFile, WorkspaceReviewComment, WorkspaceReviewTodo, MergeReadiness } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

export interface WorkspaceReviewResponse extends WorkspaceReview {
  files: WorkspaceReviewFile[];
  comments: WorkspaceReviewComment[];
  todos: WorkspaceReviewTodo[];
  merge_readiness: MergeReadiness;
}

export async function fetchWorkspaceReview(workspaceId: string): Promise<WorkspaceReviewResponse> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to fetch workspace review: ${res.status}`); }
  return res.json();
}

export async function updateWorkspaceReview(workspaceId: string, patch: { selected_from_ref?: string | null; selected_to_ref?: string | null; filter_mode?: 'all' | 'reviewed' | 'unreviewed'; view_mode?: 'unified' | 'side-by-side'; }): Promise<WorkspaceReviewResponse> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to update workspace review: ${res.status}`); }
  return res.json();
}

export async function upsertReviewFile(workspaceId: string, filePath: string, reviewState: 'unreviewed' | 'reviewed' | 'ignored'): Promise<WorkspaceReviewFile> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_path: filePath, review_state: reviewState }) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to upsert review file: ${res.status}`); }
  return res.json();
}

export async function fetchReviewComments(workspaceId: string): Promise<WorkspaceReviewComment[]> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review/comments`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to fetch review comments: ${res.status}`); }
  return res.json();
}

export async function createReviewComment(workspaceId: string, data: { file_path: string; diff_line_key?: string | null; old_line?: number | null; new_line?: number | null; markdown: string; }): Promise<WorkspaceReviewComment> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to create review comment: ${res.status}`); }
  return res.json();
}

export async function updateReviewComment(workspaceId: string, commentId: string, patch: { markdown?: string; status?: 'open' | 'resolved' | 'outdated' }): Promise<WorkspaceReviewComment> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review/comments/${commentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to update review comment: ${res.status}`); }
  return res.json();
}

export async function deleteReviewComment(workspaceId: string, commentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review/comments/${commentId}`, { method: 'DELETE' });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to delete review comment: ${res.status}`); }
}

export async function fetchReviewTodos(workspaceId: string): Promise<WorkspaceReviewTodo[]> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review/todos`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to fetch review todos: ${res.status}`); }
  return res.json();
}

export async function createReviewTodo(workspaceId: string, data: { body: string; source?: 'local' | 'check' | 'agent'; file_path?: string | null }): Promise<WorkspaceReviewTodo> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review/todos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to create review todo: ${res.status}`); }
  return res.json();
}

export async function updateReviewTodo(workspaceId: string, todoId: string, patch: { status?: 'open' | 'done'; body?: string }): Promise<WorkspaceReviewTodo> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/review/todos/${todoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to update review todo: ${res.status}`); }
  return res.json();
}
