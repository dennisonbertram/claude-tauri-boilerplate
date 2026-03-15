import { Database } from 'bun:sqlite';
import { SCHEMA, migrateSessionsWorkspaceId } from './schema';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { isValidTransition, type WorkspaceStatus } from '@claude-tauri/shared';

const DB_DIR = join(process.env.HOME || '~', '.claude-tauri');
const DB_PATH = join(DB_DIR, 'data.db');

interface SessionRow {
  id: string;
  title: string;
  claude_session_id: string | null;
  workspace_id: string | null;
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
    workspaceId: row.workspace_id,
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
  return db;
}

export function createSession(db: Database, id: string, title?: string) {
  const stmt = db.prepare(
    `INSERT INTO sessions (id, title) VALUES (?, ?) RETURNING *`
  );
  const row = stmt.get(id, title || 'New Chat') as SessionRow;
  return mapSession(row);
}

export function getSession(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
  const row = stmt.get(id) as SessionRow | null;
  return row ? mapSession(row) : null;
}

export function listSessions(db: Database) {
  const stmt = db.prepare(`SELECT * FROM sessions ORDER BY created_at DESC`);
  const rows = stmt.all() as SessionRow[];
  return rows.map(mapSession);
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
  baseBranch: string
) {
  const stmt = db.prepare(
    `INSERT INTO workspaces (id, project_id, name, branch, worktree_path, worktree_path_canonical, base_branch) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(id, projectId, name, branch, worktreePath, worktreePathCanonical, baseBranch) as WorkspaceRow;
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

export function linkSessionToWorkspace(db: Database, sessionId: string, workspaceId: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET workspace_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(workspaceId, sessionId);
}
