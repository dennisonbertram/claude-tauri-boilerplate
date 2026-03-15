import type { Project, Workspace, CreateProjectRequest, CreateWorkspaceRequest } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

// --- Projects ---

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

export async function createProject(repoPath: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath } satisfies CreateProjectRequest),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to create project: ${res.status}`);
  }
  return res.json();
}

export async function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'defaultBranch' | 'setupCommand'>>): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to update project: ${res.status}`);
  }
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to delete project: ${res.status}`);
  }
}

// --- Workspaces ---

export async function fetchWorkspaces(projectId: string): Promise<Workspace[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/workspaces`);
  if (!res.ok) throw new Error(`Failed to fetch workspaces: ${res.status}`);
  return res.json();
}

export async function createWorkspace(projectId: string, name: string, baseBranch?: string): Promise<Workspace> {
  const body: CreateWorkspaceRequest = { name };
  if (baseBranch) body.baseBranch = baseBranch;

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

export async function deleteWorkspace(id: string, force?: boolean): Promise<void> {
  const url = force ? `${API_BASE}/api/workspaces/${id}?force=true` : `${API_BASE}/api/workspaces/${id}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to delete workspace: ${res.status}`);
  }
}

// --- Diff & Merge ---

export async function fetchWorkspaceDiff(id: string): Promise<{ diff: string }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${id}/diff`);
  if (!res.ok) throw new Error(`Failed to fetch diff: ${res.status}`);
  return res.json();
}

export async function fetchChangedFiles(id: string): Promise<{ files: Array<{ path: string; status: string }> }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${id}/changed-files`);
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

export async function discardWorkspace(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${id}/discard`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to discard workspace: ${res.status}`);
  }
  return res.json();
}
