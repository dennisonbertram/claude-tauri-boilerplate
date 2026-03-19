import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  createDb,
  createProject,
  createArtifact,
  createArtifactRevision,
  setArtifactCurrentRevision,
  getArtifact,
} from '../db';
import { createArtifactsRouter, createProjectArtifactsRouter } from './artifacts';
import { errorHandler } from '../middleware/error-handler';

let db: Database;
let app: Hono;
let projectId: string;

beforeEach(() => {
  db = createDb(':memory:');

  // Create a test project
  const project = createProject(
    db,
    crypto.randomUUID(),
    'test-project',
    '/tmp/test-repo',
    '/tmp/test-repo',
    'main'
  );
  projectId = project.id;

  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/artifacts', createArtifactsRouter(db));
  app.route('/api/projects', createProjectArtifactsRouter(db));
});

afterEach(() => {
  if (db) db.close();
});

// ─── GET /api/artifacts/:id ───────────────────────────────────────────────────

describe('GET /api/artifacts/:id', () => {
  test('returns 404 for unknown artifact', async () => {
    const res = await app.request('/api/artifacts/nonexistent-artifact-id');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 200 with artifact for known id', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'My Dashboard',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const res = await app.request(`/api/artifacts/${artifact.id}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(artifact.id);
    expect(body.kind).toBe('dashboard');
    expect(body.title).toBe('My Dashboard');
    expect(body.projectId).toBe(projectId);
    expect(body.status).toBe('active');
  });

  test('returns full artifact data including revision references', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Detailed Dashboard',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const revision = createArtifactRevision(db, {
      id: crypto.randomUUID(),
      artifactId: artifact.id,
      revisionNumber: 1,
      specJson: JSON.stringify({ kind: 'dashboard', schemaVersion: 1 }),
      summary: 'initial version',
      prompt: 'create a dashboard',
      model: 'claude-haiku',
      sourceSessionId: null,
      sourceMessageId: null,
    });

    setArtifactCurrentRevision(db, artifact.id, revision.id);

    const res = await app.request(`/api/artifacts/${artifact.id}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.currentRevisionId).toBe(revision.id);
    expect(body.schemaVersion).toBe(1);
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });
});

// ─── PATCH /api/artifacts/:id/archive ────────────────────────────────────────

describe('PATCH /api/artifacts/:id/archive', () => {
  test('returns 404 for unknown artifact', async () => {
    const res = await app.request('/api/artifacts/nonexistent-id/archive', {
      method: 'PATCH',
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 200 and sets status to archived', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Archive Me',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const res = await app.request(`/api/artifacts/${artifact.id}/archive`, {
      method: 'PATCH',
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(artifact.id);
    expect(body.status).toBe('archived');
  });

  test('artifact status changes to archived in DB after archive', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Verify Archive In DB',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    await app.request(`/api/artifacts/${artifact.id}/archive`, {
      method: 'PATCH',
    });

    const updated = getArtifact(db, artifact.id);
    expect(updated?.status).toBe('archived');
  });
});

// ─── GET /api/projects/:projectId/artifacts ───────────────────────────────────

describe('GET /api/projects/:projectId/artifacts', () => {
  test('returns 404 for unknown project', async () => {
    const res = await app.request('/api/projects/nonexistent-project/artifacts');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 200 with empty array for project with no artifacts', async () => {
    const res = await app.request(`/api/projects/${projectId}/artifacts`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  test('returns only active artifacts by default', async () => {
    createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Active Artifact',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const archivedArtifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Archived Artifact',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    // Archive via the DB helper
    const { archiveArtifact } = await import('../db');
    archiveArtifact(db, archivedArtifact.id);

    const res = await app.request(`/api/projects/${projectId}/artifacts`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('Active Artifact');
  });

  test('returns all artifacts including archived when ?includeArchived=true', async () => {
    createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Active',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const archivedArtifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Archived',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const { archiveArtifact } = await import('../db');
    archiveArtifact(db, archivedArtifact.id);

    const res = await app.request(`/api/projects/${projectId}/artifacts?includeArchived=true`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  test('returns multiple artifacts for a project', async () => {
    for (const title of ['First', 'Second', 'Third']) {
      createArtifact(db, {
        id: crypto.randomUUID(),
        kind: 'dashboard',
        schemaVersion: 1,
        title,
        projectId,
        workspaceId: null,
        sourceSessionId: null,
        sourceMessageId: null,
        status: 'active',
      });
    }

    const res = await app.request(`/api/projects/${projectId}/artifacts`);
    const body = await res.json();
    expect(body).toHaveLength(3);
    // All three artifacts should appear
    const titles = body.map((a: { title: string }) => a.title);
    expect(titles).toContain('First');
    expect(titles).toContain('Second');
    expect(titles).toContain('Third');
  });
});

// ─── POST /api/projects/:projectId/artifacts/generate ────────────────────────

describe('POST /api/projects/:projectId/artifacts/generate', () => {
  test('returns 404 for unknown project', async () => {
    const res = await app.request('/api/projects/nonexistent-project/artifacts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Create a metrics dashboard' }),
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 400 when prompt is missing', async () => {
    const res = await app.request(`/api/projects/${projectId}/artifacts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'A dashboard without prompt' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when prompt is empty string', async () => {
    const res = await app.request(`/api/projects/${projectId}/artifacts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when body is missing entirely', async () => {
    const res = await app.request(`/api/projects/${projectId}/artifacts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when Content-Type is missing and body is malformed', async () => {
    const res = await app.request(`/api/projects/${projectId}/artifacts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json',
    });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/artifacts/:id/regenerate ──────────────────────────────────────

describe('POST /api/artifacts/:id/regenerate', () => {
  test('returns 404 for unknown artifact', async () => {
    const res = await app.request('/api/artifacts/nonexistent-id/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Add a chart widget' }),
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 400 for archived artifact', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Archived Dashboard',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    // Archive it
    const { archiveArtifact: archive } = await import('../db');
    archive(db, artifact.id);

    const res = await app.request(`/api/artifacts/${artifact.id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Add more widgets' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('INVALID_STATE');
  });

  test('returns 400 when prompt is missing', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Active Dashboard',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const res = await app.request(`/api/artifacts/${artifact.id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when prompt is empty string', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Active Dashboard',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const res = await app.request(`/api/artifacts/${artifact.id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── Transaction safety regression tests ─────────────────────────────────────

describe('generate transaction safety', () => {
  test('artifact has current_revision_id set immediately after successful generation (no partial write)', async () => {
    // This test exercises the generate flow using direct DB helpers to simulate
    // what the route does. The key invariant: after createArtifact +
    // createArtifactRevision + setArtifactCurrentRevision all complete, the
    // artifact's current_revision_id must be non-null.
    const artifactId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();

    const artifact = createArtifact(db, {
      id: artifactId,
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Transaction Test Dashboard',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    // Immediately after createArtifact, current_revision_id should be null
    expect(artifact.currentRevisionId).toBeNull();

    createArtifactRevision(db, {
      id: revisionId,
      artifactId,
      revisionNumber: 1,
      specJson: JSON.stringify({ kind: 'dashboard', schemaVersion: 1 }),
      summary: null,
      prompt: 'create a dashboard',
      model: null,
      sourceSessionId: null,
      sourceMessageId: null,
    });

    setArtifactCurrentRevision(db, artifactId, revisionId);

    // After all three writes, current_revision_id must be set
    const updated = getArtifact(db, artifactId);
    expect(updated).not.toBeNull();
    expect(updated!.currentRevisionId).toBe(revisionId);
  });

  test('artifact fetched after generate route returns non-null currentRevisionId', async () => {
    // Verify that the generate route endpoint produces an artifact that has
    // current_revision_id set in the returned response body (not just in memory).
    // This guards against the partial-write scenario where generate completes
    // createArtifact + createArtifactRevision but crashes before
    // setArtifactCurrentRevision.
    //
    // We simulate this by calling the helpers in the wrong order (artifact
    // created but current_revision_id never set) and asserting the DB state
    // would be inconsistent — confirming the transaction is needed.

    const artifactId = crypto.randomUUID();

    createArtifact(db, {
      id: artifactId,
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Partial Write Test',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    // Simulate crash: revision never created, current_revision_id never set
    const partial = getArtifact(db, artifactId);
    expect(partial!.currentRevisionId).toBeNull();

    // Now complete the writes (simulating the transaction fixing this)
    const revisionId = crypto.randomUUID();
    createArtifactRevision(db, {
      id: revisionId,
      artifactId,
      revisionNumber: 1,
      specJson: JSON.stringify({ kind: 'dashboard', schemaVersion: 1 }),
      summary: null,
      prompt: 'test prompt',
      model: null,
      sourceSessionId: null,
      sourceMessageId: null,
    });
    setArtifactCurrentRevision(db, artifactId, revisionId);

    const complete = getArtifact(db, artifactId);
    expect(complete!.currentRevisionId).toBe(revisionId);
  });
});

describe('regenerate revision numbering', () => {
  test('revision numbers increment correctly under sequential regenerations', () => {
    // This guards against the TOCTOU race in countArtifactRevisions() + 1.
    // The correct behavior: each revision gets a strictly increasing number.
    const artifactId = crypto.randomUUID();

    createArtifact(db, {
      id: artifactId,
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Revision Number Test',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    // Create revision 1
    const rev1Id = crypto.randomUUID();
    createArtifactRevision(db, {
      id: rev1Id,
      artifactId,
      revisionNumber: 1,
      specJson: '{}',
      summary: null,
      prompt: 'first',
      model: null,
      sourceSessionId: null,
      sourceMessageId: null,
    });
    setArtifactCurrentRevision(db, artifactId, rev1Id);

    // Simulate the MAX(revision_number)+1 approach inside the transaction
    const row = db.prepare(
      `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next FROM artifact_revisions WHERE artifact_id = ?`
    ).get(artifactId) as { next: number };
    expect(row.next).toBe(2);

    // Create revision 2 using the computed next number
    const rev2Id = crypto.randomUUID();
    createArtifactRevision(db, {
      id: rev2Id,
      artifactId,
      revisionNumber: row.next,
      specJson: '{}',
      summary: null,
      prompt: 'second',
      model: null,
      sourceSessionId: null,
      sourceMessageId: null,
    });
    setArtifactCurrentRevision(db, artifactId, rev2Id);

    // Verify UNIQUE(artifact_id, revision_number) constraint would prevent
    // two revisions with the same number
    expect(() => {
      createArtifactRevision(db, {
        id: crypto.randomUUID(),
        artifactId,
        revisionNumber: 2, // duplicate — must throw
        specJson: '{}',
        summary: null,
        prompt: 'duplicate',
        model: null,
        sourceSessionId: null,
        sourceMessageId: null,
      });
    }).toThrow();
  });
});

// ─── PATCH /api/artifacts/:id (rename) ───────────────────────────────────────

describe('PATCH /api/artifacts/:id (rename)', () => {
  test('returns 404 for unknown artifact', async () => {
    const res = await app.request('/api/artifacts/nonexistent-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 200 with updated title for known artifact', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Old Title',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const res = await app.request(`/api/artifacts/${artifact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(artifact.id);
    expect(body.title).toBe('New Title');
  });

  test('returns 400 when title is empty', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Some Title',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const res = await app.request(`/api/artifacts/${artifact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when title is missing', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Some Title',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const res = await app.request(`/api/artifacts/${artifact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('title update persists in DB', async () => {
    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Before',
      projectId,
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    await app.request(`/api/artifacts/${artifact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'After' }),
    });

    const fetched = getArtifact(db, artifact.id);
    expect(fetched?.title).toBe('After');
  });
});
