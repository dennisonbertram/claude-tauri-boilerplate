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
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    system_prompt TEXT,
    use_claude_code_prompt INTEGER NOT NULL DEFAULT 1,
    model TEXT,
    effort TEXT,
    thinking_budget_tokens INTEGER,
    allowed_tools TEXT,
    disallowed_tools TEXT,
    permission_mode TEXT,
    hooks_json TEXT,
    hooks_canvas_json TEXT,
    mcp_servers_json TEXT,
    sandbox_json TEXT,
    cwd TEXT,
    additional_directories TEXT,
    setting_sources TEXT,
    max_turns INTEGER,
    max_budget_usd REAL,
    agents_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_agent_profiles_name ON agent_profiles(name);
  CREATE INDEX IF NOT EXISTS idx_agent_profiles_sort_order ON agent_profiles(sort_order);

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('uploading', 'processing', 'ready', 'error')),
    pipeline_steps TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
  CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
  CREATE INDEX IF NOT EXISTS idx_documents_mime_type ON documents(mime_type);
`;

// Re-export all migrations from the dedicated migrations module for backward compatibility
export {
  migrateSessionsWorkspaceId,
  migrateLinearIssueColumns,
  migrateWorkspaceAdditionalDirectories,
  migrateGithubIssueColumns,
  migrateSessionsProfileId,
  migrateSessionModelColumn,
  migrateWorkspaceProvenance,
  migrateWorkspaceEvents,
  migrateWorkspaceReview,
  migrateWorkspaceProviders,
  migrateWorkspaceDeploymentsTable,
  migrateDeploymentSettingsTable,
  migrateTrackerTables,
  migrateDocumentsTable,
} from './migrations';
