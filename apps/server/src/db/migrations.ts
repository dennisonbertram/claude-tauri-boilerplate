/**
 * Database migration functions for SQLite schema evolution.
 * Each migration is idempotent — safe to run multiple times.
 */

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
  if (!columns.some((c) => c.name === 'profile_id')) {
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
  const has = (name: string) => columns.some((c) => c.name === name);

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
    'CREATE INDEX IF NOT EXISTS idx_workspace_events_workspace_id ON workspace_events(workspace_id)',
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

export function migrateTrackerTables(db: import('bun:sqlite').Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracker_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      color TEXT,
      default_assignee TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      next_issue_number INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracker_projects_slug ON tracker_projects(slug)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracker_statuses (
      id TEXT PRIMARY KEY,
      tracker_project_id TEXT NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('backlog','todo','in_progress','done','cancelled')),
      color TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(tracker_project_id, name)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracker_statuses_project ON tracker_statuses(tracker_project_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracker_labels (
      id TEXT PRIMARY KEY,
      tracker_project_id TEXT NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT,
      UNIQUE(tracker_project_id, name)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracker_labels_project ON tracker_labels(tracker_project_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracker_issues (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL UNIQUE,
      tracker_project_id TEXT NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status_id TEXT NOT NULL REFERENCES tracker_statuses(id),
      priority INTEGER NOT NULL DEFAULT 3,
      assignee TEXT,
      due_date TEXT,
      sort_order REAL NOT NULL DEFAULT 0,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      parent_issue_id TEXT REFERENCES tracker_issues(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracker_issues_project ON tracker_issues(tracker_project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracker_issues_status ON tracker_issues(status_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracker_issues_identifier ON tracker_issues(identifier)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracker_issue_labels (
      issue_id TEXT NOT NULL REFERENCES tracker_issues(id) ON DELETE CASCADE,
      label_id TEXT NOT NULL REFERENCES tracker_labels(id) ON DELETE CASCADE,
      PRIMARY KEY(issue_id, label_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracker_comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES tracker_issues(id) ON DELETE CASCADE,
      author TEXT NOT NULL DEFAULT 'user',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracker_comments_issue ON tracker_comments(issue_id)`);
}
