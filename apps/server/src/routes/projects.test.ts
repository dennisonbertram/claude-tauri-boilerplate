import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createProject, createWorkspace } from '../db';
import { createProjectRouter } from './projects';
import { errorHandler } from '../middleware/error-handler';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

// Use the actual project root as a valid git repo for tests
const VALID_REPO_PATH = resolve(import.meta.dir, '../../../../');

describe('Project Routes', () => {
  let db: Database;
  let app: Hono;

  beforeEach(() => {
    db = createDb(':memory:');
    const projectRouter = createProjectRouter(db);
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/projects', projectRouter);
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/projects', () => {
    test('adds a valid git repo and returns 201', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBeDefined();
      expect(body.repoPath).toBe(VALID_REPO_PATH);
      expect(body.repoPathCanonical).toBeDefined();
      expect(body.defaultBranch).toBeDefined();
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    test('returns 409 for duplicate repo path', async () => {
      // Add once
      await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });

      // Add again
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('CONFLICT');
    });

    test('returns 400 for non-existent path', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: '/tmp/does-not-exist-at-all-12345' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for non-git directory', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: '/tmp' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for empty repoPath', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: '' }),
      });

      expect(res.status).toBe(400);
    });

    test('returns 400 for missing body', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects', () => {
    test('returns empty array initially', async () => {
      const res = await app.request('/api/projects');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    test('returns projects with health and workspace count', async () => {
      // Add a project
      await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });

      const res = await app.request('/api/projects');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].health).toBe('ok');
      expect(body[0].workspaceCount).toBe(0);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns project with health info', async () => {
      const createRes = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });
      const created = await createRes.json();

      const res = await app.request(`/api/projects/${created.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBe(created.id);
      expect(body.health).toBe('ok');
      expect(body.workspaceCount).toBe(0);
    });

    test('returns 404 for non-existent project', async () => {
      const res = await app.request('/api/projects/no-such-id');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/projects/:id', () => {
    test('updates project name', async () => {
      const createRes = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });
      const created = await createRes.json();

      const res = await app.request(`/api/projects/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Renamed Project' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('My Renamed Project');
    });

    test('updates setup command', async () => {
      const createRes = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });
      const created = await createRes.json();

      const res = await app.request(`/api/projects/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupCommand: 'pnpm install' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.setupCommand).toBe('pnpm install');
    });

    test('updates default branch', async () => {
      const createRes = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });
      const created = await createRes.json();

      const res = await app.request(`/api/projects/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultBranch: 'develop' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.defaultBranch).toBe('develop');
    });

    test('returns 404 for non-existent project', async () => {
      const res = await app.request('/api/projects/ghost-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nope' }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes a project and returns ok', async () => {
      const createRes = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: VALID_REPO_PATH }),
      });
      const created = await createRes.json();

      const delRes = await app.request(`/api/projects/${created.id}`, {
        method: 'DELETE',
      });
      expect(delRes.status).toBe(200);

      const body = await delRes.json();
      expect(body.ok).toBe(true);

      // Verify it's gone
      const listRes = await app.request('/api/projects');
      const projects = await listRes.json();
      expect(projects).toHaveLength(0);
    });

    test('deletes project worktree directories before removing the project', async () => {
      const projectId = crypto.randomUUID();
      const worktreePath = join(
        tmpdir(),
        `project-delete-worktree-${crypto.randomUUID()}`
      );

      createProject(
        db,
        projectId,
        'cleanup-project',
        VALID_REPO_PATH,
        VALID_REPO_PATH,
        'main'
      );
      mkdirSync(worktreePath, { recursive: true });
      createWorkspace(
        db,
        crypto.randomUUID(),
        projectId,
        'cleanup-workspace',
        'workspace/cleanup-workspace',
        worktreePath,
        worktreePath,
        'main'
      );

      expect(existsSync(worktreePath)).toBe(true);

      const delRes = await app.request(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      expect(delRes.status).toBe(200);

      expect(existsSync(worktreePath)).toBe(false);
    });

    test('returns 404 for non-existent project', async () => {
      const res = await app.request('/api/projects/ghost-id', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });
});
