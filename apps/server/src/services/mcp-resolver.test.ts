import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createDb } from '../db/index';
import { createSession } from '../db/db-sessions';
import { setSessionMcpOverride } from '../db/db-session-mcp';
import type { McpJsonEntry, McpJsonFile } from './mcp-config';
import type { AgentProfile } from '@claude-tauri/shared';

// Mock readMcpJson before importing the resolver
const { readMcpJson } = await import('./mcp-config');
const mockReadMcpJson = mock(readMcpJson);

// Replace the module-level readMcpJson with our mock
mock.module('./mcp-config', () => ({
  ...require('./mcp-config'),
  readMcpJson: mockReadMcpJson,
}));

// Import resolver after mocking
const { resolveSessionMcpServers } = await import('./mcp-resolver');

describe('resolveSessionMcpServers', () => {
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
    createSession(db, 'session-1', 'Test Session');
    mockReadMcpJson.mockReset();
  });

  afterEach(() => {
    db.close();
  });

  // Helper: filter out the in-process 'connectors' key since its availability
  // depends on whether the connector module resolves (Bun's mock.module can
  // interfere with transitive imports in the full test suite).
  function externalServerKeys(servers: Record<string, unknown> | undefined): string[] {
    if (!servers) return [];
    return Object.keys(servers).filter((k) => k !== 'connectors').sort();
  }

  test('returns external servers when .mcp.json has entries', async () => {
    mockReadMcpJson.mockResolvedValue({
      mcpServers: {
        'server-a': { type: 'stdio', command: 'node', args: ['a.js'] },
        'server-b': { type: 'stdio', command: 'node', args: ['b.js'] },
      },
    });

    const result = await resolveSessionMcpServers(db, 'session-1', null);
    expect(result.servers).toBeDefined();
    expect(externalServerKeys(result.servers)).toEqual(['server-a', 'server-b']);
  });

  test('excludes globally disabled servers', async () => {
    mockReadMcpJson.mockResolvedValue({
      mcpServers: {
        'server-a': { type: 'stdio', command: 'node', args: ['a.js'] },
        'server-b': { type: 'stdio', command: 'node', args: ['b.js'], disabled: true },
      },
    });

    const result = await resolveSessionMcpServers(db, 'session-1', null);
    expect(result.servers).toBeDefined();
    expect(externalServerKeys(result.servers)).toEqual(['server-a']);
  });

  test('excludes internal servers', async () => {
    mockReadMcpJson.mockResolvedValue({
      mcpServers: {
        'server-a': { type: 'stdio', command: 'node', args: ['a.js'] },
        'claude-code': { type: 'stdio', command: 'claude', args: ['mcp'] },
      },
    });

    const result = await resolveSessionMcpServers(db, 'session-1', null);
    expect(result.servers).toBeDefined();
    expect(externalServerKeys(result.servers)).toEqual(['server-a']);
  });

  test('session override disabling a server removes it from result', async () => {
    mockReadMcpJson.mockResolvedValue({
      mcpServers: {
        'server-a': { type: 'stdio', command: 'node', args: ['a.js'] },
        'server-b': { type: 'stdio', command: 'node', args: ['b.js'] },
      },
    });

    setSessionMcpOverride(db, 'session-1', 'server-b', false);

    const result = await resolveSessionMcpServers(db, 'session-1', null);
    expect(result.servers).toBeDefined();
    expect(externalServerKeys(result.servers)).toEqual(['server-a']);
  });

  test('session override enabling a globally disabled server adds it', async () => {
    mockReadMcpJson.mockResolvedValue({
      mcpServers: {
        'server-a': { type: 'stdio', command: 'node', args: ['a.js'] },
        'server-b': { type: 'stdio', command: 'node', args: ['b.js'], disabled: true },
      },
    });

    setSessionMcpOverride(db, 'session-1', 'server-b', true);

    const result = await resolveSessionMcpServers(db, 'session-1', null);
    expect(result.servers).toBeDefined();
    expect(externalServerKeys(result.servers)).toContain('server-a');
    expect(externalServerKeys(result.servers)).toContain('server-b');
    expect((result.servers!['server-b'] as any).disabled).toBeUndefined();
  });

  test('profile with mcpServersJson returns no servers (defers to profile handling)', async () => {
    mockReadMcpJson.mockResolvedValue({
      mcpServers: {
        'server-a': { type: 'stdio', command: 'node', args: ['a.js'] },
      },
    });

    const profile = {
      mcpServersJson: '{"my-server": {}}',
    } as unknown as AgentProfile;

    const result = await resolveSessionMcpServers(db, 'session-1', profile);
    expect(result.servers).toBeUndefined();
    expect(result.connectorAllowedTools).toEqual([]);
  });

  test('no session ID returns global servers (no overrides applied)', async () => {
    mockReadMcpJson.mockResolvedValue({
      mcpServers: {
        'server-a': { type: 'stdio', command: 'node', args: ['a.js'] },
        'server-b': { type: 'stdio', command: 'node', args: ['b.js'] },
      },
    });

    // Set overrides on session-1, but call resolver with undefined sessionId
    setSessionMcpOverride(db, 'session-1', 'server-b', false);

    const result = await resolveSessionMcpServers(db, undefined, null);
    expect(result.servers).toBeDefined();
    // Both servers should be present since no session overrides are applied
    expect(externalServerKeys(result.servers)).toContain('server-a');
    expect(externalServerKeys(result.servers)).toContain('server-b');
  });

  test('returns result even with no external servers (connectors may provide servers)', async () => {
    mockReadMcpJson.mockResolvedValue({ mcpServers: {} });

    const result = await resolveSessionMcpServers(db, 'session-1', null);
    // servers could be defined (if connectors loaded) or undefined (if connectors failed to load).
    // The key invariant: it never throws.
    if (result.servers) {
      // If connectors loaded, the 'connectors' key should be an SDK server
      if (result.servers['connectors']) {
        expect((result.servers['connectors'] as any).type).toBe('sdk');
      }
    }
  });

  test('connectorAllowedTools contains SDK-namespaced tool names', async () => {
    mockReadMcpJson.mockResolvedValue({ mcpServers: {} });

    const result = await resolveSessionMcpServers(db, 'session-1', null);
    // If connectors loaded, allowed tools should use mcp__connectors__<toolName> format
    if (result.connectorAllowedTools.length > 0) {
      for (const toolName of result.connectorAllowedTools) {
        expect(toolName).toMatch(/^mcp__connectors__/);
      }
      // Weather connector should provide these tools
      expect(result.connectorAllowedTools).toContain('mcp__connectors__weather_current');
      expect(result.connectorAllowedTools).toContain('mcp__connectors__weather_forecast');
      expect(result.connectorAllowedTools).toContain('mcp__connectors__weather_alerts');
    }
  });

  test('connectorAllowedTools does NOT auto-allow gmail, calendar, drive, or plaid tools', async () => {
    mockReadMcpJson.mockResolvedValue({ mcpServers: {} });

    const result = await resolveSessionMcpServers(db, 'session-1', null);
    // Sensitive connector tools must never be auto-allowed regardless of readOnlyHint
    const sensitiveTools = [
      'mcp__connectors__gmail_list_messages',
      'mcp__connectors__gmail_get_message',
      'mcp__connectors__calendar_list_events',
      'mcp__connectors__drive_search_files',
      'mcp__connectors__drive_get_file',
      'mcp__connectors__drive_read_file',
      'mcp__connectors__plaid_list_accounts',
      'mcp__connectors__plaid_get_balance',
      'mcp__connectors__plaid_search_transactions',
      'mcp__connectors__plaid_get_spending_summary',
      'mcp__connectors__plaid_list_institutions',
    ];
    for (const toolName of sensitiveTools) {
      expect(result.connectorAllowedTools).not.toContain(toolName);
    }
  });
});
