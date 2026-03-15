import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { PermissionResponse } from '@claude-tauri/shared';

// Mock the claude-agent-sdk before importing anything that uses it
const mockQuery = mock(() => {
  return (async function* () {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: 'test-session',
      model: 'claude-opus-4-6',
      tools: ['Read', 'Edit'],
      mcp_servers: [],
      claude_code_version: '2.1.39',
      cwd: '/project',
      permissionMode: 'default',
      apiKeySource: 'env',
      slash_commands: [],
      output_style: 'text',
      skills: [],
      plugins: [],
    };
  })();
});

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Import AFTER mocking
const { createPermissionRouter } = await import('./permission');
const { createDb, createSession } = await import('../db');
const { Hono } = await import('hono');

describe('Permission Route - POST /api/chat/permission', () => {
  let testApp: InstanceType<typeof Hono>;
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
    const permissionRouter = createPermissionRouter(db);
    testApp = new Hono();
    testApp.route('/api/chat/permission', permissionRouter);
  });

  afterEach(() => {
    db.close();
  });

  test('accepts a valid allow_once permission response', async () => {
    const session = createSession(db, 'perm-test-session', 'Test');

    const body: PermissionResponse = {
      sessionId: session.id,
      requestId: 'req-1',
      decision: 'allow_once',
    };

    const res = await testApp.request('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.requestId).toBe('req-1');
    expect(json.decision).toBe('allow_once');
  });

  test('accepts a valid deny permission response', async () => {
    const session = createSession(db, 'perm-deny-session', 'Test');

    const body: PermissionResponse = {
      sessionId: session.id,
      requestId: 'req-2',
      decision: 'deny',
    };

    const res = await testApp.request('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.decision).toBe('deny');
  });

  test('accepts allow_always with session scope', async () => {
    const session = createSession(db, 'perm-always-session', 'Test');

    const body: PermissionResponse = {
      sessionId: session.id,
      requestId: 'req-3',
      decision: 'allow_always',
      scope: 'session',
    };

    const res = await testApp.request('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.decision).toBe('allow_always');
    expect(json.scope).toBe('session');
  });

  test('rejects request without sessionId', async () => {
    const body = {
      requestId: 'req-4',
      decision: 'allow_once',
    };

    const res = await testApp.request('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test('rejects request without requestId', async () => {
    const body = {
      sessionId: 'some-session',
      decision: 'allow_once',
    };

    const res = await testApp.request('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test('rejects request without decision', async () => {
    const body = {
      sessionId: 'some-session',
      requestId: 'req-5',
    };

    const res = await testApp.request('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test('rejects request with invalid decision value', async () => {
    const body = {
      sessionId: 'some-session',
      requestId: 'req-6',
      decision: 'maybe',
    };

    const res = await testApp.request('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});

describe('Permission Store', () => {
  let store: any;

  beforeEach(async () => {
    const { PermissionStore } = await import('../services/permission-store');
    store = new PermissionStore();
  });

  test('registers and resolves a pending permission request', async () => {
    const promise = store.waitForDecision('req-1');
    store.resolveDecision('req-1', 'allow_once');
    const result = await promise;
    expect(result).toBe('allow_once');
  });

  test('returns null for unknown request ID', () => {
    const resolved = store.resolveDecision('nonexistent', 'allow_once');
    expect(resolved).toBe(false);
  });

  test('tracks session-level allowed tools', () => {
    store.addSessionAllowedTool('session-1', 'Read');
    expect(store.isToolAllowedForSession('session-1', 'Read')).toBe(true);
    expect(store.isToolAllowedForSession('session-1', 'Bash')).toBe(false);
    expect(store.isToolAllowedForSession('session-2', 'Read')).toBe(false);
  });

  test('clears session permissions', () => {
    store.addSessionAllowedTool('session-1', 'Read');
    store.addSessionAllowedTool('session-1', 'Edit');
    store.clearSession('session-1');
    expect(store.isToolAllowedForSession('session-1', 'Read')).toBe(false);
  });

  test('determines risk level for Bash tool', () => {
    expect(store.getRiskLevel('Bash')).toBe('high');
  });

  test('determines risk level for Write tool', () => {
    expect(store.getRiskLevel('Write')).toBe('high');
  });

  test('determines risk level for Edit tool', () => {
    expect(store.getRiskLevel('Edit')).toBe('high');
  });

  test('determines risk level for Read tool', () => {
    expect(store.getRiskLevel('Read')).toBe('low');
  });

  test('determines risk level for Grep tool', () => {
    expect(store.getRiskLevel('Grep')).toBe('low');
  });

  test('determines risk level for Glob tool', () => {
    expect(store.getRiskLevel('Glob')).toBe('low');
  });

  test('determines risk level for unknown tool', () => {
    expect(store.getRiskLevel('SomeNewTool')).toBe('medium');
  });
});
