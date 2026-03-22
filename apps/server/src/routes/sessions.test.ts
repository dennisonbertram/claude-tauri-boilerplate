import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb } from '../db';
import { addMessage } from '../db';
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

    test('search with matching query returns only matching sessions', async () => {
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Python Helpers' }),
      });
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'JavaScript Notes' }),
      });
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Python Data Science' }),
      });

      const res = await app.request('/api/sessions?q=Python');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(2);
      const titles = body.map((s: { title: string }) => s.title);
      expect(titles).toContain('Python Helpers');
      expect(titles).toContain('Python Data Science');
      expect(titles).not.toContain('JavaScript Notes');
    });

    test('search with matching message content returns sessions', async () => {
      const createFirst = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Customer Notes' }),
      });
      const firstSession = await createFirst.json();

      const createSecond = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Meeting Log' }),
      });
      const secondSession = await createSecond.json();

      addMessage(db, 'msg-1', firstSession.id, 'user', 'Deployment checklist approved by QA.');
      addMessage(db, 'msg-2', secondSession.id, 'assistant', 'Unrelated discussion about snacks.');

      const res = await app.request('/api/sessions?q=Deployment');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(firstSession.id);
      expect(body[0].title).toBe('Customer Notes');
    });

    test('search with non-matching query returns empty array', async () => {
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Python Helpers' }),
      });
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'JavaScript Notes' }),
      });

      const res = await app.request('/api/sessions?q=rust-session-xyz-no-match');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    test('empty search query returns all sessions', async () => {
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Alpha' }),
      });
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Beta' }),
      });

      const res = await app.request('/api/sessions?q=');
      expect(res.status).toBe(200);

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

    test('creates a session with the requested model when provided', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Model Chat', model: 'claude-opus-4-6' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.model).toBe('claude-opus-4-6');

      const persisted = db
        .prepare('SELECT model FROM sessions WHERE id = ?')
        .get(body.id) as { model: string };
      expect(persisted.model).toBe('claude-opus-4-6');
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

    test('replaces placeholder title with a generated name', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.title).not.toBe('New Conversation');
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
