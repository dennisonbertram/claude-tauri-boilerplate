import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { ChatRequest } from '@claude-tauri/shared';

const mockQuery = mock(() => {
  return (async function* () {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: 'test-session-abc',
      model: 'claude-opus-4-6',
      tools: [],
      mcp_servers: [],
      claude_code_version: '2.1.39',
      cwd: '/project',
      permissionMode: 'bypassPermissions',
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

const { createChatRouter } = await import('./chat');
const { createDb } = await import('../db');
const { Hono } = await import('hono');

describe('Chat Route - Slash command handling', () => {
  let testApp: InstanceType<typeof Hono>;
  let db: Database;

  beforeEach(() => {
    mockQuery.mockReset();
    db = createDb(':memory:');
    const chatRouter = createChatRouter(db);
    testApp = new Hono();
    testApp.route('/api/chat', chatRouter);
  });

  afterEach(() => {
    db.close();
  });

  test('rejects unknown slash commands', async () => {
    const body: ChatRequest = {
      messages: [{ role: 'user', content: '/does-not-exist' }],
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect((payload as any).code).toBe('INVALID_COMMAND');
    expect((payload as any).command).toBe('does-not-exist');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('rejects known client-side slash commands at the API boundary', async () => {
    const body: ChatRequest = {
      messages: [{ role: 'user', content: '/model' }],
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect((payload as any).code).toBe('CLIENT_COMMAND');
    expect((payload as any).command).toBe('model');
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
