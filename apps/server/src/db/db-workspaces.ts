import { Database } from 'bun:sqlite';
import { isValidTransition, type WorkspaceStatus } from '@claude-tauri/shared';
import type { LinearIssueMetadata } from './db-sessions';

interface WorkspaceRow {
  id: string;
  project_id: string;
  name: string;
  branch: string;
  worktree_path: string;
  worktree_path_canonical: string;
  base_branch: string;
  additional_directories: string;
  status: string;
  claude_session_id: string | null;
  linear_issue_id: string | null;
  linear_issue_title: string | null;
  linear_issue_summary: string | null;
  linear_issue_url: string | null;
  github_issue_number: number | null;
  github_issue_title: string | null;
  github_issue_url: string | null;
  github_issue_repo: string | null;
  setup_pid: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Provenance fields (Phase 1 — may be absent in older rows)
  source_branch: string | null;
  source_ref_sha: string | null;
  base_ref_sha: string | null;
  parent_workspace_id: string | null;
  archived_at: string | null;
  last_reconciled_at: string | null;
  recovery_status: string | null;
}

interface WorkspaceEventRow {
  id: string;
  workspace_id: string;
  event_type: string;
  payload_json: string | null;
  created_at: string;
}

type GithubIssueMetadata = {
  number: number;
  title: string;
  url?: string;
  repo?: string;
};

function mapWorkspace(row: WorkspaceRow) {
  let additionalDirectories: string[] = [];
  try {
    const parsed = JSON.parse(row.additional_directories || '[]');
    if (Array.isArray(parsed)) {
      additionalDirectories = parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    additionalDirectories = [];
  }

  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    branch: row.branch,
    worktreePath: row.worktree_path,
    worktreePathCanonical: row.worktree_path_canonical,
    baseBranch: row.base_branch,
    status: row.status as WorkspaceStatus,
    additionalDirectories,
    claudeSessionId: row.claude_session_id,
    linearIssueId: row.linear_issue_id,
    linearIssueTitle: row.linear_issue_title,
    linearIssueSummary: row.linear_issue_summary,
    linearIssueUrl: row.linear_issue_url,
    githubIssueNumber: row.github_issue_number,
    githubIssueTitle: row.github_issue_title,
    githubIssueUrl: row.github_issue_url,
    githubIssueRepo: row.github_issue_repo,
    setupPid: row.setup_pid,
    errorMessage: row.error_message,
    sourceBranch: row.source_branch ?? null,
    sourceRefSha: row.source_ref_sha ?? null,
    baseRefSha: row.base_ref_sha ?? null,
    parentWorkspaceId: row.parent_workspace_id ?? null,
    archivedAt: row.archived_at ?? null,
    lastReconciledAt: row.last_reconciled_at ?? null,
    recoveryStatus: (row.recovery_status ?? 'healthy') as 'healthy' | 'stale' | 'recoverable' | 'broken',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkspace(
  db: Database,
  id: string,
  projectId: string,
  name: string,
  branch: string,
  worktreePath: string,
  worktreePathCanonical: string,
  baseBranch: string,
  linearIssue?: LinearIssueMetadata,
  additionalDirectories: string[] = [],
  githubIssue?: GithubIssueMetadata
) {
  const linearIssueId = linearIssue?.id ?? null;
  const linearIssueTitle = linearIssue?.title ?? null;
  const linearIssueSummary = linearIssue?.summary ?? null;
  const linearIssueUrl = linearIssue?.url ?? null;
  const githubIssueNumber = githubIssue?.number ?? null;
  const githubIssueTitle = githubIssue?.title ?? null;
  const githubIssueUrl = githubIssue?.url ?? null;
  const githubIssueRepo = githubIssue?.repo ?? null;
  const stmt = db.prepare(
    `INSERT INTO workspaces (
      id,
      project_id,
      name,
      branch,
      worktree_path,
      worktree_path_canonical,
      base_branch,
      additional_directories,
      linear_issue_id,
      linear_issue_title,
      linear_issue_summary,
      linear_issue_url,
      github_issue_number,
      github_issue_title,
      github_issue_url,
      github_issue_repo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    id,
    projectId,
    name,
    branch,
    worktreePath,
    worktreePathCanonical,
    baseBranch,
    JSON.stringify(additionalDirectories),
    linearIssueId,
    linearIssueTitle,
    linearIssueSummary,
    linearIssueUrl,
    githubIssueNumber,
    githubIssueTitle,
    githubIssueUrl,
    githubIssueRepo
  ) as WorkspaceRow;
  return mapWorkspace(row);
}

export function updateWorkspace(
  db: Database,
  id: string,
  updates: {
    name?: string;
    branch?: string;
    additionalDirectories?: string[];
  }
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }

  if (updates.branch !== undefined) {
    setClauses.push('branch = ?');
    values.push(updates.branch);
  }

  if (updates.additionalDirectories !== undefined) {
    setClauses.push('additional_directories = ?');
    values.push(JSON.stringify(updates.additionalDirectories));
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(
    `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = ?`
  );
  return stmt.run(...values);
}

export function listWorkspaces(db: Database, projectId: string) {
  const stmt = db.prepare(`SELECT * FROM workspaces WHERE project_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(projectId) as WorkspaceRow[];
  return rows.map(mapWorkspace);
}

export function getWorkspace(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM workspaces WHERE id = ?`);
  const row = stmt.get(id) as WorkspaceRow | null;
  return row ? mapWorkspace(row) : null;
}

export function updateWorkspaceStatus(db: Database, id: string, status: WorkspaceStatus, errorMessage?: string) {
  const stmt = db.prepare(
    `UPDATE workspaces SET status = ?, error_message = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(status, errorMessage ?? null, id);
}

export function transitionWorkspaceStatus(
  db: Database,
  id: string,
  status: WorkspaceStatus,
  errorMessage?: string
) {
  const workspace = getWorkspace(db, id);
  if (!workspace) {
    throw Object.assign(new Error('Workspace not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }

  // Allow metadata updates when the status value is unchanged.
  if (workspace.status !== status && !isValidTransition(workspace.status, status)) {
    throw Object.assign(
      new Error(
        `Invalid workspace status transition from '${workspace.status}' to '${status}'`
      ),
      { status: 409, code: 'INVALID_STATE' }
    );
  }

  updateWorkspaceStatus(db, id, status, errorMessage);
  return getWorkspace(db, id)!;
}

export function updateWorkspaceClaudeSession(db: Database, id: string, claudeSessionId: string) {
  const stmt = db.prepare(
    `UPDATE workspaces SET claude_session_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(claudeSessionId, id);
}

export function setWorkspaceError(db: Database, id: string, errorMessage: string) {
  return transitionWorkspaceStatus(db, id, 'error', errorMessage);
}

export function deleteWorkspace(db: Database, id: string) {
  const stmt = db.prepare(`DELETE FROM workspaces WHERE id = ?`);
  return stmt.run(id);
}

// ─── Workspace Events (Phase 1) ────────────────────────────────────────────────

export function recordWorkspaceEvent(
  db: Database,
  workspaceId: string,
  eventType: string,
  payload?: Record<string, unknown>
): void {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO workspace_events (id, workspace_id, event_type, payload_json, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(id, workspaceId, eventType, payload ? JSON.stringify(payload) : null);
}

export function getWorkspaceEvents(
  db: Database,
  workspaceId: string,
  limit = 20
): Array<{ id: string; workspaceId: string; eventType: string; payload?: Record<string, unknown>; createdAt: string }> {
  const rows = db.prepare(
    `SELECT id, workspace_id, event_type, payload_json, created_at
     FROM workspace_events
     WHERE workspace_id = ?
     ORDER BY created_at DESC
     LIMIT ?`
  ).all(workspaceId, limit) as WorkspaceEventRow[];

  return rows.map(r => ({
    id: r.id,
    workspaceId: r.workspace_id,
    eventType: r.event_type,
    payload: r.payload_json ? JSON.parse(r.payload_json) as Record<string, unknown> : undefined,
    createdAt: r.created_at,
  }));
}

export function updateWorkspaceRecoveryStatus(
  db: Database,
  workspaceId: string,
  status: 'healthy' | 'stale' | 'recoverable' | 'broken'
): void {
  db.prepare(
    `UPDATE workspaces SET recovery_status = ?, last_reconciled_at = datetime('now') WHERE id = ?`
  ).run(status, workspaceId);
}

export function updateWorkspaceProvenance(
  db: Database,
  workspaceId: string,
  data: { sourceBranch?: string; sourceRefSha?: string; baseRefSha?: string; parentWorkspaceId?: string }
): void {
  const parts: string[] = [];
  const vals: unknown[] = [];
  if (data.sourceBranch !== undefined) { parts.push('source_branch = ?'); vals.push(data.sourceBranch); }
  if (data.sourceRefSha !== undefined) { parts.push('source_ref_sha = ?'); vals.push(data.sourceRefSha); }
  if (data.baseRefSha !== undefined) { parts.push('base_ref_sha = ?'); vals.push(data.baseRefSha); }
  if (data.parentWorkspaceId !== undefined) { parts.push('parent_workspace_id = ?'); vals.push(data.parentWorkspaceId); }
  if (parts.length === 0) return;
  vals.push(workspaceId);
  db.prepare(`UPDATE workspaces SET ${parts.join(', ')} WHERE id = ?`).run(...vals);
}
