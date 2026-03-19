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

  CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_message_id TEXT NOT NULL,
    prompt_preview TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    files_changed TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    git_commit TEXT,
    message_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_checkpoints_session_id ON checkpoints(session_id);
  CREATE INDEX IF NOT EXISTS idx_checkpoints_session_turn_index ON checkpoints(session_id, turn_index);

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
    additional_directories TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'creating'
      CHECK(status IN ('creating', 'setup_running', 'ready', 'active', 'merging', 'discarding', 'merged', 'archived', 'error')),
    claude_session_id TEXT,
    linear_issue_id TEXT,
    linear_issue_title TEXT,
    linear_issue_summary TEXT,
    linear_issue_url TEXT,
    github_issue_number INTEGER,
    github_issue_title TEXT,
    github_issue_url TEXT,
    github_issue_repo TEXT,
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

  CREATE TABLE IF NOT EXISTS linear_oauth (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT,
    scope TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS diff_comments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    line_number INTEGER,
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'user' CHECK(author IN ('user', 'ai')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_diff_comments_workspace_id ON diff_comments(workspace_id);

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'dashboard',
    schema_version INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
    source_session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    source_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    current_revision_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts(project_id);
  CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);

  CREATE TABLE IF NOT EXISTS artifact_revisions (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    spec_json TEXT NOT NULL,
    summary TEXT,
    prompt TEXT,
    model TEXT,
    source_session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    source_message_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(artifact_id, revision_number)
  );
  CREATE INDEX IF NOT EXISTS idx_artifact_revisions_artifact_id ON artifact_revisions(artifact_id);

  CREATE TABLE IF NOT EXISTS message_parts (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    part_type TEXT NOT NULL,
    ordinal INTEGER NOT NULL DEFAULT 0,
    text TEXT,
    artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL,
    artifact_revision_id TEXT REFERENCES artifact_revisions(id) ON DELETE SET NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_message_parts_message_id ON message_parts(message_id);

  CREATE TABLE IF NOT EXISTS agent_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(trim(name)) > 0),
    description TEXT,
    icon TEXT,
    color TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    system_prompt TEXT,
    use_claude_code_prompt INTEGER NOT NULL DEFAULT 1,
    model TEXT,
    effort TEXT CHECK(effort IS NULL OR effort IN ('low', 'medium', 'high')),
    thinking_budget_tokens INTEGER,
    allowed_tools TEXT NOT NULL DEFAULT '[]',
    disallowed_tools TEXT NOT NULL DEFAULT '[]',
    permission_mode TEXT CHECK(permission_mode IS NULL OR permission_mode IN ('default', 'plan', 'acceptEdits', 'bypassPermissions')),
    hooks_json TEXT,
    hooks_canvas_json TEXT,
    mcp_servers_json TEXT,
    sandbox_json TEXT,
    cwd TEXT,
    additional_directories TEXT NOT NULL DEFAULT '[]',
    setting_sources TEXT NOT NULL DEFAULT '[]',
    max_turns INTEGER,
    max_budget_usd REAL,
    agents_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_agent_profiles_name ON agent_profiles(name);
  CREATE INDEX IF NOT EXISTS idx_agent_profiles_is_default ON agent_profiles(is_default);
  CREATE INDEX IF NOT EXISTS idx_agent_profiles_sort_order ON agent_profiles(sort_order);
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

export function migrateWorkspaceAdditionalDirectories(db: import('bun:sqlite').Database): void {
  const columns = db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
  const hasAdditionalDirectories = columns.some((col) => col.name === 'additional_directories');
  if (!hasAdditionalDirectories) {
    db.exec("ALTER TABLE workspaces ADD COLUMN additional_directories TEXT NOT NULL DEFAULT '[]'");
  }
}

export function migrateGithubIssueColumns(db: import('bun:sqlite').Database): void {
  const workspaceColumns = db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
  const wsHasNumber = workspaceColumns.some((col) => col.name === 'github_issue_number');
  const wsHasTitle = workspaceColumns.some((col) => col.name === 'github_issue_title');
  const wsHasUrl = workspaceColumns.some((col) => col.name === 'github_issue_url');
  const wsHasRepo = workspaceColumns.some((col) => col.name === 'github_issue_repo');

  if (!wsHasNumber) {
    db.exec('ALTER TABLE workspaces ADD COLUMN github_issue_number INTEGER');
  }
  if (!wsHasTitle) {
    db.exec('ALTER TABLE workspaces ADD COLUMN github_issue_title TEXT');
  }
  if (!wsHasUrl) {
    db.exec('ALTER TABLE workspaces ADD COLUMN github_issue_url TEXT');
  }
  if (!wsHasRepo) {
    db.exec('ALTER TABLE workspaces ADD COLUMN github_issue_repo TEXT');
  }
}

export function migrateSessionModelColumn(db: import('bun:sqlite').Database): void {
  const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasModel = columns.some((col) => col.name === 'model');
  if (!hasModel) {
    db.exec("ALTER TABLE sessions ADD COLUMN model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'");
  }
  db.exec("UPDATE sessions SET model = 'claude-sonnet-4-6' WHERE model IS NULL OR trim(model) = ''");
}
