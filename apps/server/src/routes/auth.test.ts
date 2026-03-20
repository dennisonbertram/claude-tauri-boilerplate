import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { AuthStatus } from '@claude-tauri/shared';

let envAtQueryCall: string | undefined;

// We mock the claude-agent-sdk module before importing the auth service
const mockQuery = mock((args?: { options?: { env?: Record<string, string | undefined> } }) => {
  envAtQueryCall = args?.options?.env?.ANTHROPIC_API_KEY;
  // Default: returns an async generator that yields an init event
  return (async function* () {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: 'test-session-123',
      accountInfo: { email: 'user@example.com', plan: 'pro' },
    };
  })();
});

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Import AFTER mocking
const { getAuthStatus } = await import('../services/auth');
const { authRouter } = await import('./auth');
const { Hono } = await import('hono');

describe('Auth Service - getAuthStatus()', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    envAtQueryCall = undefined;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-key-for-testing';
  });

  test('returns authenticated with email and plan for valid subscription', async () => {
    mockQuery.mockImplementation((args) => {
      envAtQueryCall = (args as any)?.options?.env?.ANTHROPIC_API_KEY;
      return (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session-123',
          accountInfo: { email: 'user@example.com', plan: 'pro' },
        };
      })();
    });

    const result = await getAuthStatus();

    expect(result.authenticated).toBe(true);
    expect(result.email).toBe('user@example.com');
    expect(result.plan).toBe('pro');
    expect(result.error).toBeUndefined();
    expect(envAtQueryCall).toBe('');
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-fake-key-for-testing');
  });

  test('returns unauthenticated with error when query throws', async () => {
    mockQuery.mockImplementation(() => {
      throw new Error('CLI not installed');
    });

    const result = await getAuthStatus();

    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('CLI not installed');
    expect(result.email).toBeUndefined();
    expect(result.plan).toBeUndefined();
  });

  test('returns unauthenticated with error when async generator throws', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        throw new Error('Authentication failed');
      })()
    );

    const result = await getAuthStatus();

    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Authentication failed');
  });

  test('returns authenticated with plan but no email when email is missing', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session-456',
          accountInfo: { plan: 'pro' },
        };
      })()
    );

    const result = await getAuthStatus();

    expect(result.authenticated).toBe(true);
    expect(result.email).toBeUndefined();
    expect(result.plan).toBe('pro');
    expect(result.error).toBeUndefined();
  });

  test('returns unauthenticated when no init event is received', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield { type: 'stream_event', event: { type: 'content_block_start' } };
      })()
    );

    const result = await getAuthStatus();

    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('No authentication info received');
  });

  test('handles timeout after 10 seconds', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        // Simulate a stream that never yields an init event and hangs
        await new Promise((resolve) => setTimeout(resolve, 30_000));
        yield { type: 'system', subtype: 'init', session_id: 'late' };
      })()
    );

    const start = Date.now();
    const result = await getAuthStatus();
    const elapsed = Date.now() - start;

    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('timed out');
    // Should resolve around 10s, not 30s
    expect(elapsed).toBeLessThan(15_000);
  }, 20_000);
});

describe('Auth Route - GET /status', () => {
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    mockQuery.mockReset();
    testApp = new Hono();
    testApp.route('/api/auth', authRouter);
  });

  test('returns 200 with auth status JSON', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session',
          accountInfo: { email: 'user@example.com', plan: 'pro' },
        };
      })()
    );

    const res = await testApp.request('/api/auth/status');
    expect(res.status).toBe(200);

    const body: AuthStatus = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.email).toBe('user@example.com');
    expect(body.plan).toBe('pro');
  });

  test('returns 200 with error status when unauthenticated', async () => {
    mockQuery.mockImplementation(() => {
      throw new Error('No subscription');
    });

    const res = await testApp.request('/api/auth/status');
    expect(res.status).toBe(200);

    const body: AuthStatus = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.error).toBe('No subscription');
  });
});
