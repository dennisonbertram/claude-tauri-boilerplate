import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createSession, addMessage } from '../db';

const mockGenerateSessionTitle = mock(async () => 'Auto Title');

// Must be mocked before importing the router module.
mock.module('../services/auto-namer', () => ({
  generateSessionTitle: mockGenerateSessionTitle,
}));

const { createSessionsRouter } = await import('./sessions');

describe('POST /api/sessions/:id/auto-name (model override)', () => {
  let db: Database;
  let app: Hono;

  beforeEach(() => {
    db = createDb(':memory:');
    const sessionsRouter = createSessionsRouter(db);
    app = new Hono();
    app.route('/api/sessions', sessionsRouter);
    mockGenerateSessionTitle.mockClear();
  });

  afterEach(() => {
    db.close();
  });

  test('passes requested model to auto-namer when provided', async () => {
    const session = createSession(db, 'auto-name-model-session', 'Test');
    addMessage(db, 'm1', session.id, 'user', 'hello');

    const res = await app.request(`/api/sessions/${session.id}/auto-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Auto Title');

    expect(mockGenerateSessionTitle).toHaveBeenCalledTimes(1);
    const firstCall = mockGenerateSessionTitle.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(Array.isArray(firstCall?.[0])).toBe(true);
    expect(firstCall?.[1]).toBe('claude-haiku-4-5-20251001');
  });
});
