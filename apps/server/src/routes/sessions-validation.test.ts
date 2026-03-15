import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb } from '../db';
import { createSessionsRouter } from './sessions';
import { errorHandler } from '../middleware/error-handler';

describe('Sessions Routes - Input Validation', () => {
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

  describe('POST /api/sessions - validation', () => {
    test('rejects title that is too long', async () => {
      const longTitle = 'a'.repeat(501);
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: longTitle }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects non-string title', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 12345 }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('accepts valid title', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Valid Title' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe('Valid Title');
    });

    test('accepts empty body (defaults title)', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe('New Chat');
    });

    test('accepts empty object body', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe('New Chat');
    });
  });

  describe('GET /api/sessions/:id/messages - error handling', () => {
    test('returns 404 with consistent error shape for non-existent session', async () => {
      const res = await app.request('/api/sessions/nonexistent/messages');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/sessions/:id - error handling', () => {
    test('returns 404 with consistent error shape for non-existent session', async () => {
      const res = await app.request('/api/sessions/nonexistent', {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('Database error handling', () => {
    test('returns 500 when database is closed', async () => {
      // Close the DB to simulate a database error
      db.close();

      const res = await app.request('/api/sessions');
      // Should get 500 because the DB is closed
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body.code).toBe('INTERNAL_ERROR');
    });
  });
});
