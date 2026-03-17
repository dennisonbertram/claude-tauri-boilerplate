export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    claude_session_id TEXT,
    linear_issue_id TEXT,
    linear_issue_title TEXT,
    linear_issue_summary TEXT,
    linear_issue_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(trim(name)) > 0),
    repo_path TEXT NOT NULL UNIQUE,
    repo_path_canonical TEXT NOT NULL UNIQUE,
    default_branch TEXT NOT NULL DEFAULT 'main',
    setup_command TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
  CREATE INDEX IF NOT EXISTS idx_projects_canonical_path ON projects(repo_path_canonical);

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    worktree_path TEXT NOT NULL UNIQUE,
    worktree_path_canonical TEXT NOT NULL UNIQUE,
    base_branch TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'creating'
      CHECK(status IN ('creating', 'setup_running', 'ready', 'active', 'merging', 'discarding', 'merged', 'archived', 'error')),
    claude_session_id TEXT,
    linear_issue_id TEXT,
    linear_issue_title TEXT,
    linear_issue_summary TEXT,
    linear_issue_url TEXT,
    setup_pid INTEGER,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, name),
    UNIQUE(project_id, branch)
  );
  CREATE INDEX IF NOT EXISTS idx_workspaces_project_id ON workspaces(project_id);
  CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
  CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON workspaces(updated_at);
`;

/**
 * Add workspace_id column to sessions table if it doesn't already exist.
 * SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we check first.
 */
export function migrateSessionsWorkspaceId(db: import('bun:sqlite').Database): void {
  const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasWorkspaceId = columns.some((col) => col.name === 'workspace_id');
  if (!hasWorkspaceId) {
    db.exec(`ALTER TABLE sessions ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id)`);
}

export function migrateLinearIssueColumns(db: import('bun:sqlite').Database): void {
  const workspaceColumns = db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
  const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const wsHasIssueId = workspaceColumns.some((col) => col.name === 'linear_issue_id');
  const wsHasIssueTitle = workspaceColumns.some((col) => col.name === 'linear_issue_title');
  const wsHasIssueSummary = workspaceColumns.some((col) => col.name === 'linear_issue_summary');
  const wsHasIssueUrl = workspaceColumns.some((col) => col.name === 'linear_issue_url');
  const sHasIssueId = sessionColumns.some((col) => col.name === 'linear_issue_id');
  const sHasIssueTitle = sessionColumns.some((col) => col.name === 'linear_issue_title');
  const sHasIssueSummary = sessionColumns.some((col) => col.name === 'linear_issue_summary');
  const sHasIssueUrl = sessionColumns.some((col) => col.name === 'linear_issue_url');

  if (!wsHasIssueId) {
    db.exec('ALTER TABLE workspaces ADD COLUMN linear_issue_id TEXT');
  }
  if (!wsHasIssueTitle) {
    db.exec('ALTER TABLE workspaces ADD COLUMN linear_issue_title TEXT');
  }
  if (!wsHasIssueSummary) {
    db.exec('ALTER TABLE workspaces ADD COLUMN linear_issue_summary TEXT');
  }
  if (!wsHasIssueUrl) {
    db.exec('ALTER TABLE workspaces ADD COLUMN linear_issue_url TEXT');
  }

  if (!sHasIssueId) {
    db.exec('ALTER TABLE sessions ADD COLUMN linear_issue_id TEXT');
  }
  if (!sHasIssueTitle) {
    db.exec('ALTER TABLE sessions ADD COLUMN linear_issue_title TEXT');
  }
  if (!sHasIssueSummary) {
    db.exec('ALTER TABLE sessions ADD COLUMN linear_issue_summary TEXT');
  }
  if (!sHasIssueUrl) {
    db.exec('ALTER TABLE sessions ADD COLUMN linear_issue_url TEXT');
  }
}
