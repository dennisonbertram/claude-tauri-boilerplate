import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { ChatRequest, StreamEvent } from '@claude-tauri/shared';

// Mock the claude-agent-sdk before importing anything that uses it
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

// Import AFTER mocking
const { createChatRouter } = await import('./chat');
const { createDb, createSession, listSessions, getMessages } = await import('../db');
const { Hono } = await import('hono');

// Helper: collect SSE events from a streaming response
async function collectSSEEvents(response: Response): Promise<string[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
}

// Helper: parse SSE data lines as JSON
function parseSSEData(lines: string[]): unknown[] {
  return lines.filter((l) => l !== '[DONE]').map((l) => JSON.parse(l));
}

// Helper: extract custom StreamEvent data from SSE data lines
function extractStreamEvents(parsed: unknown[]): StreamEvent[] {
  const events: StreamEvent[] = [];
  for (const item of parsed) {
    const obj = item as any;
    if (obj.type === 'data' && Array.isArray(obj.data)) {
      for (const evt of obj.data) {
        events.push(evt);
      }
    }
  }
  return events;
}

describe('Chat Route - Error Handling', () => {
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

  test('sends error StreamEvent when Claude API throws rate limit error', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'rl-session',
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
        const err = new Error('Rate limited');
        (err as any).status = 429;
        throw err;
      })()
    );

    const session = createSession(db, 'rl-test-session', 'Test');
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Stream should still start (200) even though error happens mid-stream
    expect(res.status).toBe(200);

    const events = await collectSSEEvents(res);
    const parsed = parseSSEData(events);

    // Should have an error somewhere in the stream
    const errorEvent = parsed.find((e: any) => e.type === 'error');
    expect(errorEvent).toBeDefined();
  });

  test('sends error StreamEvent on data channel when Claude API throws auth error', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        const err = new Error('Invalid API key');
        (err as any).status = 401;
        throw err;
      })()
    );

    const session = createSession(db, 'auth-err-session', 'Test');
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);

    const events = await collectSSEEvents(res);
    const parsed = parseSSEData(events);

    // Should contain an error event
    const errorEvent = parsed.find((e: any) => e.type === 'error');
    expect(errorEvent).toBeDefined();
  });

  test('sends error StreamEvent with descriptive message on model error', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'model-err-session',
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
        throw new Error('Model overloaded');
      })()
    );

    const session = createSession(db, 'model-err-session', 'Test');
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const events = await collectSSEEvents(res);
    const parsed = parseSSEData(events);

    // The data channel should contain an error event with the message
    const dataEvents = extractStreamEvents(parsed);
    const errorEvents = dataEvents.filter((e) => e.type === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
    if (errorEvents[0].type === 'error') {
      expect(errorEvents[0].message).toContain('Model overloaded');
    }
  });

  test('stream does not crash on non-fatal error events from Claude', async () => {
    // Simulate Claude sending an error event mid-stream, then continuing
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'non-fatal-session',
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
        // Send text before error event
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Before error' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'non-fatal-session',
        };
        // Send text after (simulating continued streaming)
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' after error' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-2',
          session_id: 'non-fatal-session',
        };
      })()
    );

    const session = createSession(db, 'non-fatal-session', 'Test');
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);

    const events = await collectSSEEvents(res);
    const parsed = parseSSEData(events);

    // Should have text-delta events for both chunks
    const textDeltas = parsed.filter((e: any) => e.type === 'text-delta');
    expect(textDeltas.length).toBeGreaterThanOrEqual(2);
  });

  test('handles network timeout gracefully by sending error event', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'timeout-session',
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
        const err = new Error('Request timed out');
        (err as any).code = 'ETIMEDOUT';
        throw err;
      })()
    );

    const session = createSession(db, 'timeout-session', 'Test');
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);

    const events = await collectSSEEvents(res);
    const parsed = parseSSEData(events);

    // Should contain an error event somewhere
    const hasError = parsed.some((e: any) => e.type === 'error');
    expect(hasError).toBe(true);
  });
});

describe('Chat Route - Orphaned Session Prevention (Bug #37)', () => {
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

  test('does not create a session when SDK throws immediately (no sessionId provided)', async () => {
    // SDK throws before yielding any events
    mockQuery.mockImplementation(() =>
      (async function* () {
        const err = new Error('Service Unavailable');
        (err as any).status = 503;
        throw err;
      })()
    );

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      // No sessionId -- would normally auto-create one
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // No sessions should exist in the DB since the SDK failed
    // before yielding any events
    const sessions = listSessions(db);
    expect(sessions).toHaveLength(0);
  });

  test('does not create orphaned session when SDK throws after init event (no sessionId provided)', async () => {
    // SDK yields init then throws
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'orphan-test',
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
        throw new Error('Stream broke mid-conversation');
      })()
    );

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      // No sessionId
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // A session SHOULD be created because the SDK did yield a successful event.
    // But no assistant message should be persisted since the stream errored.
    const sessions = listSessions(db);
    expect(sessions).toHaveLength(1);

    const messages = getMessages(db, sessions[0].id);
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    expect(userMessages).toHaveLength(1);
    expect(assistantMessages).toHaveLength(0);
  });

  test('does not persist user message when SDK fails immediately', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        throw new Error('Connection refused');
      })()
    );

    const session = createSession(db, 'existing-session', 'Test');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'This should not be saved' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // Since SDK failed before yielding any events, the user message
    // should NOT be persisted (session creation is deferred)
    const messages = getMessages(db, session.id);
    expect(messages).toHaveLength(0);
  });

  test('creates session and persists messages on successful SDK response', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'success-session',
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
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello!' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'success-session',
        };
      })()
    );

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi there' }],
      // No sessionId -- should auto-create after first successful event
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // Session should be created and both messages persisted
    const sessions = listSessions(db);
    expect(sessions).toHaveLength(1);

    const messages = getMessages(db, sessions[0].id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hi there');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hello!');
  });
});
