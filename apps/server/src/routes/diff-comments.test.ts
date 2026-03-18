import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createProject } from '../db';
import { createDiffCommentsRouter } from './diff-comments';
import { createWorkspaceRouter, createFlatWorkspaceRouter } from './workspaces';
import { errorHandler } from '../middleware/error-handler';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir: string;
let repoPath: string;
let db: Database;
let app: Hono;
let projectId: string;
let workspaceId: string;
let defaultBranch: string;
let workspaceCounter = 0;

beforeAll(async () => {
  tempDir = join(tmpdir(), `diff-comments-test-${Date.now()}`);
  repoPath = join(tempDir, 'repo');
  process.env.CLAUDE_TAURI_WORKTREE_BASE = join(tempDir, 'worktrees');
  mkdirSync(repoPath, { recursive: true });

  // Initialize a real git repo with initial commit
  const gitInit = Bun.spawnSync(['git', 'init'], { cwd: repoPath });
  if (gitInit.exitCode !== 0) throw new Error('git init failed');

  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: repoPath });
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoPath });

  await Bun.write(join(repoPath, 'README.md'), '# Test');
  Bun.spawnSync(['git', 'add', '.'], { cwd: repoPath });
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: repoPath });

  const branchResult = Bun.spawnSync(['git', 'symbolic-ref', '--short', 'HEAD'], { cwd: repoPath });
  defaultBranch = branchResult.stdout.toString().trim() || 'main';
});

afterAll(() => {
  if (db) db.close();
  delete process.env.CLAUDE_TAURI_WORKTREE_BASE;
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
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
  app.route('/api/workspaces', createDiffCommentsRouter(db));

  // Create a workspace with a unique name to avoid git branch conflicts
  workspaceCounter++;
  const wsRes = await app.request(
    `/api/projects/${projectId}/workspaces`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `test-ws-${workspaceCounter}` }),
    }
  );
  expect(wsRes.status).toBe(201);
  const ws = await wsRes.json();
  workspaceId = ws.id;
});

describe('Diff Comments API', () => {
  describe('GET /api/workspaces/:id/diff-comments', () => {
    test('returns empty array for a workspace with no comments', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);
    });

    test('returns 404 for unknown workspace', async () => {
      const res = await app.request('/api/workspaces/nonexistent-workspace-id/diff-comments');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/workspaces/:id/diff-comments', () => {
    test('creates a comment and returns 201 with the comment', async () => {
      const payload = {
        filePath: 'src/main.ts',
        lineNumber: 42,
        content: 'This looks like a potential null dereference.',
        author: 'user',
      };

      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.workspaceId).toBe(workspaceId);
      expect(body.filePath).toBe('src/main.ts');
      expect(body.lineNumber).toBe(42);
      expect(body.content).toBe('This looks like a potential null dereference.');
      expect(body.author).toBe('user');
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    test('creates a comment without a line number (file-level comment)', async () => {
      const payload = {
        filePath: 'package.json',
        content: 'This file should not have secrets.',
      };

      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.lineNumber).toBeNull();
      expect(body.filePath).toBe('package.json');
    });

    test('defaults author to "user" when not provided', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'test.ts', content: 'A comment' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.author).toBe('user');
    });

    test('accepts "ai" as author', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'test.ts', content: 'AI review note', author: 'ai' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.author).toBe('ai');
    });

    test('returns 400 when filePath is missing', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Missing file path' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 when content is empty', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'test.ts', content: '' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 when author is an invalid value', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'test.ts', content: 'ok', author: 'robot' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for unknown workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-ws/diff-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'test.ts', content: 'A comment' }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/workspaces/:id/diff-comments (after creation)', () => {
    test('returns a previously created comment', async () => {
      // Create a comment first
      await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'src/foo.ts', lineNumber: 10, content: 'Review note' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].filePath).toBe('src/foo.ts');
      expect(body[0].lineNumber).toBe(10);
      expect(body[0].content).toBe('Review note');
    });

    test('returns multiple comments in creation order', async () => {
      await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'a.ts', content: 'First' }),
      });
      await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'b.ts', content: 'Second' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body[0].content).toBe('First');
      expect(body[1].content).toBe('Second');
    });
  });

  describe('DELETE /api/workspaces/:id/diff-comments/:commentId', () => {
    test('deletes an existing comment and returns 200', async () => {
      // Create a comment
      const createRes = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'delete-me.ts', content: 'To be deleted' }),
      });
      const created = await createRes.json();

      const deleteRes = await app.request(
        `/api/workspaces/${workspaceId}/diff-comments/${created.id}`,
        { method: 'DELETE' }
      );

      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.success).toBe(true);
    });

    test('comment no longer appears in GET after deletion', async () => {
      const createRes = await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'ephemeral.ts', content: 'Will be gone' }),
      });
      const created = await createRes.json();

      await app.request(`/api/workspaces/${workspaceId}/diff-comments/${created.id}`, {
        method: 'DELETE',
      });

      const listRes = await app.request(`/api/workspaces/${workspaceId}/diff-comments`);
      const body = await listRes.json();
      expect(body).toHaveLength(0);
    });

    test('returns 404 when deleting a non-existent comment', async () => {
      const res = await app.request(
        `/api/workspaces/${workspaceId}/diff-comments/no-such-comment`,
        { method: 'DELETE' }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('returns 404 when deleting from a non-existent workspace', async () => {
      const res = await app.request(
        '/api/workspaces/no-such-ws/diff-comments/some-comment-id',
        { method: 'DELETE' }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('Comment persistence across re-fetches', () => {
    test('comments persist as long as the workspace exists', async () => {
      // Create several comments
      const comments = ['Comment A', 'Comment B', 'Comment C'];
      for (const content of comments) {
        await app.request(`/api/workspaces/${workspaceId}/diff-comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: 'persist.ts', content }),
        });
      }

      // Fetch them back multiple times
      for (let i = 0; i < 3; i++) {
        const res = await app.request(`/api/workspaces/${workspaceId}/diff-comments`);
        const body = await res.json();
        expect(body).toHaveLength(3);
      }
    });
  });
});
