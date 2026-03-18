import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDb, createProject } from '../db';
import { createWorkspaceRouter, createFlatWorkspaceRouter } from './workspaces';
import { createWorkspaceNotesRouter } from './workspace-notes';
import { errorHandler } from '../middleware/error-handler';

let tempDir: string;
let repoPath: string;
let db: Database;
let app: Hono;
let projectId: string;

beforeAll(async () => {
  tempDir = join(tmpdir(), `workspace-notes-test-${Date.now()}`);
  repoPath = join(tempDir, 'repo');
  process.env.CLAUDE_TAURI_WORKTREE_BASE = join(tempDir, 'worktrees');
  mkdirSync(repoPath, { recursive: true });

  const gitInit = Bun.spawnSync(['git', 'init'], { cwd: repoPath });
  if (gitInit.exitCode !== 0) throw new Error('git init failed');

  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: repoPath });
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoPath });

  await Bun.write(join(repoPath, 'README.md'), '# Test');
  Bun.spawnSync(['git', 'add', '.'], { cwd: repoPath });
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: repoPath });
  const currentBranch = Bun.spawnSync(['git', 'branch', '--show-current'], {
    cwd: repoPath,
  }).stdout.toString().trim();
  if (currentBranch !== 'main') {
    Bun.spawnSync(['git', 'branch', '-m', 'main'], { cwd: repoPath });
  }
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
    'main'
  );
  projectId = project.id;

  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/projects', createWorkspaceRouter(db));
  app.route('/api/workspaces', createFlatWorkspaceRouter(db));
  app.route('/api/workspaces', createWorkspaceNotesRouter(db));
});

async function createTestWorkspace(name: string) {
  const res = await app.request(`/api/projects/${projectId}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
  return res.json();
}

describe('Workspace Notes API', () => {
  describe('GET /api/workspaces/:id/notes', () => {
    test('returns empty string when no notes file exists', async () => {
      const workspace = await createTestWorkspace('notes-empty-test');

      const res = await app.request(`/api/workspaces/${workspace.id}/notes`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.content).toBe('');
    });

    test('returns notes content when notes file exists', async () => {
      const workspace = await createTestWorkspace('notes-read-test');

      // First write some notes
      await app.request(`/api/workspaces/${workspace.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# My Notes\n\nSome content here.' }),
      });

      const res = await app.request(`/api/workspaces/${workspace.id}/notes`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.content).toBe('# My Notes\n\nSome content here.');
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/nonexistent-id/notes');

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/workspaces/:id/notes', () => {
    test('creates notes file with content', async () => {
      const workspace = await createTestWorkspace('notes-create-test');
      const content = '# New Notes\n\n- item 1\n- item 2';

      const res = await app.request(`/api/workspaces/${workspace.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);

      // Verify content can be read back
      const getRes = await app.request(`/api/workspaces/${workspace.id}/notes`);
      const getBody = await getRes.json();
      expect(getBody.content).toBe(content);
    });

    test('updates existing notes file', async () => {
      const workspace = await createTestWorkspace('notes-update-test');

      // Write initial content
      await app.request(`/api/workspaces/${workspace.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Original content' }),
      });

      // Update with new content
      const newContent = 'Updated content\n\nNew paragraph.';
      const res = await app.request(`/api/workspaces/${workspace.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });

      expect(res.status).toBe(200);

      const getRes = await app.request(`/api/workspaces/${workspace.id}/notes`);
      const getBody = await getRes.json();
      expect(getBody.content).toBe(newContent);
    });

    test('creates .context directory if it does not exist', async () => {
      const workspace = await createTestWorkspace('notes-dir-create-test');
      const contextDir = join(workspace.worktreePath, '.context');

      // Verify .context dir does not exist yet (since workspace was created without it)
      // Note: after this test, the PUT should create it
      const res = await app.request(`/api/workspaces/${workspace.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test notes' }),
      });

      expect(res.status).toBe(200);
      expect(existsSync(contextDir)).toBe(true);
      expect(existsSync(join(contextDir, 'notes.md'))).toBe(true);
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/nonexistent-id/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'some notes' }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('returns 400 for missing content field', async () => {
      const workspace = await createTestWorkspace('notes-validation-test');

      const res = await app.request(`/api/workspaces/${workspace.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test('allows empty string content (clearing notes)', async () => {
      const workspace = await createTestWorkspace('notes-clear-test');

      // First write some content
      await app.request(`/api/workspaces/${workspace.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Some notes to clear' }),
      });

      // Clear with empty string
      const res = await app.request(`/api/workspaces/${workspace.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });

      expect(res.status).toBe(200);

      const getRes = await app.request(`/api/workspaces/${workspace.id}/notes`);
      const getBody = await getRes.json();
      expect(getBody.content).toBe('');
    });
  });
});
