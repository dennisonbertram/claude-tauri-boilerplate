import { getApiBase } from '@/lib/api-config';

const API_BASE = getApiBase();

export interface GithubIssue { number: number; title: string; url: string; state: string; body?: string; }
export interface GithubBranch { name: string; isCurrent: boolean; }
export interface GithubRepo { id: number; name: string; full_name: string; description: string | null; url: string; owner: { login: string; avatar_url: string }; private: boolean; default_branch: string; }
export interface GithubReposResult { items: GithubRepo[]; total_count: number; }

export async function fetchGithubIssues(projectId: string, query?: string): Promise<GithubIssue[]> {
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/github-issues${params}`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to fetch GitHub issues: ${res.status}`); }
  return res.json();
}

export async function fetchProjectBranches(projectId: string): Promise<GithubBranch[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/branches`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to fetch branches: ${res.status}`); }
  return res.json();
}

export async function fetchGitBranchesFromPath(path: string): Promise<{ name: string }[]> {
  const encodedPath = encodeURIComponent(path);
  const res = await fetch(`${API_BASE}/api/git/branches?path=${encodedPath}`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to fetch branches: ${res.status}`); }
  return res.json();
}

export async function searchGithubRepos(query: string, token: string): Promise<GithubReposResult> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_BASE}/api/github/repos?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`);
  return res.json();
}

export async function listGithubRepos(token: string): Promise<GithubReposResult> {
  const res = await fetch(`${API_BASE}/api/github/repos`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GitHub repos list failed: ${res.status}`);
  return res.json();
}

export async function testGithubToken(token: string): Promise<{ ok: boolean; user?: { login: string; name: string | null }; error?: string }> {
  const res = await fetch(`${API_BASE}/api/github/test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return res.json();
}

export async function createGithubIssue(projectId: string, params: { title: string; body: string; labels?: string[] }): Promise<{ url: string; number: number }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/github-issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to create issue: ${res.status}`); }
  return res.json();
}

export async function createProjectFromGithub(owner: string, repo: string, options?: { localPath?: string; token?: string }): Promise<import('@claude-tauri/shared').Project> {
  const res = await fetch(`${API_BASE}/api/projects/from-github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, path: options?.localPath, token: options?.token }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})) as any; throw new Error(err.error ?? `Failed to import repo: ${res.status}`); }
  return res.json();
}
