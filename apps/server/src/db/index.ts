import { Database } from 'bun:sqlite';
import { SCHEMA, migrateSessionsWorkspaceId, migrateLinearIssueColumns, migrateSessionModelColumn, migrateWorkspaceAdditionalDirectories, migrateGithubIssueColumns } from './schema';
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
  migrateWorkspaceAdditionalDirectories(db);
  migrateGithubIssueColumns(db);
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
  content: string,
  parts?: Array<{ type: string; text?: string; artifactId?: string; artifactRevisionId?: string; [key: string]: unknown }>
) {
  return db.transaction(() => {
    const stmt = db.prepare(
      `INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?) RETURNING *`
    );
    const row = stmt.get(id, sessionId, role, content) as MessageRow;
    if (parts && parts.length > 0) {
      const partStmt = db.prepare(
        `INSERT INTO message_parts (id, message_id, part_type, ordinal, text, artifact_id, artifact_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        partStmt.run(
          crypto.randomUUID(),
          id,
          part.type,
          i,
          part.text ?? null,
          part.artifactId ?? null,
          part.artifactRevisionId ?? null
        );
      }
    }
    return mapMessage(row);
  })();
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

type GithubIssueMetadata = {
  number: number;
  title: string;
  url?: string;
  repo?: string;
};

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

// ─── Diff Comments ─────────────────────────────────────────────────────────────

interface DiffCommentRow {
  id: string;
  workspace_id: string;
  file_path: string;
  line_number: number | null;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

function mapDiffComment(row: DiffCommentRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    filePath: row.file_path,
    lineNumber: row.line_number ?? null,
    content: row.content,
    author: row.author as 'user' | 'ai',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listDiffComments(db: Database, workspaceId: string) {
  const stmt = db.prepare(
    `SELECT * FROM diff_comments WHERE workspace_id = ? ORDER BY created_at ASC`
  );
  const rows = stmt.all(workspaceId) as DiffCommentRow[];
  return rows.map(mapDiffComment);
}

export function createDiffComment(
  db: Database,
  id: string,
  workspaceId: string,
  filePath: string,
  content: string,
  lineNumber?: number | null,
  author: 'user' | 'ai' = 'user'
) {
  const stmt = db.prepare(
    `INSERT INTO diff_comments (id, workspace_id, file_path, line_number, content, author)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(id, workspaceId, filePath, lineNumber ?? null, content, author) as DiffCommentRow;
  return mapDiffComment(row);
}

export function getDiffComment(db: Database, workspaceId: string, commentId: string) {
  const stmt = db.prepare(
    `SELECT * FROM diff_comments WHERE workspace_id = ? AND id = ?`
  );
  const row = stmt.get(workspaceId, commentId) as DiffCommentRow | null;
  return row ? mapDiffComment(row) : null;
}

export function deleteDiffComment(db: Database, workspaceId: string, commentId: string): boolean {
  const stmt = db.prepare(
    `DELETE FROM diff_comments WHERE workspace_id = ? AND id = ?`
  );
  const result = stmt.run(workspaceId, commentId);
  return result.changes > 0;
}

// ─── Thread Messages ────────────────────────────────────────────────────────────

interface MessagePartRow {
  id: string;
  message_id: string;
  part_type: string;
  ordinal: number;
  text: string | null;
  artifact_id: string | null;
  artifact_revision_id: string | null;
  metadata_json: string | null;
  created_at: string;
}

function mapMessagePart(row: MessagePartRow) {
  return {
    type: row.part_type,
    text: row.text ?? undefined,
    artifactId: row.artifact_id ?? undefined,
    artifactRevisionId: row.artifact_revision_id ?? undefined,
    ordinal: row.ordinal,
  };
}

export function getThreadMessages(db: Database, sessionId: string) {
  const msgStmt = db.prepare(
    `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
  );
  const messages = msgStmt.all(sessionId) as MessageRow[];

  const partStmt = db.prepare(
    `SELECT * FROM message_parts WHERE message_id = ? ORDER BY ordinal ASC`
  );

  return messages.map((msg) => {
    const partRows = partStmt.all(msg.id) as MessagePartRow[];
    let parts: ReturnType<typeof mapMessagePart>[];
    if (partRows.length === 0) {
      // Legacy message: synthesize a fallback text part
      parts = [{ type: 'text', text: msg.content, ordinal: 0, artifactId: undefined, artifactRevisionId: undefined }];
    } else {
      parts = partRows.map(mapMessagePart);
    }
    return {
      ...mapMessage(msg),
      parts,
    };
  });
}

// ─── Artifact Helpers ───────────────────────────────────────────────────────────

interface ArtifactRow {
  id: string;
  kind: string;
  schema_version: number;
  title: string;
  project_id: string;
  workspace_id: string | null;
  source_session_id: string | null;
  source_message_id: string | null;
  status: string;
  current_revision_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ArtifactRevisionRow {
  id: string;
  artifact_id: string;
  revision_number: number;
  spec_json: string;
  summary: string | null;
  prompt: string | null;
  model: string | null;
  source_session_id: string | null;
  source_message_id: string | null;
  created_at: string;
}

function mapArtifact(row: ArtifactRow) {
  return {
    id: row.id,
    kind: row.kind as import('@claude-tauri/shared').ArtifactKind,
    schemaVersion: row.schema_version,
    title: row.title,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    sourceSessionId: row.source_session_id,
    sourceMessageId: row.source_message_id,
    status: row.status as import('@claude-tauri/shared').ArtifactStatus,
    currentRevisionId: row.current_revision_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapArtifactRevision(row: ArtifactRevisionRow) {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    revisionNumber: row.revision_number,
    specJson: row.spec_json,
    summary: row.summary,
    prompt: row.prompt,
    model: row.model,
    sourceSessionId: row.source_session_id,
    sourceMessageId: row.source_message_id,
    createdAt: row.created_at,
  };
}

export function createArtifact(db: Database, params: {
  id: string;
  kind: string;
  schemaVersion: number;
  title: string;
  projectId: string;
  workspaceId: string | null;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  status: 'active' | 'archived';
}) {
  const stmt = db.prepare(
    `INSERT INTO artifacts (id, kind, schema_version, title, project_id, workspace_id, source_session_id, source_message_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    params.id,
    params.kind,
    params.schemaVersion,
    params.title,
    params.projectId,
    params.workspaceId,
    params.sourceSessionId,
    params.sourceMessageId,
    params.status
  ) as ArtifactRow;
  return mapArtifact(row);
}

export function getArtifact(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM artifacts WHERE id = ?`);
  const row = stmt.get(id) as ArtifactRow | null;
  return row ? mapArtifact(row) : null;
}

export function listArtifactsByProject(db: Database, projectId: string, opts?: { includeArchived?: boolean }) {
  const includeArchived = opts?.includeArchived ?? false;
  if (includeArchived) {
    const stmt = db.prepare(`SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at DESC`);
    const rows = stmt.all(projectId) as ArtifactRow[];
    return rows.map(mapArtifact);
  } else {
    const stmt = db.prepare(`SELECT * FROM artifacts WHERE project_id = ? AND status = 'active' ORDER BY created_at DESC`);
    const rows = stmt.all(projectId) as ArtifactRow[];
    return rows.map(mapArtifact);
  }
}

export function setArtifactCurrentRevision(db: Database, artifactId: string, revisionId: string) {
  const stmt = db.prepare(
    `UPDATE artifacts SET current_revision_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(revisionId, artifactId);
}

export function archiveArtifact(db: Database, id: string) {
  const stmt = db.prepare(
    `UPDATE artifacts SET status = 'archived', updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(id);
}

export function createArtifactRevision(db: Database, params: {
  id: string;
  artifactId: string;
  revisionNumber: number;
  specJson: string;
  summary: string | null;
  prompt: string | null;
  model: string | null;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
}) {
  const stmt = db.prepare(
    `INSERT INTO artifact_revisions (id, artifact_id, revision_number, spec_json, summary, prompt, model, source_session_id, source_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    params.id,
    params.artifactId,
    params.revisionNumber,
    params.specJson,
    params.summary,
    params.prompt,
    params.model,
    params.sourceSessionId,
    params.sourceMessageId
  ) as ArtifactRevisionRow;
  return mapArtifactRevision(row);
}

export function updateArtifactTitle(db: Database, id: string, title: string) {
  const stmt = db.prepare(
    `UPDATE artifacts SET title = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(title, id);
}

export function countArtifactRevisions(db: Database, artifactId: string): number {
  const stmt = db.prepare(
    `SELECT COUNT(*) AS count FROM artifact_revisions WHERE artifact_id = ?`
  );
  const row = stmt.get(artifactId) as { count: number } | null;
  return row?.count ?? 0;
}

// ─── Agent Profile Helpers ──────────────────────────────────────────────────────

interface AgentProfileRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_default: number;
  sort_order: number;
  system_prompt: string | null;
  use_claude_code_prompt: number;
  model: string | null;
  effort: string | null;
  thinking_budget_tokens: number | null;
  allowed_tools: string;
  disallowed_tools: string;
  permission_mode: string | null;
  hooks_json: string | null;
  hooks_canvas_json: string | null;
  mcp_servers_json: string | null;
  sandbox_json: string | null;
  cwd: string | null;
  additional_directories: string;
  setting_sources: string;
  max_turns: number | null;
  max_budget_usd: number | null;
  agents_json: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // ignore
  }
  return [];
}

function mapAgentProfile(row: AgentProfileRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    systemPrompt: row.system_prompt,
    useClaudeCodePrompt: row.use_claude_code_prompt === 1,
    model: row.model,
    effort: row.effort as 'low' | 'medium' | 'high' | null,
    thinkingBudgetTokens: row.thinking_budget_tokens,
    allowedTools: parseJsonArray(row.allowed_tools),
    disallowedTools: parseJsonArray(row.disallowed_tools),
    permissionMode: row.permission_mode as 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions' | null,
    hooksJson: row.hooks_json,
    hooksCanvasJson: row.hooks_canvas_json,
    mcpServersJson: row.mcp_servers_json,
    sandboxJson: row.sandbox_json,
    cwd: row.cwd,
    additionalDirectories: parseJsonArray(row.additional_directories),
    settingSources: parseJsonArray(row.setting_sources),
    maxTurns: row.max_turns,
    maxBudgetUsd: row.max_budget_usd,
    agentsJson: row.agents_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type AgentProfileInput = {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isDefault?: boolean;
  sortOrder?: number;
  systemPrompt?: string;
  useClaudeCodePrompt?: boolean;
  model?: string;
  effort?: 'low' | 'medium' | 'high';
  thinkingBudgetTokens?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions';
  hooksJson?: string;
  hooksCanvasJson?: string;
  mcpServersJson?: string;
  sandboxJson?: string;
  cwd?: string;
  additionalDirectories?: string[];
  settingSources?: string[];
  maxTurns?: number;
  maxBudgetUsd?: number;
  agentsJson?: string;
};

export function createAgentProfile(db: Database, id: string, input: AgentProfileInput) {
  const stmt = db.prepare(
    `INSERT INTO agent_profiles (
      id, name, description, icon, color, is_default, sort_order,
      system_prompt, use_claude_code_prompt, model, effort, thinking_budget_tokens,
      allowed_tools, disallowed_tools, permission_mode,
      hooks_json, hooks_canvas_json, mcp_servers_json, sandbox_json,
      cwd, additional_directories, setting_sources,
      max_turns, max_budget_usd, agents_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    id,
    input.name,
    input.description ?? null,
    input.icon ?? null,
    input.color ?? null,
    input.isDefault ? 1 : 0,
    input.sortOrder ?? 0,
    input.systemPrompt ?? null,
    input.useClaudeCodePrompt !== false ? 1 : 0,
    input.model ?? null,
    input.effort ?? null,
    input.thinkingBudgetTokens ?? null,
    JSON.stringify(input.allowedTools ?? []),
    JSON.stringify(input.disallowedTools ?? []),
    input.permissionMode ?? null,
    input.hooksJson ?? null,
    input.hooksCanvasJson ?? null,
    input.mcpServersJson ?? null,
    input.sandboxJson ?? null,
    input.cwd ?? null,
    JSON.stringify(input.additionalDirectories ?? []),
    JSON.stringify(input.settingSources ?? []),
    input.maxTurns ?? null,
    input.maxBudgetUsd ?? null,
    input.agentsJson ?? null
  ) as AgentProfileRow;
  return mapAgentProfile(row);
}

export function getAgentProfile(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM agent_profiles WHERE id = ?`);
  const row = stmt.get(id) as AgentProfileRow | null;
  return row ? mapAgentProfile(row) : null;
}

export function listAgentProfiles(db: Database) {
  const stmt = db.prepare(`SELECT * FROM agent_profiles ORDER BY sort_order ASC, created_at ASC`);
  const rows = stmt.all() as AgentProfileRow[];
  return rows.map(mapAgentProfile);
}

export function updateAgentProfile(db: Database, id: string, updates: Partial<AgentProfileInput>) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.icon !== undefined) {
    setClauses.push('icon = ?');
    values.push(updates.icon);
  }
  if (updates.color !== undefined) {
    setClauses.push('color = ?');
    values.push(updates.color);
  }
  if (updates.isDefault !== undefined) {
    setClauses.push('is_default = ?');
    values.push(updates.isDefault ? 1 : 0);
  }
  if (updates.sortOrder !== undefined) {
    setClauses.push('sort_order = ?');
    values.push(updates.sortOrder);
  }
  if (updates.systemPrompt !== undefined) {
    setClauses.push('system_prompt = ?');
    values.push(updates.systemPrompt);
  }
  if (updates.useClaudeCodePrompt !== undefined) {
    setClauses.push('use_claude_code_prompt = ?');
    values.push(updates.useClaudeCodePrompt ? 1 : 0);
  }
  if (updates.model !== undefined) {
    setClauses.push('model = ?');
    values.push(updates.model);
  }
  if (updates.effort !== undefined) {
    setClauses.push('effort = ?');
    values.push(updates.effort);
  }
  if (updates.thinkingBudgetTokens !== undefined) {
    setClauses.push('thinking_budget_tokens = ?');
    values.push(updates.thinkingBudgetTokens);
  }
  if (updates.allowedTools !== undefined) {
    setClauses.push('allowed_tools = ?');
    values.push(JSON.stringify(updates.allowedTools));
  }
  if (updates.disallowedTools !== undefined) {
    setClauses.push('disallowed_tools = ?');
    values.push(JSON.stringify(updates.disallowedTools));
  }
  if (updates.permissionMode !== undefined) {
    setClauses.push('permission_mode = ?');
    values.push(updates.permissionMode);
  }
  if (updates.hooksJson !== undefined) {
    setClauses.push('hooks_json = ?');
    values.push(updates.hooksJson);
  }
  if (updates.hooksCanvasJson !== undefined) {
    setClauses.push('hooks_canvas_json = ?');
    values.push(updates.hooksCanvasJson);
  }
  if (updates.mcpServersJson !== undefined) {
    setClauses.push('mcp_servers_json = ?');
    values.push(updates.mcpServersJson);
  }
  if (updates.sandboxJson !== undefined) {
    setClauses.push('sandbox_json = ?');
    values.push(updates.sandboxJson);
  }
  if (updates.cwd !== undefined) {
    setClauses.push('cwd = ?');
    values.push(updates.cwd);
  }
  if (updates.additionalDirectories !== undefined) {
    setClauses.push('additional_directories = ?');
    values.push(JSON.stringify(updates.additionalDirectories));
  }
  if (updates.settingSources !== undefined) {
    setClauses.push('setting_sources = ?');
    values.push(JSON.stringify(updates.settingSources));
  }
  if (updates.maxTurns !== undefined) {
    setClauses.push('max_turns = ?');
    values.push(updates.maxTurns);
  }
  if (updates.maxBudgetUsd !== undefined) {
    setClauses.push('max_budget_usd = ?');
    values.push(updates.maxBudgetUsd);
  }
  if (updates.agentsJson !== undefined) {
    setClauses.push('agents_json = ?');
    values.push(updates.agentsJson);
  }

  if (setClauses.length === 0) return getAgentProfile(db, id);

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(
    `UPDATE agent_profiles SET ${setClauses.join(', ')} WHERE id = ?`
  );
  stmt.run(...values);

  return getAgentProfile(db, id);
}

export function deleteAgentProfile(db: Database, id: string) {
  const stmt = db.prepare(`DELETE FROM agent_profiles WHERE id = ?`);
  return stmt.run(id);
}

export function duplicateAgentProfile(db: Database, sourceId: string, newId: string) {
  const source = getAgentProfile(db, sourceId);
  if (!source) return null;

  return createAgentProfile(db, newId, {
    name: `${source.name} (Copy)`,
    description: source.description ?? undefined,
    icon: source.icon ?? undefined,
    color: source.color ?? undefined,
    isDefault: false, // duplicates are never default
    sortOrder: source.sortOrder,
    systemPrompt: source.systemPrompt ?? undefined,
    useClaudeCodePrompt: source.useClaudeCodePrompt,
    model: source.model ?? undefined,
    effort: source.effort ?? undefined,
    thinkingBudgetTokens: source.thinkingBudgetTokens ?? undefined,
    allowedTools: source.allowedTools,
    disallowedTools: source.disallowedTools,
    permissionMode: source.permissionMode ?? undefined,
    hooksJson: source.hooksJson ?? undefined,
    hooksCanvasJson: source.hooksCanvasJson ?? undefined,
    mcpServersJson: source.mcpServersJson ?? undefined,
    sandboxJson: source.sandboxJson ?? undefined,
    cwd: source.cwd ?? undefined,
    additionalDirectories: source.additionalDirectories,
    settingSources: source.settingSources,
    maxTurns: source.maxTurns ?? undefined,
    maxBudgetUsd: source.maxBudgetUsd ?? undefined,
    agentsJson: source.agentsJson ?? undefined,
  });
}
