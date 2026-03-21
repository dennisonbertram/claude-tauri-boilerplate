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

export function migrateSessionsProfileId(db: import('bun:sqlite').Database): void {
  const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'profile_id')) {
    db.exec("ALTER TABLE sessions ADD COLUMN profile_id TEXT REFERENCES agent_profiles(id) ON DELETE SET NULL");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_profile_id ON sessions(profile_id)");
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

/**
 * Add workspace provenance and lifecycle tracking columns to workspaces table.
 * SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we check first.
 */
export function migrateWorkspaceProvenance(db: import('bun:sqlite').Database): void {
  const columns = db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
  const has = (name: string) => columns.some(c => c.name === name);

  if (!has('source_branch')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN source_branch TEXT');
  }
  if (!has('source_ref_sha')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN source_ref_sha TEXT');
  }
  if (!has('base_ref_sha')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN base_ref_sha TEXT');
  }
  if (!has('parent_workspace_id')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN parent_workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL');
  }
  if (!has('archived_at')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN archived_at TEXT');
  }
  if (!has('last_reconciled_at')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN last_reconciled_at TEXT');
  }
  if (!has('recovery_status')) {
    db.exec("ALTER TABLE workspaces ADD COLUMN recovery_status TEXT NOT NULL DEFAULT 'healthy'");
  }
}

/**
 * Create workspace_events audit trail table.
 * Idempotent — uses CREATE TABLE IF NOT EXISTS.
 */
export function migrateWorkspaceEvents(db: import('bun:sqlite').Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_workspace_events_workspace_id ON workspace_events(workspace_id)'
  );
}

export function migrateWorkspaceReview(db: import('bun:sqlite').Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_reviews (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
        selected_from_ref TEXT,
        selected_to_ref TEXT,
        filter_mode TEXT NOT NULL DEFAULT 'all' CHECK(filter_mode IN ('all','reviewed','unreviewed')),
        view_mode TEXT NOT NULL DEFAULT 'unified' CHECK(view_mode IN ('unified','side-by-side')),
        pr_number INTEGER,
        pr_url TEXT,
        pr_head_sha TEXT,
        pr_base_sha TEXT,
        pr_title TEXT,
        pr_body TEXT,
        checks_json TEXT NOT NULL DEFAULT '[]',
        deployments_json TEXT NOT NULL DEFAULT '[]',
        summary_json TEXT NOT NULL DEFAULT '{}',
        freshness_checked_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // table already exists
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_workspace_reviews_workspace_id ON workspace_reviews(workspace_id)`);
  } catch {
    // index already exists
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_review_files (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES workspace_reviews(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        review_state TEXT NOT NULL DEFAULT 'unreviewed' CHECK(review_state IN ('unreviewed','reviewed','ignored')),
        reviewed_at TEXT,
        last_seen_status TEXT,
        UNIQUE(review_id, file_path)
      )
    `);
  } catch {
    // table already exists
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_review_files_review_id ON workspace_review_files(review_id)`);
  } catch {
    // index already exists
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_review_comments (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES workspace_reviews(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        diff_line_key TEXT,
        old_line INTEGER,
        new_line INTEGER,
        markdown TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','outdated')),
        sync_state TEXT NOT NULL DEFAULT 'local_only' CHECK(sync_state IN ('local_only','pending_sync','synced','failed')),
        github_comment_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // table already exists
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_review_comments_review_id ON workspace_review_comments(review_id)`);
  } catch {
    // index already exists
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_review_todos (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES workspace_reviews(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
        source TEXT NOT NULL DEFAULT 'local' CHECK(source IN ('local','check','agent')),
        file_path TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // table already exists
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_review_todos_review_id ON workspace_review_todos(review_id)`);
  } catch {
    // index already exists
  }
}

export function migrateWorkspaceProviders(db: import('bun:sqlite').Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_providers (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'script' CHECK(type IN ('script')),
        command TEXT NOT NULL,
        args_json TEXT NOT NULL DEFAULT '[]',
        working_dir TEXT,
        timeout_ms INTEGER NOT NULL DEFAULT 1800000,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(project_id, name)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_providers_project_id ON workspace_providers(project_id)');
  } catch (_err) {
    // Table already exists — idempotent
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_provisioning_runs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL REFERENCES workspace_providers(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending','running','succeeded','failed','teardown_running','torn_down','teardown_failed')),
        request_json TEXT NOT NULL DEFAULT '{}',
        response_json TEXT NOT NULL DEFAULT '{}',
        logs_redacted TEXT NOT NULL DEFAULT '',
        cleanup_owner TEXT,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_provisioning_runs_workspace_id ON workspace_provisioning_runs(workspace_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_provisioning_runs_status ON workspace_provisioning_runs(status)');
  } catch (_err) {
    // Table already exists — idempotent
  }
}

export function migrateWorkspaceDeploymentsTable(db: import('bun:sqlite').Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_deployments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
      railway_project_id TEXT NOT NULL,
      railway_service_id TEXT NOT NULL,
      railway_environment_id TEXT NOT NULL,
      last_deployment_status TEXT,
      last_deployment_id TEXT,
      last_deployment_created_at TEXT,
      last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_workspace_deployments_workspace_id ON workspace_deployments(workspace_id)`);
}

export function migrateDeploymentSettingsTable(db: import('bun:sqlite').Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deployment_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      railway_api_token TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
