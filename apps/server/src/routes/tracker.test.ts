import { describe, it, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createTrackerRouter } from './tracker';
import { SCHEMA } from '../db/schema';
import { migrateTrackerTables } from '../db/migrations';
import { errorHandler } from '../middleware/error-handler';

/** Insert a workspace project row so foreign keys are satisfied. */
function seedProject(db: Database, id: string, name: string) {
  db.prepare(
    `INSERT INTO projects (id, name, repo_path, repo_path_canonical) VALUES (?, ?, ?, ?)`,
  ).run(id, name, `/tmp/${id}`, `/tmp/${id}`);
}

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  migrateTrackerTables(db);
  return db;
}

function createTestApp(db: Database) {
  const app = new Hono();
  app.onError(errorHandler);
  app.route('/api/tracker', createTrackerRouter(db));
  return app;
}

describe('GET /api/tracker/projects/by-project/:projectId', () => {
  let db: Database;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
  });

  it('returns 404 when no tracker project is linked to the workspace project', async () => {
    const res = await app.request('/api/tracker/projects/by-project/nonexistent-project-id');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns the tracker project when one is linked', async () => {
    // Seed a workspace project so FK is satisfied
    seedProject(db, 'ws-project-123', 'WS Project');

    // Create a tracker project linked to it
    const createRes = await app.request('/api/tracker/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Project',
        slug: 'test-project',
        projectId: 'ws-project-123',
      }),
    });
    expect(createRes.status).toBe(201);

    // Now look it up by workspace projectId
    const res = await app.request('/api/tracker/projects/by-project/ws-project-123');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Test Project');
    expect(body.projectId).toBe('ws-project-123');
    expect(body.statuses).toBeDefined();
    expect(body.labels).toBeDefined();
  });
});

describe('POST /api/tracker/projects/ensure', () => {
  let db: Database;
  let app: ReturnType<typeof createTestApp>;
  const PROJECT_ID = 'wp-abc-123';

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    seedProject(db, PROJECT_ID, 'My Workspace Project');
  });

  it('creates a tracker project linked to workspace project', async () => {
    const res = await app.request('/api/tracker/projects/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        name: 'My Workspace',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('My Workspace');
    expect(body.projectId).toBe(PROJECT_ID);
    expect(body.slug).toBe('my-workspace');
    expect(body.statuses).toBeDefined();
    expect(body.statuses.length).toBeGreaterThan(0);
  });

  it('returns existing project on second call (idempotent)', async () => {
    // First call creates
    const res1 = await app.request('/api/tracker/projects/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        name: 'My Workspace',
      }),
    });
    expect(res1.status).toBe(201);
    const body1 = await res1.json();

    // Second call returns existing
    const res2 = await app.request('/api/tracker/projects/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        name: 'My Workspace',
      }),
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();

    expect(body2.id).toBe(body1.id);
    expect(body2.name).toBe('My Workspace');
  });

  it('handles slug collision by appending projectId prefix', async () => {
    // Create a tracker project with slug "my-workspace" (no FK link)
    await app.request('/api/tracker/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Existing',
        slug: 'my-workspace',
      }),
    });

    // Seed another workspace project for the ensure call
    seedProject(db, 'wp-xyz-789', 'Another WS Project');

    // Now ensure with a name that would generate the same slug
    const res = await app.request('/api/tracker/projects/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'wp-xyz-789',
        name: 'My Workspace',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe('my-workspace-wp-xyz');
  });

  it('returns 400 for invalid body', async () => {
    const res = await app.request('/api/tracker/projects/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
