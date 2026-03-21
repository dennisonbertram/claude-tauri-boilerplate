import { describe, test, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { SCHEMA, migrateWorkspaceProvenance, migrateWorkspaceEvents } from '../db/schema';
import { reconcileProjectWorkspaces } from './workspace-reconciler';

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  migrateWorkspaceProvenance(db);
  migrateWorkspaceEvents(db);

  // Seed a project so foreign-key constraints on workspaces are satisfied
  db.exec(`
    INSERT INTO projects (id, name, repo_path, repo_path_canonical, default_branch)
    VALUES ('proj-1', 'Test Project', '/tmp/repo', '/tmp/repo', 'main')
  `);

  return db;
}

function insertWorkspace(
  db: Database,
  overrides: Partial<{
    id: string;
    status: string;
    worktreePath: string;
    branch: string;
    errorMessage: string | null;
  }> = {}
) {
  const id = overrides.id ?? crypto.randomUUID();
  const status = overrides.status ?? 'ready';
  const worktreePath = overrides.worktreePath ?? `/tmp/wt-${id}`;
  const branch = overrides.branch ?? `workspace/${id}`;
  const errorMessage = overrides.errorMessage ?? null;

  db.prepare(
    `INSERT INTO workspaces (id, project_id, name, branch, worktree_path, worktree_path_canonical, base_branch, additional_directories, status, error_message)
     VALUES (?, 'proj-1', ?, ?, ?, ?, 'main', '[]', ?, ?)`
  ).run(id, `ws-${id}`, branch, worktreePath, worktreePath, status, errorMessage);

  return { id, status, worktreePath, branch, errorMessage };
}

describe('reconcileProjectWorkspaces', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  test('returns zero issues on empty workspace list', async () => {
    const result = await reconcileProjectWorkspaces(db, 'proj-1', '/tmp/repo', []);

    expect(result.projectId).toBe('proj-1');
    expect(result.workspacesChecked).toBe(0);
    expect(result.issuesFound).toBe(0);
    expect(result.issues).toEqual([]);
  });

  test('classifies stale_state when status=error with no errorMessage', async () => {
    const ws = insertWorkspace(db, { status: 'error', errorMessage: null });

    const result = await reconcileProjectWorkspaces(db, 'proj-1', '/tmp/repo', [
      {
        id: ws.id,
        branch: ws.branch,
        worktreePath: ws.worktreePath,
        status: ws.status,
        errorMessage: ws.errorMessage,
      },
    ]);

    expect(result.workspacesChecked).toBe(1);
    expect(result.issuesFound).toBe(1);
    expect(result.issues[0].issue).toBe('stale_state');
    expect(result.issues[0].workspaceId).toBe(ws.id);
  });

  test('marks workspace healthy when status=ready and no filesystem issues detectable', async () => {
    // We use a non-existent directory and non-existent branch — both missing means
    // the reconciler won't classify this as orphan_row or missing_branch.
    // With status=ready (not error), no issue is raised.
    const ws = insertWorkspace(db, { status: 'ready' });

    const result = await reconcileProjectWorkspaces(db, 'proj-1', '/tmp/repo', [
      {
        id: ws.id,
        branch: ws.branch,
        worktreePath: ws.worktreePath,
        status: ws.status,
        errorMessage: ws.errorMessage,
      },
    ]);

    expect(result.workspacesChecked).toBe(1);
    expect(result.issuesFound).toBe(0);
  });

  test('handles multiple workspaces with mixed outcomes', async () => {
    const ws1 = insertWorkspace(db, { status: 'error', errorMessage: null });
    const ws2 = insertWorkspace(db, { status: 'ready' });

    const result = await reconcileProjectWorkspaces(db, 'proj-1', '/tmp/repo', [
      { id: ws1.id, branch: ws1.branch, worktreePath: ws1.worktreePath, status: ws1.status, errorMessage: ws1.errorMessage },
      { id: ws2.id, branch: ws2.branch, worktreePath: ws2.worktreePath, status: ws2.status, errorMessage: ws2.errorMessage },
    ]);

    expect(result.workspacesChecked).toBe(2);
    expect(result.issuesFound).toBe(1);
    expect(result.issues[0].issue).toBe('stale_state');
  });

  test('records reconciled events in workspace_events table', async () => {
    const ws = insertWorkspace(db, { status: 'ready' });

    await reconcileProjectWorkspaces(db, 'proj-1', '/tmp/repo', [
      { id: ws.id, branch: ws.branch, worktreePath: ws.worktreePath, status: ws.status, errorMessage: ws.errorMessage },
    ]);

    const events = db.prepare(
      `SELECT * FROM workspace_events WHERE workspace_id = ? AND event_type = 'reconciled'`
    ).all(ws.id) as Array<{ id: string; event_type: string }>;

    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe('reconciled');
  });

  test('archived workspaces are skipped for orphan_row classification', async () => {
    // An archived workspace with no directory should NOT be flagged as orphan_row
    const ws = insertWorkspace(db, { status: 'archived', worktreePath: '/tmp/nonexistent-path' });

    const result = await reconcileProjectWorkspaces(db, 'proj-1', '/tmp/repo', [
      { id: ws.id, branch: ws.branch, worktreePath: ws.worktreePath, status: ws.status, errorMessage: ws.errorMessage },
    ]);

    expect(result.issuesFound).toBe(0);
  });
});
