import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { createDb } from '../db';
import { createLinearRouter } from './linear';

function parseUrlParam(url: string, key: string): string | null {
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

describe('Linear Routes', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.LINEAR_CLIENT_ID = 'client-id';
    process.env.LINEAR_CLIENT_SECRET = 'client-secret';
    process.env.LINEAR_OAUTH_REDIRECT_URI = 'http://localhost:3131/api/linear/oauth/callback';
    delete process.env.LINEAR_OAUTH_SCOPES;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  test('GET /api/linear/oauth/authorize-url returns an auth URL with required params', async () => {
    const db = createDb(':memory:');
    const app = new Hono();
    app.route('/api/linear', createLinearRouter(db));

    const res = await app.request('/api/linear/oauth/authorize-url');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.url).toBe('string');
    expect(body.url).toContain('https://linear.app/oauth/authorize');
    expect(parseUrlParam(body.url, 'client_id')).toBe('client-id');
    expect(parseUrlParam(body.url, 'redirect_uri')).toBe(
      'http://localhost:3131/api/linear/oauth/callback'
    );
    expect(parseUrlParam(body.url, 'response_type')).toBe('code');
    expect(parseUrlParam(body.url, 'scope')).toBe('read');
    expect(parseUrlParam(body.url, 'state')).toBeTruthy();
  });

  test('GET /api/linear/oauth/callback returns 400 when code is missing', async () => {
    const db = createDb(':memory:');
    const app = new Hono();
    app.route('/api/linear', createLinearRouter(db));

    const res = await app.request('/api/linear/oauth/callback?state=abc');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/linear/oauth/callback returns 400 when state is unknown', async () => {
    const db = createDb(':memory:');
    const app = new Hono();
    app.route('/api/linear', createLinearRouter(db));

    const res = await app.request('/api/linear/oauth/callback?code=ok&state=unknown');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_STATE');
  });

  test('OAuth callback exchanges code for token and persists connection', async () => {
    const db = createDb(':memory:');
    const app = new Hono();
    app.route('/api/linear', createLinearRouter(db));

    const authorizeRes = await app.request('/api/linear/oauth/authorize-url');
    const { url } = await authorizeRes.json();
    const state = parseUrlParam(url, 'state');
    expect(state).toBeTruthy();

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const requestUrl = String(typeof input === 'string' ? input : input?.url ?? '');
      if (requestUrl.includes('https://api.linear.app/oauth/token')) {
        expect(init?.method).toBe('POST');
        return new Response(
          JSON.stringify({
            access_token: 'access-token',
            token_type: 'Bearer',
            scope: 'read',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'unexpected fetch' }), { status: 500 });
    }) as any;

    const callbackRes = await app.request(
      `/api/linear/oauth/callback?code=test-code&state=${encodeURIComponent(state!)}`
    );
    expect(callbackRes.status).toBe(200);

    const statusRes = await app.request('/api/linear/status');
    expect(statusRes.status).toBe(200);
    const statusBody = await statusRes.json();
    expect(statusBody.connected).toBe(true);
  });

  test('GET /api/linear/issues returns 401 when not connected', async () => {
    const db = createDb(':memory:');
    const app = new Hono();
    app.route('/api/linear', createLinearRouter(db));

    const res = await app.request('/api/linear/issues');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('LINEAR_NOT_CONNECTED');
  });

  test('GET /api/linear/issues returns issues sorted newest-first and supports query', async () => {
    const db = createDb(':memory:');
    db.exec(
      `INSERT INTO linear_oauth (id, access_token, token_type, scope) VALUES (1, 'access-token', 'Bearer', 'read')`
    );

    const app = new Hono();
    app.route('/api/linear', createLinearRouter(db));

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const requestUrl = String(typeof input === 'string' ? input : input?.url ?? '');
      if (requestUrl.includes('https://api.linear.app/graphql')) {
        expect(init?.headers?.Authorization ?? init?.headers?.authorization).toContain('Bearer access-token');

        const payload = JSON.parse(String(init?.body ?? '{}'));
        expect(payload?.variables?.query).toBe('login');

        return new Response(
          JSON.stringify({
            data: {
              issues: {
                nodes: [
                  {
                    id: 'uuid-2',
                    identifier: 'ENG-2',
                    title: 'Older issue',
                    description: 'Older',
                    createdAt: '2025-01-01T00:00:00.000Z',
                    url: 'https://linear.app/org/issue/ENG-2/older',
                  },
                  {
                    id: 'uuid-1',
                    identifier: 'ENG-1',
                    title: 'Newer issue',
                    description: 'Newer',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    url: 'https://linear.app/org/issue/ENG-1/newer',
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: 'unexpected fetch' }), { status: 500 });
    }) as any;

    const res = await app.request('/api/linear/issues?q=login');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues[0].id).toBe('ENG-1');
    expect(body.issues[1].id).toBe('ENG-2');
  });

  test('GET /api/linear/issues/:identifier returns issue details', async () => {
    const db = createDb(':memory:');
    db.exec(
      `INSERT INTO linear_oauth (id, access_token, token_type, scope) VALUES (1, 'access-token', 'Bearer', 'read')`
    );

    const app = new Hono();
    app.route('/api/linear', createLinearRouter(db));

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const requestUrl = String(typeof input === 'string' ? input : input?.url ?? '');
      if (requestUrl.includes('https://api.linear.app/graphql')) {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        expect(payload?.variables?.identifier).toBe('ENG-123');

        return new Response(
          JSON.stringify({
            data: {
              issues: {
                nodes: [
                  {
                    id: 'uuid-123',
                    identifier: 'ENG-123',
                    title: 'Deep linked issue',
                    description: 'Example',
                    createdAt: '2026-03-01T00:00:00.000Z',
                    url: 'https://linear.app/org/issue/ENG-123/deep-linked',
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: 'unexpected fetch' }), { status: 500 });
    }) as any;

    const res = await app.request('/api/linear/issues/ENG-123');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('ENG-123');
    expect(body.title).toBe('Deep linked issue');
    expect(body.url).toContain('linear.app');
  });
});
