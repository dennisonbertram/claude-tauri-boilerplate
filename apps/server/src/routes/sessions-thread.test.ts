import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  createDb,
  createSession,
  addMessage,
  createProject,
  createArtifact,
  createArtifactRevision,
  setArtifactCurrentRevision,
} from '../db';
import { createSessionThreadRouter } from './sessions-thread';
import { errorHandler } from '../middleware/error-handler';

let db: Database;
let app: Hono;

beforeEach(() => {
  db = createDb(':memory:');

  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/sessions', createSessionThreadRouter(db));
});

afterEach(() => {
  if (db) db.close();
});

// ─── GET /api/sessions/:sessionId/thread ─────────────────────────────────────

describe('GET /api/sessions/:sessionId/thread', () => {
  test('returns 404 for unknown session', async () => {
    const res = await app.request('/api/sessions/nonexistent-session-id/thread');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 200 with empty array for session with no messages', async () => {
    const session = createSession(db, crypto.randomUUID(), 'Empty Session');

    const res = await app.request(`/api/sessions/${session.id}/thread`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  test('returns thread messages with parts for legacy messages (fallback text part)', async () => {
    const session = createSession(db, crypto.randomUUID(), 'Legacy Session');
    addMessage(db, crypto.randomUUID(), session.id, 'user', 'Hello there');
    addMessage(db, crypto.randomUUID(), session.id, 'assistant', 'Hi! How can I help?');

    const res = await app.request(`/api/sessions/${session.id}/thread`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);

    // Legacy messages should get a synthesized text part
    expect(body[0].role).toBe('user');
    expect(body[0].content).toBe('Hello there');
    expect(Array.isArray(body[0].parts)).toBe(true);
    expect(body[0].parts).toHaveLength(1);
    expect(body[0].parts[0]).toMatchObject({ type: 'text', text: 'Hello there', ordinal: 0 });

    expect(body[1].role).toBe('assistant');
    expect(body[1].parts[0]).toMatchObject({ type: 'text', text: 'Hi! How can I help?', ordinal: 0 });
  });

  test('returns thread messages with explicit message parts', async () => {
    const session = createSession(db, crypto.randomUUID(), 'Rich Session');

    const project = createProject(
      db,
      crypto.randomUUID(),
      'test-project',
      '/tmp/repo',
      '/tmp/repo',
      'main'
    );

    const artifact = createArtifact(db, {
      id: crypto.randomUUID(),
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Sales Dashboard',
      projectId: project.id,
      workspaceId: null,
      sourceSessionId: session.id,
      sourceMessageId: null,
      status: 'active',
    });

    const revision = createArtifactRevision(db, {
      id: crypto.randomUUID(),
      artifactId: artifact.id,
      revisionNumber: 1,
      specJson: JSON.stringify({ kind: 'dashboard', schemaVersion: 1, title: 'Sales', layout: { columns: 12, rowHeight: 32, gap: 8 }, widgets: [], dataSources: [] }),
      summary: 'initial',
      prompt: 'create a sales dashboard',
      model: 'claude-haiku',
      sourceSessionId: session.id,
      sourceMessageId: null,
    });

    setArtifactCurrentRevision(db, artifact.id, revision.id);

    // Add a message with explicit parts including artifact_ref
    addMessage(
      db,
      crypto.randomUUID(),
      session.id,
      'assistant',
      'I created a dashboard for you.',
      [
        { type: 'text', text: 'I created a dashboard for you.' },
        { type: 'artifact_ref', artifactId: artifact.id, artifactRevisionId: revision.id },
      ]
    );

    const res = await app.request(`/api/sessions/${session.id}/thread`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(1);

    const msg = body[0];
    expect(msg.role).toBe('assistant');
    expect(msg.parts).toHaveLength(2);
    expect(msg.parts[0]).toMatchObject({ type: 'text', text: 'I created a dashboard for you.' });
    expect(msg.parts[1]).toMatchObject({
      type: 'artifact_ref',
      artifactId: artifact.id,
      artifactRevisionId: revision.id,
    });
  });

  test('messages are returned in ascending creation order', async () => {
    const session = createSession(db, crypto.randomUUID(), 'Ordered Session');
    addMessage(db, crypto.randomUUID(), session.id, 'user', 'Message 1');
    addMessage(db, crypto.randomUUID(), session.id, 'assistant', 'Message 2');
    addMessage(db, crypto.randomUUID(), session.id, 'user', 'Message 3');

    const res = await app.request(`/api/sessions/${session.id}/thread`);
    const body = await res.json();

    expect(body).toHaveLength(3);
    expect(body[0].content).toBe('Message 1');
    expect(body[1].content).toBe('Message 2');
    expect(body[2].content).toBe('Message 3');
  });

  test('each thread message has required fields: id, sessionId, role, content, parts, createdAt', async () => {
    const session = createSession(db, crypto.randomUUID(), 'Field Check Session');
    addMessage(db, crypto.randomUUID(), session.id, 'user', 'Check fields');

    const res = await app.request(`/api/sessions/${session.id}/thread`);
    const body = await res.json();

    expect(body).toHaveLength(1);
    const msg = body[0];
    expect(msg.id).toBeDefined();
    expect(msg.sessionId).toBe(session.id);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Check fields');
    expect(Array.isArray(msg.parts)).toBe(true);
    expect(msg.createdAt).toBeDefined();
  });
});
