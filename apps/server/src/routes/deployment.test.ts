import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createProject, createWorkspace } from '../db';
import { createDeploymentRouter, createDeploymentSettingsRouter } from './deployment';
import { errorHandler } from '../middleware/error-handler';

const FAKE_REPO = '/tmp/fake-repo-for-deployment-tests';

let db: Database;
let app: Hono;
let projectId: string;
let workspaceId: string;

beforeEach(() => {
  db = createDb(':memory:');
  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/workspaces', createDeploymentRouter(db));
  app.route('/api/deployment-settings', createDeploymentSettingsRouter(db));

  // Seed a project and workspace via DB helpers
  const project = createProject(
    db,
    crypto.randomUUID(),
    'test-project',
    FAKE_REPO,
    FAKE_REPO,
    'main'
  );
  projectId = project.id;

  const ws = createWorkspace(
    db,
    crypto.randomUUID(),
    projectId,
    'test-workspace',
    'feature/test',
    `${FAKE_REPO}/worktrees/test`,
    `${FAKE_REPO}/worktrees/test`,
    'main'
  );
  workspaceId = ws.id;
});

afterEach(() => {
  db.close();
});

// ─── GET /deployment with no link ─────────────────────────────────────────────

describe('GET /api/workspaces/:id/deployment', () => {
  test('returns null deployment and isConfigured false when no link and no token', async () => {
    // Make sure no env token interferes
    const savedToken = process.env.RAILWAY_API_TOKEN;
    delete process.env.RAILWAY_API_TOKEN;

    const res = await app.request(`/api/workspaces/${workspaceId}/deployment`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deployment).toBeNull();
    expect(body.isConfigured).toBe(false);

    if (savedToken !== undefined) process.env.RAILWAY_API_TOKEN = savedToken;
  });

  test('returns 404 for unknown workspace', async () => {
    const res = await app.request(`/api/workspaces/does-not-exist/deployment`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });
});

// ─── PUT /deployment ───────────────────────────────────────────────────────────

describe('PUT /api/workspaces/:id/deployment', () => {
  test('creates link and returns deployment', async () => {
    const res = await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        railwayProjectId: 'proj-123',
        railwayServiceId: 'svc-456',
        railwayEnvironmentId: 'env-789',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deployment).toBeDefined();
    expect(body.deployment.workspaceId).toBe(workspaceId);
    expect(body.deployment.railwayProjectId).toBe('proj-123');
    expect(body.deployment.railwayServiceId).toBe('svc-456');
    expect(body.deployment.railwayEnvironmentId).toBe('env-789');
    expect(body.deployment.lastDeploymentStatus).toBeNull();
    expect(body.deployment.id).toBeDefined();
    expect(body.deployment.createdAt).toBeDefined();
  });

  test('upserts without error when called twice', async () => {
    const payload = {
      railwayProjectId: 'proj-1',
      railwayServiceId: 'svc-1',
      railwayEnvironmentId: 'env-1',
    };

    const res1 = await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(200);

    // Update with different IDs
    const res2 = await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        railwayProjectId: 'proj-2',
        railwayServiceId: 'svc-2',
        railwayEnvironmentId: 'env-2',
      }),
    });
    expect(res2.status).toBe(200);
    const body = await res2.json();
    expect(body.deployment.railwayProjectId).toBe('proj-2');
    expect(body.deployment.railwayServiceId).toBe('svc-2');
  });

  test('returns 400 if required fields are missing', async () => {
    const res = await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ railwayProjectId: 'proj-1' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown workspace', async () => {
    const res = await app.request(`/api/workspaces/does-not-exist/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        railwayProjectId: 'p',
        railwayServiceId: 's',
        railwayEnvironmentId: 'e',
      }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /deployment ────────────────────────────────────────────────────────

describe('DELETE /api/workspaces/:id/deployment', () => {
  test('returns 204 after unlinking', async () => {
    // First link
    await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        railwayProjectId: 'proj-1',
        railwayServiceId: 'svc-1',
        railwayEnvironmentId: 'env-1',
      }),
    });

    const res = await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);

    // Confirm gone
    const getRes = await app.request(`/api/workspaces/${workspaceId}/deployment`);
    const body = await getRes.json();
    expect(body.deployment).toBeNull();
  });

  test('returns 404 for unknown workspace', async () => {
    const res = await app.request(`/api/workspaces/does-not-exist/deployment`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });
});

// ─── POST /deployment/refresh with no token ────────────────────────────────────

describe('POST /api/workspaces/:id/deployment/refresh', () => {
  test('returns 400 when no token configured', async () => {
    const savedToken = process.env.RAILWAY_API_TOKEN;
    delete process.env.RAILWAY_API_TOKEN;

    // Link first
    await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        railwayProjectId: 'proj-1',
        railwayServiceId: 'svc-1',
        railwayEnvironmentId: 'env-1',
      }),
    });

    const res = await app.request(`/api/workspaces/${workspaceId}/deployment/refresh`, {
      method: 'POST',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('TOKEN_NOT_CONFIGURED');

    if (savedToken !== undefined) process.env.RAILWAY_API_TOKEN = savedToken;
  });

  test('returns 400 when no link exists', async () => {
    const savedToken = process.env.RAILWAY_API_TOKEN;
    delete process.env.RAILWAY_API_TOKEN;

    // Set a token but no link
    const { setRailwayToken } = await import('../db');
    setRailwayToken(db, 'test-token');

    const res = await app.request(`/api/workspaces/${workspaceId}/deployment/refresh`, {
      method: 'POST',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('NOT_LINKED');

    if (savedToken !== undefined) process.env.RAILWAY_API_TOKEN = savedToken;
  });

  test('returns 404 for unknown workspace', async () => {
    const res = await app.request(`/api/workspaces/does-not-exist/deployment/refresh`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });
});

// ─── GET /deployment/logs ──────────────────────────────────────────────────────

describe('GET /api/workspaces/:id/deployment/logs', () => {
  test('returns 400 when no token configured', async () => {
    const savedToken = process.env.RAILWAY_API_TOKEN;
    delete process.env.RAILWAY_API_TOKEN;

    // Link first
    await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        railwayProjectId: 'proj-1',
        railwayServiceId: 'svc-1',
        railwayEnvironmentId: 'env-1',
      }),
    });

    const res = await app.request(`/api/workspaces/${workspaceId}/deployment/logs`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('TOKEN_NOT_CONFIGURED');

    if (savedToken !== undefined) process.env.RAILWAY_API_TOKEN = savedToken;
  });

  test('returns empty logs when linked but no lastDeploymentId', async () => {
    const { setRailwayToken } = await import('../db');
    setRailwayToken(db, 'test-token');

    // Link workspace
    await app.request(`/api/workspaces/${workspaceId}/deployment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        railwayProjectId: 'proj-1',
        railwayServiceId: 'svc-1',
        railwayEnvironmentId: 'env-1',
      }),
    });

    const res = await app.request(`/api/workspaces/${workspaceId}/deployment/logs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toEqual([]);
    expect(body.deploymentId).toBeNull();
    expect(body.total).toBe(0);
  });

  test('returns 404 for unknown workspace', async () => {
    const res = await app.request(`/api/workspaces/does-not-exist/deployment/logs`);
    expect(res.status).toBe(404);
  });
});

// ─── Deployment Settings Token ─────────────────────────────────────────────────

describe('POST /api/deployment-settings/token', () => {
  test('stores token and returns ok', async () => {
    const res = await app.request('/api/deployment-settings/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'my-railway-token' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('returns 400 if token is missing', async () => {
    const res = await app.request('/api/deployment-settings/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/deployment-settings/token', () => {
  test('returns configured false when no token stored', async () => {
    const res = await app.request('/api/deployment-settings/token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
  });

  test('returns configured true after setting token', async () => {
    await app.request('/api/deployment-settings/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'my-secret-token' }),
    });

    const res = await app.request('/api/deployment-settings/token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    // Must NOT return the actual token
    expect(body.token).toBeUndefined();
  });
});
