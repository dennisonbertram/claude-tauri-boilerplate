import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createProject } from '../db';
import { createWorkspaceRouter, createFlatWorkspaceRouter } from './workspaces';
import { createCodeReviewRouter } from './code-review';
import { errorHandler } from '../middleware/error-handler';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir: string;
let repoPath: string;
let db: Database;
let app: Hono;
let projectId: string;
let defaultBranch: string;

beforeAll(async () => {
  tempDir = join(tmpdir(), `code-review-test-${Date.now()}`);
  repoPath = join(tempDir, 'repo');
  process.env.CLAUDE_TAURI_WORKTREE_BASE = join(tempDir, 'worktrees');
  mkdirSync(repoPath, { recursive: true });

  const gitInit = Bun.spawnSync(['git', 'init'], { cwd: repoPath });
  if (gitInit.exitCode !== 0) throw new Error('git init failed');

  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: repoPath });
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoPath });

  const initFile = join(repoPath, 'README.md');
  await Bun.write(initFile, '# Test');
  Bun.spawnSync(['git', 'add', '.'], { cwd: repoPath });
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: repoPath });

  const branchResult = Bun.spawnSync(['git', 'symbolic-ref', '--short', 'HEAD'], {
    cwd: repoPath,
  });
  defaultBranch = branchResult.stdout.toString().trim() || 'main';
});

afterAll(() => {
  if (db) db.close();
  delete process.env.CLAUDE_TAURI_WORKTREE_BASE;
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  if (db) db.close();
  db = createDb(':memory:');

  const realpath = Bun.spawnSync(['realpath', repoPath]).stdout.toString().trim();
  const project = createProject(
    db,
    crypto.randomUUID(),
    'test-project',
    repoPath,
    realpath || repoPath,
    defaultBranch
  );
  projectId = project.id;

  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/projects', createWorkspaceRouter(db));
  app.route('/api/workspaces', createFlatWorkspaceRouter(db));
  app.route('/api/workspaces', createCodeReviewRouter(db));
});

/** Helper: create a workspace and return its JSON body */
async function createWorkspace(name: string) {
  const res = await app.request(
    `/api/projects/${projectId}/workspaces`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }
  );
  expect(res.status).toBe(201);
  return res.json();
}

describe('POST /api/workspaces/:id/code-review', () => {
  test('returns 404 for unknown workspace', async () => {
    const res = await app.request('/api/workspaces/no-such-id/code-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Review this diff' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 if workspace has no diff (empty diff)', async () => {
    const ws = await createWorkspace('no-diff-workspace');

    const res = await app.request(`/api/workspaces/${ws.id}/code-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Review this diff' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no diff');
  });

  test('returns 400 for workspace in invalid state', async () => {
    const ws = await createWorkspace('invalid-state-workspace');

    // Manually set workspace to merged (terminal state)
    const { updateWorkspaceStatus } = await import('../db');
    updateWorkspaceStatus(db, ws.id, 'merging');
    updateWorkspaceStatus(db, ws.id, 'merged');

    const res = await app.request(`/api/workspaces/${ws.id}/code-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Review this diff' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_STATE');
  });

  test('accepts optional model and effort parameters', async () => {
    const ws = await createWorkspace('model-param-workspace');

    // Workspace has no diff so should get 400 for no diff regardless
    const res = await app.request(`/api/workspaces/${ws.id}/code-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Review this diff',
        model: 'claude-haiku-4-5-20251001',
        effort: 'low',
      }),
    });
    // Should get 400 for empty diff, not 422 validation error
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no diff');
  });

  test('validates effort parameter rejects invalid values', async () => {
    const ws = await createWorkspace('effort-validation-workspace');

    const res = await app.request(`/api/workspaces/${ws.id}/code-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Review this diff',
        effort: 'invalid-effort-value',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
