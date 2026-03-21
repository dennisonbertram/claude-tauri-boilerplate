import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createProject } from '../db';
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
  tempDir = join(tmpdir(), `workspace-review-test-${Date.now()}`);
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

describe('Workspace Review API', () => {
  describe('GET /api/workspaces/:id/review', () => {
    test('lazily creates a review for a new workspace', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.workspace_id).toBe(workspaceId);
      expect(body.filter_mode).toBe('all');
      expect(body.view_mode).toBe('unified');
      expect(body.files).toEqual([]);
      expect(body.comments).toEqual([]);
      expect(body.todos).toEqual([]);
      expect(body.merge_readiness).toBe('ready');
    });

    test('returns 404 for unknown workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-ws/review');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('calling GET twice returns the same review id (lazy idempotent)', async () => {
      const res1 = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body1 = await res1.json();

      const res2 = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body2 = await res2.json();

      expect(body1.id).toBe(body2.id);
    });

    test('returns needs_review when unreviewed files exist', async () => {
      // First create a review row and then upsert a file
      const reviewRes = await app.request(`/api/workspaces/${workspaceId}/review`);
      await reviewRes.json();

      await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/index.ts', review_state: 'unreviewed' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.merge_readiness).toBe('needs_review');
    });

    test('returns ready when all files reviewed and no open todos', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/index.ts', review_state: 'reviewed' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.merge_readiness).toBe('ready');
    });
  });

  describe('PUT /api/workspaces/:id/review', () => {
    test('persists selection and view settings', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_from_ref: 'main',
          selected_to_ref: 'feature/my-branch',
          filter_mode: 'unreviewed',
          view_mode: 'side-by-side',
        }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.selected_from_ref).toBe('main');
      expect(body.selected_to_ref).toBe('feature/my-branch');
      expect(body.filter_mode).toBe('unreviewed');
      expect(body.view_mode).toBe('side-by-side');
    });

    test('persists partial update without clearing other fields', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_mode: 'reviewed' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.filter_mode).toBe('reviewed');
      expect(body.view_mode).toBe('unified'); // unchanged default
    });

    test('returns 400 for invalid filter_mode', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_mode: 'invalid' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for unknown workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-ws/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_mode: 'all' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/workspaces/:id/review/files', () => {
    test('upserts file review state', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/main.ts', review_state: 'reviewed' }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.file_path).toBe('src/main.ts');
      expect(body.review_state).toBe('reviewed');
    });

    test('upserts the same file a second time updates review_state', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/main.ts', review_state: 'unreviewed' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/main.ts', review_state: 'reviewed' }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.review_state).toBe('reviewed');

      // There should still be only one entry for this file
      const reviewRes = await app.request(`/api/workspaces/${workspaceId}/review`);
      const review = await reviewRes.json();
      const filesForPath = review.files.filter((f: { file_path: string }) => f.file_path === 'src/main.ts');
      expect(filesForPath).toHaveLength(1);
    });

    test('returns 400 for missing file_path', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_state: 'reviewed' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for unknown workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-ws/review/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'test.ts', review_state: 'reviewed' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Comment CRUD', () => {
    test('creates a comment and returns 201', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: 'src/index.ts',
          new_line: 42,
          markdown: 'This could be simplified.',
        }),
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.file_path).toBe('src/index.ts');
      expect(body.new_line).toBe(42);
      expect(body.markdown).toBe('This could be simplified.');
      expect(body.status).toBe('open');
    });

    test('GET /review/comments returns created comments', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/a.ts', markdown: 'Comment A' }),
      });
      await app.request(`/api/workspaces/${workspaceId}/review/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/b.ts', markdown: 'Comment B' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review/comments`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
    });

    test('PATCH comment updates status to resolved', async () => {
      const createRes = await app.request(`/api/workspaces/${workspaceId}/review/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/index.ts', markdown: 'Initial note' }),
      });
      const created = await createRes.json();

      const patchRes = await app.request(
        `/api/workspaces/${workspaceId}/review/comments/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' }),
        }
      );
      expect(patchRes.status).toBe(200);
      const updated = await patchRes.json();
      expect(updated.status).toBe('resolved');
    });

    test('PATCH comment updates markdown text', async () => {
      const createRes = await app.request(`/api/workspaces/${workspaceId}/review/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/index.ts', markdown: 'Old text' }),
      });
      const created = await createRes.json();

      const patchRes = await app.request(
        `/api/workspaces/${workspaceId}/review/comments/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: 'Updated text' }),
        }
      );
      expect(patchRes.status).toBe(200);
      const updated = await patchRes.json();
      expect(updated.markdown).toBe('Updated text');
    });

    test('DELETE comment removes it', async () => {
      const createRes = await app.request(`/api/workspaces/${workspaceId}/review/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/index.ts', markdown: 'To delete' }),
      });
      const created = await createRes.json();

      const deleteRes = await app.request(
        `/api/workspaces/${workspaceId}/review/comments/${created.id}`,
        { method: 'DELETE' }
      );
      expect(deleteRes.status).toBe(200);
      const body = await deleteRes.json();
      expect(body.ok).toBe(true);

      // Verify it's gone
      const listRes = await app.request(`/api/workspaces/${workspaceId}/review/comments`);
      const list = await listRes.json();
      expect(list.find((c: { id: string }) => c.id === created.id)).toBeUndefined();
    });

    test('DELETE nonexistent comment returns 404', async () => {
      const res = await app.request(
        `/api/workspaces/${workspaceId}/review/comments/no-such-id`,
        { method: 'DELETE' }
      );
      expect(res.status).toBe(404);
    });

    test('returns 400 when markdown is missing', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/index.ts' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('TODO CRUD', () => {
    test('creates a todo and returns 201', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Fix the null check', source: 'local' }),
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.body).toBe('Fix the null check');
      expect(body.status).toBe('open');
      expect(body.source).toBe('local');
    });

    test('GET /review/todos returns created todos', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Todo A' }),
      });
      await app.request(`/api/workspaces/${workspaceId}/review/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Todo B' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review/todos`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
    });

    test('PATCH todo updates status to done', async () => {
      const createRes = await app.request(`/api/workspaces/${workspaceId}/review/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Complete this' }),
      });
      const created = await createRes.json();

      const patchRes = await app.request(
        `/api/workspaces/${workspaceId}/review/todos/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'done' }),
        }
      );
      expect(patchRes.status).toBe(200);
      const updated = await patchRes.json();
      expect(updated.status).toBe('done');
    });

    test('todo with source=check blocks merge readiness', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'CI failing', source: 'check' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.merge_readiness).toBe('blocked');
    });

    test('blocked state clears when check todo is marked done', async () => {
      const createRes = await app.request(`/api/workspaces/${workspaceId}/review/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'CI failing', source: 'check' }),
      });
      const todo = await createRes.json();

      // Mark done
      await app.request(
        `/api/workspaces/${workspaceId}/review/todos/${todo.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'done' }),
        }
      );

      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.merge_readiness).toBe('ready');
    });

    test('returns 400 when body is missing', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'local' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for unknown workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-ws/review/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Test' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('merge_readiness integration', () => {
    test('ready: no files, no todos', async () => {
      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.merge_readiness).toBe('ready');
    });

    test('needs_review: unreviewed file present', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/x.ts', review_state: 'unreviewed' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.merge_readiness).toBe('needs_review');
    });

    test('ready: all files reviewed', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/x.ts', review_state: 'reviewed' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.merge_readiness).toBe('ready');
    });

    test('blocked: open check todo takes precedence over unreviewed files', async () => {
      await app.request(`/api/workspaces/${workspaceId}/review/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: 'src/x.ts', review_state: 'unreviewed' }),
      });
      await app.request(`/api/workspaces/${workspaceId}/review/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'CI broken', source: 'check' }),
      });

      const res = await app.request(`/api/workspaces/${workspaceId}/review`);
      const body = await res.json();
      expect(body.merge_readiness).toBe('blocked');
    });
  });
});
