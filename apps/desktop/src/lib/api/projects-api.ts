import type { Project, CreateProjectRequest } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

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
