import type { Workspace, CreateWorkspaceRequest, WorkspaceRenameRequest, GitStatus } from '@claude-tauri/shared';
import { getApiBase } from '@/lib/api-config';

const API_BASE = getApiBase();

export async function fetchWorkspaces(projectId: string): Promise<Workspace[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/workspaces`);
  if (!res.ok) throw new Error(`Failed to fetch workspaces: ${res.status}`);
  return res.json();
}

export async function createWorkspace(
  projectId: string,
  name: string,
  baseBranch?: string,
  sourceBranch?: string,
  linearIssue?: CreateWorkspaceRequest['linearIssue'],
  branchPrefix?: string,
  githubIssue?: CreateWorkspaceRequest['githubIssue']
): Promise<Workspace> {
  const body: CreateWorkspaceRequest = { name };
  if (baseBranch) body.baseBranch = baseBranch;
  if (sourceBranch) body.sourceBranch = sourceBranch;
  if (branchPrefix) body.branchPrefix = branchPrefix;
  if (linearIssue) body.linearIssue = linearIssue;
  if (githubIssue) body.githubIssue = githubIssue;

  const res = await fetch(`${API_BASE}/api/projects/${projectId}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Failed to create workspace: ${res.status}`);
  }
  return res.json();
}

export async function fetchWorkspaceStatus(worktreePath: string): Promise<GitStatus> {
  const encodedPath = encodeURIComponent(worktreePath);
  const res = await fetch(`${API_BASE}/api/git/status?cwd=${encodedPath}`);
  if (!res.ok) throw new Error(`Failed to fetch workspace status: ${res.status}`);
  return res.json();
}

export async function renameWorkspace(id: string, updates: WorkspaceRenameRequest): Promise<Workspace> {
  const res = await fetch(`${API_BASE}/api/workspaces/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to rename workspace: ${res.status}`);
  }
  return res.json();
}

export async function deleteWorkspace(id: string, force?: boolean): Promise<void> {
  const url = force ? `${API_BASE}/api/workspaces/${id}?force=true` : `${API_BASE}/api/workspaces/${id}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to delete workspace: ${res.status}`);
  }
}

export async function getWorkspaceSession(workspaceId: string): Promise<{ id: string } | null> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/session`);
  if (!res.ok) return null;
  return res.json();
}
