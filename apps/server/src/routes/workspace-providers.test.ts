import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  createDb,
  createProject,
  createWorkspace,
  createWorkspaceProvider,
  createProvisioningRun,
} from '../db';
import { createWorkspaceProvidersRouter } from './workspace-providers';
import { createWorkspaceProvisioningRouter } from './workspace-provisioning';
import { errorHandler } from '../middleware/error-handler';

const FAKE_REPO = '/tmp/fake-repo-for-provider-tests';

let db: Database;
let app: Hono;
let projectId: string;
let workspaceId: string;

beforeEach(() => {
  db = createDb(':memory:');
  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/workspace-providers', createWorkspaceProvidersRouter(db));
  app.route('/api/workspaces', createWorkspaceProvisioningRouter(db));

  // Seed a project and workspace directly via DB helpers
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

// ─── Provider CRUD ─────────────────────────────────────────────────────────────

describe('POST /api/workspace-providers', () => {
  test('creates a provider and returns 201', async () => {
    const res = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'my-provider',
        command: '/usr/local/bin/provision.sh',
        projectId,
        args: ['--env', 'staging'],
        timeoutMs: 60000,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.name).toBe('my-provider');
    expect(body.command).toBe('/usr/local/bin/provision.sh');
    expect(body.projectId).toBe(projectId);
    expect(body.argsJson).toEqual(['--env', 'staging']);
    expect(body.timeoutMs).toBe(60000);
    expect(body.enabled).toBe(true);
    expect(body.type).toBe('script');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  test('returns 400 when name is missing', async () => {
    const res = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '/bin/provision.sh' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when command is missing', async () => {
    const res = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'my-provider' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/workspace-providers', () => {
  test('returns list of providers', async () => {
    // Create two providers
    await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'provider-a', command: '/bin/a.sh', projectId }),
    });
    await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'provider-b', command: '/bin/b.sh', projectId }),
    });

    const res = await app.request('/api/workspace-providers');
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  test('filters by projectId query param', async () => {
    // Create a second project so the foreign key constraint is satisfied
    const otherProject = createProject(
      db,
      crypto.randomUUID(),
      'other-project',
      '/tmp/other-repo',
      '/tmp/other-repo',
      'main'
    );
    const otherProjectId = otherProject.id;
    // Insert a provider for the other project via direct DB call
    createWorkspaceProvider(db, {
      id: crypto.randomUUID(),
      projectId: otherProjectId,
      name: 'other-project-provider',
      command: '/bin/other.sh',
    });
    await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'my-project-provider', command: '/bin/mine.sh', projectId }),
    });

    const res = await app.request(`/api/workspace-providers?projectId=${encodeURIComponent(projectId)}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.every((p: any) => p.projectId === projectId)).toBe(true);
  });
});

describe('GET /api/workspace-providers/:id', () => {
  test('returns a single provider', async () => {
    const createRes = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'single-test', command: '/bin/single.sh' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/api/workspace-providers/${created.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(created.id);
    expect(body.name).toBe('single-test');
  });

  test('returns 404 if provider does not exist', async () => {
    const res = await app.request('/api/workspace-providers/no-such-id');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/workspace-providers/:id', () => {
  test('updates fields and returns the updated provider', async () => {
    const createRes = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'patch-test', command: '/bin/original.sh', timeoutMs: 30000 }),
    });
    const created = await createRes.json() as any;

    const patchRes = await app.request(`/api/workspace-providers/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'patch-updated', timeoutMs: 90000, enabled: false }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json() as any;
    expect(body.name).toBe('patch-updated');
    expect(body.timeoutMs).toBe(90000);
    expect(body.enabled).toBe(false);
    expect(body.command).toBe('/bin/original.sh'); // unchanged
  });

  test('returns 404 for non-existent provider', async () => {
    const res = await app.request('/api/workspace-providers/ghost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/workspace-providers/:id', () => {
  test('deletes provider and returns 204', async () => {
    const createRes = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'delete-me', command: '/bin/delete.sh' }),
    });
    const created = await createRes.json() as any;

    const delRes = await app.request(`/api/workspace-providers/${created.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(204);

    // Confirm it's gone
    const getRes = await app.request(`/api/workspace-providers/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  test('returns 409 when active provisioning runs exist', async () => {
    const createRes = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'busy-provider', command: '/bin/busy.sh' }),
    });
    const provider = await createRes.json() as any;

    // Create a run in 'pending' status (active)
    createProvisioningRun(db, workspaceId, provider.id, {});

    const delRes = await app.request(`/api/workspace-providers/${provider.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(409);
    const body = await delRes.json() as any;
    expect(body.code).toBe('ACTIVE_RUNS_EXIST');
  });

  test('returns 404 for non-existent provider', async () => {
    const res = await app.request('/api/workspace-providers/ghost', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ─── Provisioning Runs ─────────────────────────────────────────────────────────

describe('GET /api/workspaces/:id/provisioning-runs', () => {
  test('returns empty list for a new workspace', async () => {
    const res = await app.request(`/api/workspaces/${workspaceId}/provisioning-runs`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body).toEqual([]);
  });

  test('returns 404 for a non-existent workspace', async () => {
    const res = await app.request('/api/workspaces/no-such-ws/provisioning-runs');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/workspaces/:id/provisioning-runs', () => {
  test('creates a pending run and returns 201', async () => {
    // Create provider first
    const providerRes = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'run-provider', command: '/bin/run.sh' }),
    });
    const provider = await providerRes.json() as any;

    const res = await app.request(`/api/workspaces/${workspaceId}/provisioning-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: provider.id, requestJson: { env: 'staging' } }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.workspaceId).toBe(workspaceId);
    expect(body.providerId).toBe(provider.id);
    expect(body.status).toBe('pending');
    expect(body.requestJson).toEqual({ env: 'staging' });
    expect(body.responseJson).toEqual({});
    expect(body.logsRedacted).toBe('');
    expect(body.startedAt).toBeNull();
    expect(body.finishedAt).toBeNull();
    expect(body.createdAt).toBeDefined();
  });

  test('returns 404 if workspace does not exist', async () => {
    const providerRes = await app.request('/api/workspace-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'for-missing-ws', command: '/bin/x.sh' }),
    });
    const provider = await providerRes.json() as any;

    const res = await app.request('/api/workspaces/no-such-workspace/provisioning-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: provider.id }),
    });

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 404 if provider does not exist', async () => {
    const res = await app.request(`/api/workspaces/${workspaceId}/provisioning-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'no-such-provider' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 400 if providerId is missing', async () => {
    const res = await app.request(`/api/workspaces/${workspaceId}/provisioning-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/workspaces/:id/provisioning-runs/:runId', () => {
  test('returns a single run', async () => {
    // Create provider and run directly
    const provider = createWorkspaceProvider(db, {
      id: crypto.randomUUID(),
      name: 'single-run-provider',
      command: '/bin/single-run.sh',
    });
    const run = createProvisioningRun(db, workspaceId, provider.id, { key: 'value' });

    const res = await app.request(`/api/workspaces/${workspaceId}/provisioning-runs/${run.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(run.id);
    expect(body.workspaceId).toBe(workspaceId);
    expect(body.providerId).toBe(provider.id);
    expect(body.status).toBe('pending');
    expect(body.requestJson).toEqual({ key: 'value' });
  });

  test('returns 404 for a non-existent run', async () => {
    const res = await app.request(`/api/workspaces/${workspaceId}/provisioning-runs/no-such-run`);
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 404 if run belongs to a different workspace', async () => {
    const provider = createWorkspaceProvider(db, {
      id: crypto.randomUUID(),
      name: 'cross-ws-provider',
      command: '/bin/cross.sh',
    });
    const run = createProvisioningRun(db, workspaceId, provider.id, {});

    const anotherWs = createWorkspace(
      db,
      crypto.randomUUID(),
      projectId,
      'another-ws',
      'feature/another',
      `${FAKE_REPO}/worktrees/another`,
      `${FAKE_REPO}/worktrees/another`,
      'main'
    );

    const res = await app.request(`/api/workspaces/${anotherWs.id}/provisioning-runs/${run.id}`);
    expect(res.status).toBe(404);
  });
});
