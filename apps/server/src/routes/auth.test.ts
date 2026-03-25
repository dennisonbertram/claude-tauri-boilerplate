import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { AuthStatus } from '@claude-tauri/shared';
import { mockQuery } from '../test-utils/claude-sdk-mock';

let envAtQueryCall: string | undefined;

// Import AFTER mocking
const { getAuthStatus, __resetAuthStatusCacheForTests } = await import('../services/auth');
const { authRouter } = await import('./auth');
const { Hono } = await import('hono');

describe('Auth Service - getAuthStatus()', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    __resetAuthStatusCacheForTests();
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

  test('handles timeout after 15 seconds', async () => {
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
    // Should resolve around 15s, not 30s
    expect(elapsed).toBeLessThan(16_000);
  }, 25_000);

  test('returns cached authenticated status when a follow-up auth check times out', async () => {
    let callCount = 0;
    mockQuery.mockImplementation(() => {
      callCount += 1;

      if (callCount === 1) {
        return (async function* () {
          yield {
            type: 'system',
            subtype: 'init',
            session_id: 'cached-session',
            accountInfo: { email: 'user@example.com', plan: 'pro' },
          };
        })();
      }

      return (async function* () {
        await new Promise((resolve) => setTimeout(resolve, 30_000));
        yield { type: 'system', subtype: 'init', session_id: 'late-session' };
      })();
    });

    const first = await getAuthStatus();
    const second = await getAuthStatus();

    expect(first).toEqual({
      authenticated: true,
      email: 'user@example.com',
      plan: 'pro',
    });
    expect(second).toEqual(first);
  }, 20_000);

  test('reuses a single in-flight auth check for concurrent callers', async () => {
    let callCount = 0;
    mockQuery.mockImplementation(() => {
      callCount += 1;
      return (async function* () {
        await new Promise((resolve) => setTimeout(resolve, 25));
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'shared-session',
          accountInfo: { email: 'user@example.com', plan: 'pro' },
        };
      })();
    });

    const [first, second] = await Promise.all([getAuthStatus(), getAuthStatus()]);

    expect(callCount).toBe(1);
    expect(first).toEqual(second);
    expect(first.authenticated).toBe(true);
  });
});

describe('Auth Route - GET /status', () => {
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    mockQuery.mockReset();
    __resetAuthStatusCacheForTests();
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
