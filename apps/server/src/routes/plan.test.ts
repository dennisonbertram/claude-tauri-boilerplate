import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import type { PlanDecisionRequest } from '@claude-tauri/shared';
import { mockQuery } from '../test-utils/claude-sdk-mock';

// Import AFTER mocking
const { createPlanRouter } = await import('./plan');
const { createDb, createSession } = await import('../db');
const { Hono } = await import('hono');

describe('Plan Route - POST /api/chat/plan', () => {
  let testApp: InstanceType<typeof Hono>;
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
    const planRouter = createPlanRouter(db);
    testApp = new Hono();
    testApp.route('/api/chat/plan', planRouter);
  });

  afterEach(() => {
    db.close();
  });

  test('accepts a valid approve decision', async () => {
    const session = createSession(db, 'plan-test-session', 'Test');

    const body: PlanDecisionRequest = {
      sessionId: session.id,
      planId: 'plan-1',
      decision: 'approve',
    };

    const res = await testApp.request('/api/chat/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.planId).toBe('plan-1');
    expect(json.decision).toBe('approve');
  });

  test('accepts a valid reject decision with feedback', async () => {
    const session = createSession(db, 'plan-reject-session', 'Test');

    const body: PlanDecisionRequest = {
      sessionId: session.id,
      planId: 'plan-2',
      decision: 'reject',
      feedback: 'Please include error handling',
    };

    const res = await testApp.request('/api/chat/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.decision).toBe('reject');
    expect(json.feedback).toBe('Please include error handling');
  });

  test('accepts a reject decision without feedback', async () => {
    const session = createSession(db, 'plan-reject-no-fb', 'Test');

    const body: PlanDecisionRequest = {
      sessionId: session.id,
      planId: 'plan-3',
      decision: 'reject',
    };

    const res = await testApp.request('/api/chat/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.decision).toBe('reject');
  });

  test('rejects request without sessionId', async () => {
    const body = {
      planId: 'plan-4',
      decision: 'approve',
    };

    const res = await testApp.request('/api/chat/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test('rejects request without planId', async () => {
    const body = {
      sessionId: 'some-session',
      decision: 'approve',
    };

    const res = await testApp.request('/api/chat/plan', {
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
      planId: 'plan-5',
    };

    const res = await testApp.request('/api/chat/plan', {
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
      planId: 'plan-6',
      decision: 'maybe',
    };

    const res = await testApp.request('/api/chat/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test('archives plans under .context/plans', async () => {
    const tempProjectRoot = mkdtempSync(join(tmpdir(), 'plan-archive-'));
    process.env.PROJECT_ROOT = tempProjectRoot;

    const res = await testApp.request('/api/chat/plan/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'plan-archive-session',
        planId: 'plan-archive-1',
        content: '1. Inspect the code\n2. Patch the bug',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.path).toContain('.context/plans/plan-archive-1.md');

    const saved = readFileSync(
      join(tempProjectRoot, '.context', 'plans', 'plan-archive-1.md'),
      'utf8'
    );
    expect(saved).toContain('# Plan plan-archive-1');
    expect(saved).toContain('1. Inspect the code');

    delete process.env.PROJECT_ROOT;
  });
});

describe('PlanStore', () => {
  let store: any;

  beforeEach(async () => {
    const { PlanStore } = await import('../services/plan-store');
    store = new PlanStore();
  });

  test('registers and resolves a pending plan decision', async () => {
    const promise = store.waitForDecision('plan-1');
    store.resolveDecision('plan-1', { decision: 'approve' });
    const result = await promise;
    expect(result.decision).toBe('approve');
  });

  test('resolves a reject decision with feedback', async () => {
    const promise = store.waitForDecision('plan-2');
    store.resolveDecision('plan-2', {
      decision: 'reject',
      feedback: 'Add tests',
    });
    const result = await promise;
    expect(result.decision).toBe('reject');
    expect(result.feedback).toBe('Add tests');
  });

  test('returns false for unknown plan ID', () => {
    const resolved = store.resolveDecision('nonexistent', {
      decision: 'approve',
    });
    expect(resolved).toBe(false);
  });

  test('isPending returns true for registered plan', () => {
    store.waitForDecision('plan-3');
    expect(store.isPending('plan-3')).toBe(true);
  });

  test('isPending returns false after resolution', async () => {
    const promise = store.waitForDecision('plan-4');
    store.resolveDecision('plan-4', { decision: 'approve' });
    await promise;
    expect(store.isPending('plan-4')).toBe(false);
  });

  test('isPending returns false for unknown plan', () => {
    expect(store.isPending('nonexistent')).toBe(false);
  });
});
