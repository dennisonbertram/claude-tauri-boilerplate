import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  createDb,
  createProject,
  createSession,
  getWorkspace,
  linkSessionToWorkspace,
} from '../db';
import { createWorkspaceRouter, createFlatWorkspaceRouter } from './workspaces';
import { createProjectRouter } from './projects';
import { errorHandler } from '../middleware/error-handler';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir: string;
let repoPath: string;
let db: Database;
let app: Hono;
let projectId: string;

beforeAll(async () => {
  // Create a real temp git repo
  tempDir = join(tmpdir(), `workspace-test-${Date.now()}`);
  repoPath = join(tempDir, 'repo');
  process.env.CLAUDE_TAURI_WORKTREE_BASE = join(tempDir, 'worktrees');
  mkdirSync(repoPath, { recursive: true });

  // Initialize git repo with an initial commit so branches work
  const gitInit = Bun.spawnSync(['git', 'init'], { cwd: repoPath });
  if (gitInit.exitCode !== 0) throw new Error('git init failed');

  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: repoPath });
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoPath });

  // Create an initial commit (needed for worktree creation)
  const initFile = join(repoPath, 'README.md');
  await Bun.write(initFile, '# Test');
  Bun.spawnSync(['git', 'add', '.'], { cwd: repoPath });
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: repoPath });
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

  // Register the project in the DB using the real repo
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

  // Build app with both routers
  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/projects', createProjectRouter(db));
  app.route('/api/projects', createWorkspaceRouter(db));
  app.route('/api/workspaces', createFlatWorkspaceRouter(db));
});

describe('Workspace Routes', () => {
  describe('POST /api/projects/:projectId/workspaces', () => {
    test('creates a workspace and returns 201', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'my-feature' }),
        }
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBe('my-feature');
      expect(body.branch).toBe('workspace/my-feature');
      expect(body.projectId).toBe(projectId);
      expect(body.status).toBe('ready');
      expect(body.baseBranch).toBe('main');
      expect(body.worktreePath).toBeDefined();
      expect(body.createdAt).toBeDefined();

      // Verify worktree actually exists on disk
      expect(existsSync(body.worktreePath)).toBe(true);
    });

    test('returns 409 for duplicate workspace name', async () => {
      // Create first workspace
      await app.request(`/api/projects/${projectId}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'dupe-test' }),
      });

      // Try to create again with same name
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'dupe-test' }),
        }
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('CONFLICT');
      expect(body.error).toBe("A workspace named 'dupe-test' already exists in this project");
      expect(body.error).not.toContain('workspace/');
    });

    test('returns 400 for invalid (empty) name', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '' }),
        }
      );

      expect(res.status).toBe(400);
    });

    test('returns 400 for name that sanitizes to empty', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '!!!' }),
        }
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for non-existent project', async () => {
      const res = await app.request(
        '/api/projects/no-such-project/workspaces',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'test' }),
        }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('accepts custom baseBranch', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'custom-base', baseBranch: 'main' }),
        }
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.baseBranch).toBe('main');
    });

    test('accepts linear issue metadata on create', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'issue-workspace',
            linearIssue: {
              id: 'ISS-404',
              title: 'Fix dashboard crash',
              summary: 'Investigate crash in workspace panel',
              url: 'https://linear.app/org/issue/ISS-404',
            },
          }),
        }
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.linearIssueId).toBe('ISS-404');
      expect(body.linearIssueTitle).toBe('Fix dashboard crash');
      expect(body.linearIssueSummary).toBe('Investigate crash in workspace panel');
      expect(body.linearIssueUrl).toBe('https://linear.app/org/issue/ISS-404');
    });

    test('returns 400 for incomplete linear issue payload', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'bad-issue-workspace',
            linearIssue: {
              title: 'Missing ID',
            },
          }),
        }
      );

      expect(res.status).toBe(400);
    });

    test('returns 400 for invalid linear issue URL', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'bad-issue-url',
            linearIssue: {
              id: 'ISS-405',
              title: 'Issue with bad url',
              url: 'not-a-valid-url',
            },
          }),
        }
      );

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/workspaces', () => {
    test('returns empty array initially', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    test('returns workspaces after creation', async () => {
      // Create a workspace
      await app.request(`/api/projects/${projectId}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'list-test' }),
      });

      const res = await app.request(
        `/api/projects/${projectId}/workspaces`
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('list-test');
    });

    test('returns 404 for non-existent project', async () => {
      const res = await app.request(
        '/api/projects/no-such-project/workspaces'
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/workspaces/:id', () => {
    test('returns workspace by id', async () => {
      const createRes = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'get-test' }),
        }
      );
      const created = await createRes.json();

      const res = await app.request(`/api/workspaces/${created.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBe(created.id);
      expect(body.name).toBe('get-test');
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-id');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/workspaces/:id/session', () => {
    test('returns latest linked workspace session', async () => {
      const createRes = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'workspace-session-test' }),
        }
      );
      const workspace = await createRes.json();

      const oldSession = createSession(db, 'session-old');
      const newSession = createSession(db, 'session-new');

      linkSessionToWorkspace(db, oldSession.id, workspace.id);
      db.prepare("UPDATE sessions SET updated_at = datetime('now', '-1 day') WHERE id = ?").run(oldSession.id);
      linkSessionToWorkspace(db, newSession.id, workspace.id);

      const res = await app.request(`/api/workspaces/${workspace.id}/session`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual(expect.objectContaining({ id: newSession.id }));
    });

    test('returns null for workspace with no linked session', async () => {
      const createRes = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'workspace-no-session' }),
        }
      );
      const workspace = await createRes.json();

      const res = await app.request(`/api/workspaces/${workspace.id}/session`);
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-workspace/session');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/workspaces/:id', () => {
    test('deletes a workspace and removes worktree from disk', async () => {
      const createRes = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'delete-test' }),
        }
      );
      const created = await createRes.json();
      expect(existsSync(created.worktreePath)).toBe(true);

      const delRes = await app.request(
        `/api/workspaces/${created.id}`,
        { method: 'DELETE' }
      );
      expect(delRes.status).toBe(200);

      const body = await delRes.json();
      expect(body.ok).toBe(true);

      // Verify worktree removed from disk
      expect(existsSync(created.worktreePath)).toBe(false);

      // Verify workspace deleted from DB
      const getRes = await app.request(`/api/workspaces/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    test('force deletes a workspace', async () => {
      const createRes = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'force-del' }),
        }
      );
      const created = await createRes.json();

      const delRes = await app.request(
        `/api/workspaces/${created.id}?force=true`,
        { method: 'DELETE' }
      );
      expect(delRes.status).toBe(200);

      // Verify gone
      const getRes = await app.request(`/api/workspaces/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-id', {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('removes workspace branches so names can be reused after project recreate', async () => {
      const workspaceName = 'recreate-workspace-name';
      const workspaceBranch = `workspace/${workspaceName}`;

      const createWorkspaceRes = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: workspaceName }),
        }
      );
      expect(createWorkspaceRes.status).toBe(201);
      const createdWorkspace = await createWorkspaceRes.json();
      expect(createdWorkspace.branch).toBe(workspaceBranch);
      expect(existsSync(createdWorkspace.worktreePath)).toBe(true);

      const delProjectRes = await app.request(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      expect(delProjectRes.status).toBe(200);

      const branchListAfterDelete = Bun.spawnSync(['git', 'branch', '--list', workspaceBranch], { cwd: repoPath });
      expect(branchListAfterDelete.exitCode).toBe(0);
      expect(branchListAfterDelete.stdout.toString().trim()).toBe('');

      const recreateProjectRes = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath }),
      });
      expect(recreateProjectRes.status).toBe(201);
      const recreatedProject = await recreateProjectRes.json();

      const recreateWorkspaceRes = await app.request(
        `/api/projects/${recreatedProject.id}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: workspaceName }),
        }
      );
      expect(recreateWorkspaceRes.status).toBe(201);
      const recreatedWorkspace = await recreateWorkspaceRes.json();
      expect(recreatedWorkspace.branch).toBe(workspaceBranch);
      expect(recreatedWorkspace.name).toBe(workspaceName);
    });
  });

  describe('workspace status transitions', () => {
    test('workspace goes through creating -> ready on successful creation', async () => {
      const res = await app.request(
        `/api/projects/${projectId}/workspaces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'status-test' }),
        }
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.status).toBe('ready');
    });
  });
});
