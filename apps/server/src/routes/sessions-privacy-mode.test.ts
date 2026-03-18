/**
 * Regression tests for issue #108: Enterprise data privacy mode.
 *
 * When privacyMode is true in a POST /api/sessions/:id/auto-name request,
 * the backend must NOT call the AI auto-namer and must return a
 * deterministic fallback title instead.
 */
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createSession, addMessage } from '../db';

const mockGenerateSessionTitle = mock(async () => 'AI Generated Title');

// Must be mocked before importing the router module.
mock.module('../services/auto-namer', () => ({
  generateSessionTitle: mockGenerateSessionTitle,
}));

const { createSessionsRouter } = await import('./sessions');

describe('POST /api/sessions/:id/auto-name - privacy mode', () => {
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

  test('calls AI auto-namer when privacyMode is false (normal operation)', async () => {
    const session = createSession(db, 'privacy-test-session-1', 'Test');
    addMessage(db, 'm1', session.id, 'user', 'hello world');

    const res = await app.request(`/api/sessions/${session.id}/auto-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacyMode: false }),
    });

    expect(res.status).toBe(200);
    // AI namer was called
    expect(mockGenerateSessionTitle).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.title).toBe('AI Generated Title');
  });

  test('calls AI auto-namer when privacyMode is absent (default behavior)', async () => {
    const session = createSession(db, 'privacy-test-session-2', 'Test');
    addMessage(db, 'm2', session.id, 'user', 'hello world');

    const res = await app.request(`/api/sessions/${session.id}/auto-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    // AI namer was called
    expect(mockGenerateSessionTitle).toHaveBeenCalledTimes(1);
  });

  test('skips AI auto-namer when privacyMode is true', async () => {
    const session = createSession(db, 'privacy-test-session-3', 'Test');
    addMessage(db, 'm3', session.id, 'user', 'hello world');

    const res = await app.request(`/api/sessions/${session.id}/auto-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacyMode: true }),
    });

    expect(res.status).toBe(200);
    // AI namer must NOT have been called
    expect(mockGenerateSessionTitle).toHaveBeenCalledTimes(0);
  });

  test('returns a deterministic date-based fallback title when privacyMode is true', async () => {
    const session = createSession(db, 'privacy-test-session-4', 'Test');
    addMessage(db, 'm4', session.id, 'user', 'hello world');

    const res = await app.request(`/api/sessions/${session.id}/auto-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacyMode: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // Title must be a non-empty string
    expect(typeof body.title).toBe('string');
    expect(body.title.length).toBeGreaterThan(0);
    // Must start with "Session" (the deterministic prefix)
    expect(body.title).toMatch(/^Session /);
  });

  test('updates session title to fallback when privacyMode is true', async () => {
    const session = createSession(db, 'privacy-test-session-5', 'Old Title');
    addMessage(db, 'm5', session.id, 'user', 'hello world');

    const res = await app.request(`/api/sessions/${session.id}/auto-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacyMode: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // The title in the DB should have been updated to the fallback
    const updated = db.prepare('SELECT title FROM sessions WHERE id = ?').get(session.id) as { title: string };
    expect(updated.title).toBe(body.title);
    expect(updated.title).not.toBe('Old Title');
  });

  test('returns 400 when session has no messages even in privacy mode', async () => {
    const session = createSession(db, 'privacy-test-session-6', 'Empty');

    const res = await app.request(`/api/sessions/${session.id}/auto-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacyMode: true }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('NO_MESSAGES');
    // Still no AI calls made
    expect(mockGenerateSessionTitle).toHaveBeenCalledTimes(0);
  });

  test('returns 404 for non-existent session even with privacyMode', async () => {
    const res = await app.request('/api/sessions/non-existent/auto-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacyMode: true }),
    });

    expect(res.status).toBe(404);
    expect(mockGenerateSessionTitle).toHaveBeenCalledTimes(0);
  });
});
