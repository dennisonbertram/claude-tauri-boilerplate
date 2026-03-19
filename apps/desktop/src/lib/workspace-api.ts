import type {
  Project,
  Workspace,
  CreateProjectRequest,
  CreateWorkspaceRequest,
  WorkspaceRenameRequest,
  GitStatus,
  DiffComment,
  CreateDiffCommentRequest,
  CodeReviewResult,
} from '@claude-tauri/shared';

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

// --- Diff & Merge ---

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
  const params = new URLSearchParams({
    fromRef: range.fromRef,
    toRef: range.toRef,
  });
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

export async function getWorkspaceSession(workspaceId: string): Promise<{ id: string } | null> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/session`);
  if (!res.ok) return null;
  return res.json();
}

// --- Diff Comments ---

export async function fetchDiffComments(workspaceId: string): Promise<DiffComment[]> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/diff-comments`);
  if (!res.ok) throw new Error(`Failed to fetch diff comments: ${res.status}`);
  return res.json();
}

export async function createDiffComment(
  workspaceId: string,
  request: CreateDiffCommentRequest
): Promise<DiffComment> {
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
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/diff-comments/${commentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to delete diff comment: ${res.status}`);
  }
}

// --- Notes ---

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

export async function fetchCodeReview(
  workspaceId: string,
  request: CodeReviewRequest = {}
): Promise<CodeReviewResult> {
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

// --- GitHub Issues ---

export interface GithubIssue {
  number: number;
  title: string;
  url: string;
  state: string;
  body?: string;
}

export interface GithubBranch {
  name: string;
  isCurrent: boolean;
}

export async function fetchGithubIssues(projectId: string, query?: string): Promise<GithubIssue[]> {
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/github-issues${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch GitHub issues: ${res.status}`);
  }
  return res.json();
}

export async function fetchProjectBranches(projectId: string): Promise<GithubBranch[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/branches`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch branches: ${res.status}`);
  }
  return res.json();
}

// --- Artifacts ---

export async function fetchSessionThread(sessionId: string): Promise<import('@claude-tauri/shared').ThreadMessage[]> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/thread`);
  if (!res.ok) throw new Error(`Failed to fetch thread: ${res.status}`);
  return res.json();
}

export async function generateArtifact(projectId: string, params: {
  prompt: string;
  title?: string;
  workspaceId?: string;
  sessionId?: string;
  model?: string;
}): Promise<{ artifact: import('@claude-tauri/shared').Artifact; revision: import('@claude-tauri/shared').ArtifactRevision }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/artifacts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to generate artifact: ${res.status}`);
  }
  return res.json();
}

export async function fetchProjectArtifacts(projectId: string): Promise<import('@claude-tauri/shared').Artifact[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/artifacts`);
  if (!res.ok) throw new Error(`Failed to fetch artifacts: ${res.status}`);
  return res.json();
}

export async function archiveArtifact(artifactId: string): Promise<import('@claude-tauri/shared').Artifact> {
  const res = await fetch(`${API_BASE}/api/artifacts/${artifactId}/archive`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`Failed to archive artifact: ${res.status}`);
  return res.json();
}
