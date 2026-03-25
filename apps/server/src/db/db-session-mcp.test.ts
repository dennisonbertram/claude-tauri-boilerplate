import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createDb } from './index';
import { createSession, deleteSession } from './db-sessions';
import {
  getSessionMcpOverrides,
  setSessionMcpOverride,
  deleteSessionMcpOverride,
  copySessionMcpOverrides,
} from './db-session-mcp';

describe('Session MCP Overrides', () => {
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
    createSession(db, 'session-1', 'Test Session 1');
    createSession(db, 'session-2', 'Test Session 2');
  });

  afterEach(() => {
    db.close();
  });

  test('getSessionMcpOverrides returns empty array for session with no overrides', () => {
    const overrides = getSessionMcpOverrides(db, 'session-1');
    expect(overrides).toEqual([]);
  });

  test('setSessionMcpOverride creates an override and getSessionMcpOverrides returns it', () => {
    setSessionMcpOverride(db, 'session-1', 'my-server', true);

    const overrides = getSessionMcpOverrides(db, 'session-1');
    expect(overrides).toHaveLength(1);
    expect(overrides[0].sessionId).toBe('session-1');
    expect(overrides[0].serverName).toBe('my-server');
    expect(overrides[0].enabled).toBe(true);
    expect(overrides[0].createdAt).toBeDefined();
    expect(overrides[0].updatedAt).toBeDefined();
  });

  test('setSessionMcpOverride upserts — calling twice with different enabled value updates it', () => {
    setSessionMcpOverride(db, 'session-1', 'my-server', true);

    let overrides = getSessionMcpOverrides(db, 'session-1');
    expect(overrides).toHaveLength(1);
    expect(overrides[0].enabled).toBe(true);

    setSessionMcpOverride(db, 'session-1', 'my-server', false);

    overrides = getSessionMcpOverrides(db, 'session-1');
    expect(overrides).toHaveLength(1);
    expect(overrides[0].enabled).toBe(false);
  });

  test('setSessionMcpOverride creates multiple overrides for different servers', () => {
    setSessionMcpOverride(db, 'session-1', 'server-a', true);
    setSessionMcpOverride(db, 'session-1', 'server-b', false);

    const overrides = getSessionMcpOverrides(db, 'session-1');
    expect(overrides).toHaveLength(2);

    const names = overrides.map((o) => o.serverName).sort();
    expect(names).toEqual(['server-a', 'server-b']);
  });

  test('overrides are scoped to sessions — session-2 does not see session-1 overrides', () => {
    setSessionMcpOverride(db, 'session-1', 'my-server', true);

    const overrides1 = getSessionMcpOverrides(db, 'session-1');
    const overrides2 = getSessionMcpOverrides(db, 'session-2');

    expect(overrides1).toHaveLength(1);
    expect(overrides2).toHaveLength(0);
  });

  test('deleteSessionMcpOverride removes the override', () => {
    setSessionMcpOverride(db, 'session-1', 'my-server', true);
    setSessionMcpOverride(db, 'session-1', 'other-server', false);

    deleteSessionMcpOverride(db, 'session-1', 'my-server');

    const overrides = getSessionMcpOverrides(db, 'session-1');
    expect(overrides).toHaveLength(1);
    expect(overrides[0].serverName).toBe('other-server');
  });

  test('deleteSessionMcpOverride does not throw for non-existent override', () => {
    expect(() =>
      deleteSessionMcpOverride(db, 'session-1', 'no-such-server')
    ).not.toThrow();
  });

  test('copySessionMcpOverrides copies all overrides from one session to another', () => {
    setSessionMcpOverride(db, 'session-1', 'server-a', true);
    setSessionMcpOverride(db, 'session-1', 'server-b', false);

    copySessionMcpOverrides(db, 'session-1', 'session-2');

    const overrides = getSessionMcpOverrides(db, 'session-2');
    expect(overrides).toHaveLength(2);

    const serverA = overrides.find((o) => o.serverName === 'server-a');
    const serverB = overrides.find((o) => o.serverName === 'server-b');

    expect(serverA).toBeDefined();
    expect(serverA!.enabled).toBe(true);
    expect(serverA!.sessionId).toBe('session-2');

    expect(serverB).toBeDefined();
    expect(serverB!.enabled).toBe(false);
    expect(serverB!.sessionId).toBe('session-2');
  });

  test('copySessionMcpOverrides with no overrides does nothing (no error)', () => {
    expect(() =>
      copySessionMcpOverrides(db, 'session-1', 'session-2')
    ).not.toThrow();

    const overrides = getSessionMcpOverrides(db, 'session-2');
    expect(overrides).toEqual([]);
  });

  test('overrides are deleted when session is deleted (CASCADE)', () => {
    setSessionMcpOverride(db, 'session-1', 'server-a', true);
    setSessionMcpOverride(db, 'session-1', 'server-b', false);

    // Verify overrides exist
    expect(getSessionMcpOverrides(db, 'session-1')).toHaveLength(2);

    deleteSession(db, 'session-1');

    // Verify overrides are gone via direct SQL (the function would also return empty)
    const rows = db
      .prepare(`SELECT * FROM session_mcp_overrides WHERE session_id = ?`)
      .all('session-1');
    expect(rows).toHaveLength(0);
  });
});
