import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, addMessage } from '../db';
import { createSessionsRouter } from './sessions';
import { errorHandler } from '../middleware/error-handler';

describe('Session Management - Rename, Fork, Export', () => {
  let db: Database;
  let app: Hono;

  beforeEach(() => {
    db = createDb(':memory:');
    const sessionsRouter = createSessionsRouter(db);
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/sessions', sessionsRouter);
  });

  afterEach(() => {
    db.close();
  });

  // ─── Helper: create a session with messages ───
  async function createSessionWithMessages(
    title: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) {
    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const session = await res.json();

    for (const msg of messages) {
      addMessage(db, crypto.randomUUID(), session.id, msg.role, msg.content);
    }

    return session;
  }

  // ═══════════════════════════════════════════════
  // RENAME: PATCH /api/sessions/:id
  // ═══════════════════════════════════════════════

  describe('PATCH /api/sessions/:id (Rename)', () => {
    test('renames a session and returns updated session', async () => {
      const session = await createSessionWithMessages('Old Title', []);

      const res = await app.request(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe('New Title');
      expect(body.id).toBe(session.id);
      expect(body.updatedAt).toBeDefined();
    });

    test('updated title persists across list fetch', async () => {
      const session = await createSessionWithMessages('Original', []);

      await app.request(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Renamed' }),
      });

      const listRes = await app.request('/api/sessions');
      const sessions = await listRes.json();
      const found = sessions.find((s: any) => s.id === session.id);
      expect(found.title).toBe('Renamed');
    });

    test('rejects empty title', async () => {
      const session = await createSessionWithMessages('Title', []);

      const res = await app.request(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects title that is too long (>500 chars)', async () => {
      const session = await createSessionWithMessages('Title', []);
      const longTitle = 'a'.repeat(501);

      const res = await app.request(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: longTitle }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects missing title field', async () => {
      const session = await createSessionWithMessages('Title', []);

      const res = await app.request(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for non-existent session', async () => {
      const res = await app.request('/api/sessions/nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('trims whitespace from title', async () => {
      const session = await createSessionWithMessages('Title', []);

      const res = await app.request(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '  Trimmed Title  ' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe('Trimmed Title');
    });
  });

  // ═══════════════════════════════════════════════
  // FORK: POST /api/sessions/:id/fork
  // ═══════════════════════════════════════════════

  describe('POST /api/sessions/:id/fork', () => {
    test('creates a new session with all messages copied', async () => {
      const session = await createSessionWithMessages('Original Chat', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am doing well!' },
      ]);

      const res = await app.request(`/api/sessions/${session.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);
      const forked = await res.json();
      expect(forked.id).toBeDefined();
      expect(forked.id).not.toBe(session.id);
      expect(forked.title).toBe('Original Chat (fork)');

      // Verify messages were copied
      const msgRes = await app.request(
        `/api/sessions/${forked.id}/messages`
      );
      const messages = await msgRes.json();
      expect(messages).toHaveLength(4);
      expect(messages[0].content).toBe('Hello');
      expect(messages[3].content).toBe('I am doing well!');
    });

    test('forks up to a specific message index when messageIndex is provided', async () => {
      const session = await createSessionWithMessages('Original Chat', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am doing well!' },
      ]);

      const res = await app.request(`/api/sessions/${session.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIndex: 2 }),
      });

      expect(res.status).toBe(201);
      const forked = await res.json();

      // Should only have the first 2 messages (index 0, 1)
      const msgRes = await app.request(
        `/api/sessions/${forked.id}/messages`
      );
      const messages = await msgRes.json();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Hello');
      expect(messages[1].content).toBe('Hi there!');
    });

    test('forked messages have new IDs (not copies of original IDs)', async () => {
      const session = await createSessionWithMessages('Chat', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ]);

      // Get original message IDs
      const origMsgRes = await app.request(
        `/api/sessions/${session.id}/messages`
      );
      const origMessages = await origMsgRes.json();

      const res = await app.request(`/api/sessions/${session.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const forked = await res.json();

      const forkedMsgRes = await app.request(
        `/api/sessions/${forked.id}/messages`
      );
      const forkedMessages = await forkedMsgRes.json();

      // IDs should differ
      expect(forkedMessages[0].id).not.toBe(origMessages[0].id);
      expect(forkedMessages[1].id).not.toBe(origMessages[1].id);
    });

    test('allows custom title for forked session', async () => {
      const session = await createSessionWithMessages('Original', [
        { role: 'user', content: 'Hello' },
      ]);

      const res = await app.request(`/api/sessions/${session.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My Fork' }),
      });

      expect(res.status).toBe(201);
      const forked = await res.json();
      expect(forked.title).toBe('My Fork');
    });

    test('returns 404 for non-existent source session', async () => {
      const res = await app.request('/api/sessions/nonexistent/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('fork with no messages creates empty session', async () => {
      const session = await createSessionWithMessages('Empty', []);

      const res = await app.request(`/api/sessions/${session.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);
      const forked = await res.json();

      const msgRes = await app.request(
        `/api/sessions/${forked.id}/messages`
      );
      const messages = await msgRes.json();
      expect(messages).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════
  // EXPORT: GET /api/sessions/:id/export
  // ═══════════════════════════════════════════════

  describe('GET /api/sessions/:id/export', () => {
    test('exports session as JSON with all messages', async () => {
      const session = await createSessionWithMessages('Test Export', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Tell me a joke' },
        { role: 'assistant', content: 'Why did the chicken cross the road?' },
      ]);

      const res = await app.request(
        `/api/sessions/${session.id}/export?format=json`
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const body = await res.json();
      expect(body.session.id).toBe(session.id);
      expect(body.session.title).toBe('Test Export');
      expect(body.messages).toHaveLength(4);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toBe('Hello');
      expect(body.exportedAt).toBeDefined();
    });

    test('exports session as Markdown with role labels', async () => {
      const session = await createSessionWithMessages('MD Export', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);

      const res = await app.request(
        `/api/sessions/${session.id}/export?format=md`
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');

      const text = await res.text();
      expect(text).toContain('# MD Export');
      expect(text).toContain('**User:**');
      expect(text).toContain('Hello');
      expect(text).toContain('**Assistant:**');
      expect(text).toContain('Hi there!');
    });

    test('defaults to JSON format when no format specified', async () => {
      const session = await createSessionWithMessages('No Format', [
        { role: 'user', content: 'Hi' },
      ]);

      const res = await app.request(
        `/api/sessions/${session.id}/export`
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const body = await res.json();
      expect(body.session).toBeDefined();
      expect(body.messages).toBeDefined();
    });

    test('returns 404 for non-existent session', async () => {
      const res = await app.request(
        '/api/sessions/nonexistent/export?format=json'
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('returns 400 for invalid format', async () => {
      const session = await createSessionWithMessages('Bad Format', []);

      const res = await app.request(
        `/api/sessions/${session.id}/export?format=xml`
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('exports empty session (no messages) correctly as JSON', async () => {
      const session = await createSessionWithMessages('Empty Export', []);

      const res = await app.request(
        `/api/sessions/${session.id}/export?format=json`
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.messages).toHaveLength(0);
      expect(body.session.title).toBe('Empty Export');
    });

    test('exports empty session correctly as Markdown', async () => {
      const session = await createSessionWithMessages('Empty MD', []);

      const res = await app.request(
        `/api/sessions/${session.id}/export?format=md`
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('# Empty MD');
      // Should not have any role labels since there are no messages
      expect(text).not.toContain('**User:**');
      expect(text).not.toContain('**Assistant:**');
    });

    test('JSON export includes Content-Disposition header for download', async () => {
      const session = await createSessionWithMessages('Download Test', [
        { role: 'user', content: 'Hi' },
      ]);

      const res = await app.request(
        `/api/sessions/${session.id}/export?format=json`
      );

      const disposition = res.headers.get('content-disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('.json');
    });

    test('Markdown export includes Content-Disposition header for download', async () => {
      const session = await createSessionWithMessages('Download MD', [
        { role: 'user', content: 'Hi' },
      ]);

      const res = await app.request(
        `/api/sessions/${session.id}/export?format=md`
      );

      const disposition = res.headers.get('content-disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('.md');
    });

    test('Markdown export formats multi-line content correctly', async () => {
      const session = await createSessionWithMessages('Multi-line', [
        { role: 'user', content: 'Line 1\nLine 2\nLine 3' },
        { role: 'assistant', content: 'Response line 1\nResponse line 2' },
      ]);

      const res = await app.request(
        `/api/sessions/${session.id}/export?format=md`
      );

      const text = await res.text();
      expect(text).toContain('Line 1\nLine 2\nLine 3');
      expect(text).toContain('Response line 1\nResponse line 2');
    });
  });
});
