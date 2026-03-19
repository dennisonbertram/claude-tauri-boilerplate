import { describe, test, expect, mock, beforeEach, afterEach, afterAll } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createSession, addMessage } from '../db';

// Capture original before mocking so we can restore in afterAll
const originalModule = await import('../services/context-summary');
const originalGenerateContextSummary = originalModule.generateContextSummary;

const mockGenerateContextSummary = mock(async () => 'Debugging a React render loop');

// Mock before importing the router so the route picks up the mock
mock.module('../services/context-summary', () => ({
  generateContextSummary: mockGenerateContextSummary,
}));

afterAll(() => {
  // Restore the original so other test files (e.g., context-summary.test.ts) get the real impl
  mock.module('../services/context-summary', () => ({
    generateContextSummary: originalGenerateContextSummary,
  }));
});

const { createSessionsRouter } = await import('./sessions');

describe('GET /api/sessions/:id/summary', () => {
  let db: Database;
  let app: Hono;

  beforeEach(() => {
    db = createDb(':memory:');
    const sessionsRouter = createSessionsRouter(db);
    app = new Hono();
    app.route('/api/sessions', sessionsRouter);
    mockGenerateContextSummary.mockClear();
    mockGenerateContextSummary.mockImplementation(async () => 'Debugging a React render loop');
  });

  afterEach(() => {
    db.close();
  });

  test('returns 404 for unknown session', async () => {
    const res = await app.request('/api/sessions/nonexistent-id/summary');
    expect(res.status).toBe(404);
  });

  test('returns { summary: null } when session has fewer than 2 messages', async () => {
    const session = createSession(db, 'sum-session-1', 'Empty Chat');

    const res = await app.request(`/api/sessions/${session.id}/summary`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ summary: null });
    expect(mockGenerateContextSummary).not.toHaveBeenCalled();
  });

  test('returns { summary: null } when session has exactly 1 message', async () => {
    const session = createSession(db, 'sum-session-2', 'One Message');
    addMessage(db, 'm1', session.id, 'user', 'Hello');

    const res = await app.request(`/api/sessions/${session.id}/summary`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ summary: null });
    expect(mockGenerateContextSummary).not.toHaveBeenCalled();
  });

  test('calls generateContextSummary and returns summary when session has 2+ messages', async () => {
    const session = createSession(db, 'sum-session-3', 'Active Chat');
    addMessage(db, 'm1', session.id, 'user', 'Why is my React component re-rendering?');
    addMessage(db, 'm2', session.id, 'assistant', 'Likely caused by an unstable reference.');

    const res = await app.request(`/api/sessions/${session.id}/summary`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ summary: 'Debugging a React render loop' });
    expect(mockGenerateContextSummary).toHaveBeenCalledTimes(1);
  });

  test('returns { summary: null } when generateContextSummary returns null', async () => {
    mockGenerateContextSummary.mockImplementationOnce(async () => null as any);

    const session = createSession(db, 'sum-session-4', 'Null Summary');
    addMessage(db, 'm1', session.id, 'user', 'hi');
    addMessage(db, 'm2', session.id, 'assistant', 'hello');

    const res = await app.request(`/api/sessions/${session.id}/summary`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ summary: null });
  });

  test('returns 500 when generateContextSummary throws', async () => {
    mockGenerateContextSummary.mockImplementationOnce(async () => {
      throw new Error('SDK failed');
    });

    const session = createSession(db, 'sum-session-5', 'Error Case');
    addMessage(db, 'm1', session.id, 'user', 'hi');
    addMessage(db, 'm2', session.id, 'assistant', 'hello');

    const res = await app.request(`/api/sessions/${session.id}/summary`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  // Regression: summary endpoint must not mutate session state
  test('repeated calls return same summary without side effects', async () => {
    const session = createSession(db, 'sum-session-6', 'Repeat Test');
    addMessage(db, 'm1', session.id, 'user', 'Explain async/await');
    addMessage(db, 'm2', session.id, 'assistant', 'Async/await is syntactic sugar over Promises.');

    const res1 = await app.request(`/api/sessions/${session.id}/summary`);
    const res2 = await app.request(`/api/sessions/${session.id}/summary`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(await res1.json()).toEqual({ summary: 'Debugging a React render loop' });
    expect(await res2.json()).toEqual({ summary: 'Debugging a React render loop' });
    expect(mockGenerateContextSummary).toHaveBeenCalledTimes(2);
  });
});
