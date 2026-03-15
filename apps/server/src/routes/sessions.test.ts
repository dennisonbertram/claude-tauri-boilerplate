import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb } from '../db';
import { createSessionsRouter } from './sessions';

describe('Sessions Routes', () => {
  let db: Database;
  let app: Hono;

  beforeEach(() => {
    db = createDb(':memory:');
    const sessionsRouter = createSessionsRouter(db);
    app = new Hono();
    app.route('/api/sessions', sessionsRouter);
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /api/sessions', () => {
    test('returns empty array initially', async () => {
      const res = await app.request('/api/sessions');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    test('returns sessions after creating some', async () => {
      // Create two sessions
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'First' }),
      });
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Second' }),
      });

      const res = await app.request('/api/sessions');
      const body = await res.json();
      expect(body).toHaveLength(2);
    });
  });

  describe('POST /api/sessions', () => {
    test('creates a new session and returns it with 201', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Chat' }),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.title).toBe('Test Chat');
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    test('creates a session with default title when no body provided', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.title).toEqual(expect.any(String));
      expect(body.title.length).toBeGreaterThan(0);
    });

    test('handles request with no JSON body gracefully', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.title).toEqual(expect.any(String));
      expect(body.title.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/sessions/:id/messages', () => {
    test('returns messages for a session', async () => {
      // Create session
      const createRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Chat' }),
      });
      const session = await createRes.json();

      // Add messages directly to DB for testing
      const { addMessage } = await import('../db');
      addMessage(db, crypto.randomUUID(), session.id, 'user', 'Hello');
      addMessage(db, crypto.randomUUID(), session.id, 'assistant', 'Hi there!');

      const res = await app.request(`/api/sessions/${session.id}/messages`);
      expect(res.status).toBe(200);

      const messages = await res.json();
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    test('returns empty array for session with no messages', async () => {
      const createRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Empty Chat' }),
      });
      const session = await createRes.json();

      const res = await app.request(`/api/sessions/${session.id}/messages`);
      expect(res.status).toBe(200);

      const messages = await res.json();
      expect(messages).toEqual([]);
    });

    test('returns 404 for non-existent session', async () => {
      const res = await app.request('/api/sessions/no-such-session/messages');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    test('deletes a session and returns ok', async () => {
      const createRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'To Delete' }),
      });
      const session = await createRes.json();

      const delRes = await app.request(`/api/sessions/${session.id}`, {
        method: 'DELETE',
      });
      expect(delRes.status).toBe(200);

      const body = await delRes.json();
      expect(body.ok).toBe(true);

      // Verify it's gone
      const listRes = await app.request('/api/sessions');
      const sessions = await listRes.json();
      expect(sessions).toHaveLength(0);
    });

    test('cascade-deletes messages when session is deleted', async () => {
      const createRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Cascade Test' }),
      });
      const session = await createRes.json();

      const { addMessage } = await import('../db');
      addMessage(db, crypto.randomUUID(), session.id, 'user', 'Hello');

      // Delete session
      await app.request(`/api/sessions/${session.id}`, { method: 'DELETE' });

      // Messages should be gone (check via DB directly)
      const { getMessages } = await import('../db');
      expect(getMessages(db, session.id)).toHaveLength(0);
    });

    test('returns 404 for non-existent session', async () => {
      const res = await app.request('/api/sessions/ghost-id', {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });
});
