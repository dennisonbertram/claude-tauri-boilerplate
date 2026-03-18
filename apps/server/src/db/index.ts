import { Database } from 'bun:sqlite';
import { SCHEMA, migrateSessionsWorkspaceId, migrateLinearIssueColumns, migrateSessionModelColumn } from './schema';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { isValidTransition, type WorkspaceStatus } from '@claude-tauri/shared';

const DB_DIR = join(process.env.HOME || '~', '.claude-tauri');
const DB_PATH = join(DB_DIR, 'data.db');

interface SessionRow {
  id: string;
  title: string;
  claude_session_id: string | null;
  model: string;
  workspace_id: string | null;
  linear_issue_id: string | null;
  linear_issue_title: string | null;
  linear_issue_summary: string | null;
  linear_issue_url: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface CheckpointRow {
  id: string;
  session_id: string;
  user_message_id: string;
  prompt_preview: string;
  timestamp: string;
  files_changed: string;
  turn_index: number;
  git_commit: string | null;
  message_count: number;
}

interface ProjectRow {
  id: string;
  name: string;
  repo_path: string;
  repo_path_canonical: string;
  default_branch: string;
  setup_command: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

interface WorkspaceRow {
  id: string;
  project_id: string;
  name: string;
  branch: string;
  worktree_path: string;
  worktree_path_canonical: string;
  base_branch: string;
  status: string;
  claude_session_id: string | null;
  linear_issue_id: string | null;
  linear_issue_title: string | null;
  linear_issue_summary: string | null;
  linear_issue_url: string | null;
  setup_pid: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function mapSession(row: SessionRow) {
  return {
    id: row.id,
    title: row.title,
    claudeSessionId: row.claude_session_id,
    model: row.model,
    workspaceId: row.workspace_id,
    linearIssueId: row.linear_issue_id,
    linearIssueTitle: row.linear_issue_title,
    linearIssueSummary: row.linear_issue_summary,
    linearIssueUrl: row.linear_issue_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapCheckpoint(row: CheckpointRow) {
  return {
    id: row.id,
    userMessageId: row.user_message_id,
    promptPreview: row.prompt_preview,
    timestamp: row.timestamp,
    filesChanged: JSON.parse(row.files_changed) as import('@claude-tauri/shared').FileChange[],
    turnIndex: row.turn_index,
    gitCommit: row.git_commit,
    messageCount: row.message_count,
  };
}

function mapProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    repoPath: row.repo_path,
    repoPathCanonical: row.repo_path_canonical,
    defaultBranch: row.default_branch,
    setupCommand: row.setup_command,
    isDeleted: row.is_deleted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkspace(row: WorkspaceRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    branch: row.branch,
    worktreePath: row.worktree_path,
    worktreePathCanonical: row.worktree_path_canonical,
    baseBranch: row.base_branch,
    status: row.status as WorkspaceStatus,
    claudeSessionId: row.claude_session_id,
    linearIssueId: row.linear_issue_id,
    linearIssueTitle: row.linear_issue_title,
    linearIssueSummary: row.linear_issue_summary,
    linearIssueUrl: row.linear_issue_url,
    setupPid: row.setup_pid,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createDb(path?: string): Database {
  if (path !== ':memory:') {
    mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(path || DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  migrateSessionsWorkspaceId(db);
  migrateLinearIssueColumns(db);
  migrateSessionModelColumn(db);
  return db;
}

type CheckpointMetadata = {
  sessionId: string;
  userMessageId: string;
  promptPreview: string;
  filesChanged: import('@claude-tauri/shared').FileChange[];
  turnIndex: number;
  gitCommit?: string | null;
  messageCount?: number;
};

type LinearIssueMetadata = {
  id: string;
  title: string;
  summary?: string;
  url?: string;
};

export function createSession(
  db: Database,
  id: string,
  title?: string,
  linearIssue?: LinearIssueMetadata,
  model?: string
) {
  const linearIssueId = linearIssue?.id ?? null;
  const linearIssueTitle = linearIssue?.title ?? null;
  const linearIssueSummary = linearIssue?.summary ?? null;
  const linearIssueUrl = linearIssue?.url ?? null;
  const sessionModel = model ?? 'claude-sonnet-4-6';
  const stmt = db.prepare(
    `INSERT INTO sessions (id, title, model, linear_issue_id, linear_issue_title, linear_issue_summary, linear_issue_url) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    id,
    title || 'New Chat',
    sessionModel,
    linearIssueId,
    linearIssueTitle,
    linearIssueSummary,
    linearIssueUrl
  ) as SessionRow;
  return mapSession(row);
}

export function getSession(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
  const row = stmt.get(id) as SessionRow | null;
  return row ? mapSession(row) : null;
}

export function listSessions(db: Database, searchQuery?: string) {
  const normalized = (searchQuery ?? '').trim();

  if (!normalized) {
    const stmt = db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count
      FROM sessions s
      ORDER BY s.created_at DESC
    `);
    const rows = stmt.all() as (SessionRow & { message_count: number })[];
    return rows.map((row) => ({ ...mapSession(row), messageCount: row.message_count }));
  }

  const pattern = `%${normalized}%`;
  const stmt = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM messages m2 WHERE m2.session_id = s.id) AS message_count
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    WHERE s.title LIKE ? OR m.content LIKE ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `);
  const rows = stmt.all(pattern, pattern) as (SessionRow & { message_count: number })[];

  return rows.map((row) => ({ ...mapSession(row), messageCount: row.message_count }));
}

export function deleteSession(db: Database, id: string) {
  const stmt = db.prepare(`DELETE FROM sessions WHERE id = ?`);
  return stmt.run(id);
}

export function updateSessionTitle(db: Database, id: string, title: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(title, id);
}

export function updateSessionModel(db: Database, id: string, model: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET model = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(model, id);
}

export function updateClaudeSessionId(
  db: Database,
  sessionId: string,
  claudeSessionId: string
) {
  const stmt = db.prepare(
    `UPDATE sessions SET claude_session_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(claudeSessionId, sessionId);
}

export function setSessionLinearIssue(
  db: Database,
  sessionId: string,
  linearIssue: LinearIssueMetadata
) {
  const stmt = db.prepare(
    `UPDATE sessions SET linear_issue_id = ?, linear_issue_title = ?, linear_issue_summary = ?, linear_issue_url = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(
    linearIssue.id,
    linearIssue.title,
    linearIssue.summary ?? null,
    linearIssue.url ?? null,
    sessionId
  );
}

export function clearClaudeSessionId(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET claude_session_id = NULL, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(sessionId);
}

export function addMessage(
  db: Database,
  id: string,
  sessionId: string,
  role: string,
  content: string
) {
  const stmt = db.prepare(
    `INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(id, sessionId, role, content) as MessageRow;
  return mapMessage(row);
}

export function getMessages(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
  );
  const rows = stmt.all(sessionId) as MessageRow[];
  return rows.map(mapMessage);
}

export function listSessionCheckpoints(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `SELECT * FROM checkpoints WHERE session_id = ? ORDER BY turn_index ASC, timestamp ASC, id ASC`
  );
  const rows = stmt.all(sessionId) as CheckpointRow[];
  return rows.map(mapCheckpoint);
}

export function getSessionCheckpoint(db: Database, sessionId: string, checkpointId: string) {
  const stmt = db.prepare(
    `SELECT * FROM checkpoints WHERE session_id = ? AND id = ?`
  );
  const row = stmt.get(sessionId, checkpointId) as CheckpointRow | null;
  return row ? mapCheckpoint(row) : null;
}

export function getSessionMessageCount(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `SELECT COUNT(*) AS count FROM messages WHERE session_id = ?`
  );
  const row = stmt.get(sessionId) as { count: number } | null;
  return row?.count ?? 0;
}

export function createCheckpoint(db: Database, checkpoint: CheckpointMetadata) {
  const id = crypto.randomUUID();
  const stmt = db.prepare(
    `INSERT INTO checkpoints (
      id,
      session_id,
      user_message_id,
      prompt_preview,
      files_changed,
      turn_index,
      git_commit,
      message_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    id,
    checkpoint.sessionId,
    checkpoint.userMessageId,
    checkpoint.promptPreview,
    JSON.stringify(checkpoint.filesChanged),
    checkpoint.turnIndex,
    checkpoint.gitCommit ?? null,
    checkpoint.messageCount ?? 0
  ) as CheckpointRow;
  return mapCheckpoint(row);
}

export function deleteSessionCheckpointsAfter(db: Database, sessionId: string, checkpointId: string) {
  const checkpoint = getSessionCheckpoint(db, sessionId, checkpointId);
  if (!checkpoint) return;
  const stmt = db.prepare(
    `DELETE FROM checkpoints WHERE session_id = ? AND turn_index > ?`
  );
  return stmt.run(sessionId, checkpoint.turnIndex);
}

export function trimSessionMessagesToCount(db: Database, sessionId: string, messageCount: number) {
  const count = Math.max(0, messageCount);
  const stmt = db.prepare(
    `SELECT id FROM messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC`
  );
  const rows = stmt.all(sessionId) as Array<{ id: string }>;
  const idsToDelete = rows.slice(count).map((row) => row.id);
  if (idsToDelete.length === 0) return;

  const deleteStmt = db.prepare(`DELETE FROM messages WHERE id = ?`);
  for (const id of idsToDelete) {
    deleteStmt.run(id);
  }
}

// --- Project Helpers ---

export function createProject(
  db: Database,
  id: string,
  name: string,
  repoPath: string,
  repoPathCanonical: string,
  defaultBranch: string,
  setupCommand?: string
) {
  const stmt = db.prepare(
    `INSERT INTO projects (id, name, repo_path, repo_path_canonical, default_branch, setup_command) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(id, name, repoPath, repoPathCanonical, defaultBranch, setupCommand ?? null) as ProjectRow;
  return mapProject(row);
}

export function listProjects(db: Database) {
  const stmt = db.prepare(`SELECT * FROM projects WHERE is_deleted = 0 ORDER BY created_at DESC`);
  const rows = stmt.all() as ProjectRow[];
  return rows.map(mapProject);
}

export function getProject(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM projects WHERE id = ?`);
  const row = stmt.get(id) as ProjectRow | null;
  return row ? mapProject(row) : null;
}

export function getProjectByPath(db: Database, canonicalPath: string) {
  const stmt = db.prepare(`SELECT * FROM projects WHERE repo_path_canonical = ?`);
  const row = stmt.get(canonicalPath) as ProjectRow | null;
  return row ? mapProject(row) : null;
}

export function updateProject(
  db: Database,
  id: string,
  updates: { name?: string; defaultBranch?: string; setupCommand?: string }
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.defaultBranch !== undefined) {
    setClauses.push('default_branch = ?');
    values.push(updates.defaultBranch);
  }
  if (updates.setupCommand !== undefined) {
    setClauses.push('setup_command = ?');
    values.push(updates.setupCommand);
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`
  );
  return stmt.run(...values);
}

export function deleteProject(db: Database, id: string) {
  const stmt = db.prepare(`DELETE FROM projects WHERE id = ?`);
  return stmt.run(id);
}

// --- Workspace Helpers ---

export function createWorkspace(
  db: Database,
  id: string,
  projectId: string,
  name: string,
  branch: string,
  worktreePath: string,
  worktreePathCanonical: string,
  baseBranch: string,
  linearIssue?: LinearIssueMetadata
) {
  const linearIssueId = linearIssue?.id ?? null;
  const linearIssueTitle = linearIssue?.title ?? null;
  const linearIssueSummary = linearIssue?.summary ?? null;
  const linearIssueUrl = linearIssue?.url ?? null;
  const stmt = db.prepare(
    `INSERT INTO workspaces (
      id,
      project_id,
      name,
      branch,
      worktree_path,
      worktree_path_canonical,
      base_branch,
      linear_issue_id,
      linear_issue_title,
      linear_issue_summary,
      linear_issue_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    id,
    projectId,
    name,
    branch,
    worktreePath,
    worktreePathCanonical,
    baseBranch,
    linearIssueId,
    linearIssueTitle,
    linearIssueSummary,
    linearIssueUrl
  ) as WorkspaceRow;
  return mapWorkspace(row);
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

export function getSessionForWorkspace(db: Database, workspaceId: string) {
  const stmt = db.prepare(
    `SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 1`
  );
  const row = stmt.get(workspaceId) as any;
  if (!row) return null;
  return mapSession(row);
}

export function linkSessionToWorkspace(db: Database, sessionId: string, workspaceId: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET workspace_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(workspaceId, sessionId);
}

// ─── Linear OAuth ──────────────────────────────────────────────────────────────

export type LinearOAuthRecord = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  updatedAt?: string;
};

export function getLinearOAuth(db: Database): LinearOAuthRecord | null {
  const stmt = db.prepare(
    `SELECT access_token, refresh_token, token_type, scope, expires_at, updated_at FROM linear_oauth WHERE id = 1`
  );
  const row = stmt.get() as
    | {
        access_token: string;
        refresh_token: string | null;
        token_type: string | null;
        scope: string | null;
        expires_at: string | null;
        updated_at: string | null;
      }
    | undefined;
  if (!row?.access_token) return null;

  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token ?? undefined,
    tokenType: row.token_type ?? undefined,
    scope: row.scope ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function upsertLinearOAuth(
  db: Database,
  token: Omit<LinearOAuthRecord, 'updatedAt'>
): void {
  const stmt = db.prepare(
    `INSERT INTO linear_oauth (id, access_token, refresh_token, token_type, scope, expires_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       token_type = excluded.token_type,
       scope = excluded.scope,
       expires_at = excluded.expires_at,
       updated_at = datetime('now')`
  );

  stmt.run(
    token.accessToken,
    token.refreshToken ?? null,
    token.tokenType ?? null,
    token.scope ?? null,
    token.expiresAt ?? null
  );
}

export function clearLinearOAuth(db: Database): void {
  const stmt = db.prepare(`DELETE FROM linear_oauth WHERE id = 1`);
  stmt.run();
}
