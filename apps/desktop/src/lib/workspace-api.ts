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
  WorkspaceDeployment,
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

export async function fetchGitBranchesFromPath(path: string): Promise<{ name: string }[]> {
  const encodedPath = encodeURIComponent(path);
  const res = await fetch(`${API_BASE}/api/git/branches?path=${encodedPath}`);
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

export async function renameArtifact(artifactId: string, title: string): Promise<import('@claude-tauri/shared').Artifact> {
  const res = await fetch(`${API_BASE}/api/artifacts/${artifactId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to rename artifact: ${res.status}`);
  }
  return res.json();
}

export async function regenerateArtifact(artifactId: string, params: { prompt: string; model?: string }): Promise<{ artifact: import('@claude-tauri/shared').Artifact; revision: import('@claude-tauri/shared').ArtifactRevision }> {
  const res = await fetch(`${API_BASE}/api/artifacts/${artifactId}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to regenerate artifact: ${res.status}`);
  }
  return res.json();
}

// --- Workspace Deployments ---

export async function getWorkspaceDeployment(workspaceId: string): Promise<{ deployment: WorkspaceDeployment | null; isConfigured: boolean }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to get workspace deployment: ${res.status}`);
  }
  return res.json();
}

export async function linkWorkspaceDeployment(
  workspaceId: string,
  railwayProjectId: string,
  railwayServiceId: string,
  railwayEnvironmentId: string
): Promise<WorkspaceDeployment> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ railwayProjectId, railwayServiceId, railwayEnvironmentId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to link workspace deployment: ${res.status}`);
  }
  const data = await res.json();
  return data.deployment;
}

export async function refreshWorkspaceDeploymentStatus(workspaceId: string): Promise<{ deployment: WorkspaceDeployment }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment/refresh`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to refresh deployment status: ${res.status}`);
  }
  return res.json();
}

export async function getWorkspaceDeploymentLogs(
  workspaceId: string,
  limit?: number
): Promise<{ logs: Array<{ timestamp: string; level: string; message: string }>; deploymentId: string | null; total: number }> {
  const params = limit ? `?limit=${limit}` : '';
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment/logs${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch deployment logs: ${res.status}`);
  }
  return res.json();
}

export async function unlinkWorkspaceDeployment(workspaceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to unlink workspace deployment: ${res.status}`);
  }
}

export async function setDeploymentToken(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/deployment-settings/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to set deployment token: ${res.status}`);
  }
}
