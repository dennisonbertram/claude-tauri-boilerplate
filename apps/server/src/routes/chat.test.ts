import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { ChatRequest, StreamEvent } from '@claude-tauri/shared';

type EnvSnapshot = Record<string, string | undefined>;
const providerEnvKeys = [
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'ANTHROPIC_BASE_URL',
];

function captureProviderEnv(): EnvSnapshot {
  return providerEnvKeys.reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {} as EnvSnapshot);
}

function resetProviderEnv() {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-key-for-testing';
  delete process.env.CLAUDE_CODE_USE_BEDROCK;
  delete process.env.CLAUDE_CODE_USE_VERTEX;
  delete process.env.ANTHROPIC_BEDROCK_BASE_URL;
  delete process.env.ANTHROPIC_VERTEX_BASE_URL;
  delete process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  delete process.env.ANTHROPIC_BASE_URL;
}

let envAtQueryCall: EnvSnapshot | undefined;

// Mock the claude-agent-sdk before importing anything that uses it
const mockQuery = mock(() => {
  envAtQueryCall = captureProviderEnv();
  return (async function* () {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: 'test-session-abc',
      model: 'claude-opus-4-6',
      tools: ['Read', 'Edit'],
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
        delta: { type: 'text_delta', text: 'Hello' },
        index: 0,
      },
      parent_tool_use_id: null,
      uuid: 'uuid-1',
      session_id: 'test-session-abc',
    };
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: ' world' },
        index: 0,
      },
      parent_tool_use_id: null,
      uuid: 'uuid-2',
      session_id: 'test-session-abc',
    };
  })();
});

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Import AFTER mocking
const { streamClaude } = await import('../services/claude');
const { createChatRouter } = await import('./chat');
const { createDb, createSession, getMessages, addMessage, getSession, updateClaudeSessionId } = await import('../db');
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
    // AI SDK v6 format: { type: 'data-stream-event', data: <event> }
    if (obj.type === 'data-stream-event' && obj.data) {
      events.push(obj.data);
    }
  }
  return events;
}

describe('Claude Service - streamClaude()', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('yields session:init event with sessionId from init', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'session-123',
          model: 'claude-opus-4-6',
          tools: ['Read'],
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
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({ prompt: 'hi' })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('session:init');
    if (events[0].type === 'session:init') {
      expect(events[0].sessionId).toBe('session-123');
      expect(events[0].model).toBe('claude-opus-4-6');
    }
  });

  test('yields text:delta events from content_block_delta', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'session-456',
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
            delta: { type: 'text_delta', text: 'Hello' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'session-456',
        };
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' world' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-2',
          session_id: 'session-456',
        };
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({ prompt: 'test' })) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('session:init');
    expect(events[1].type).toBe('text:delta');
    if (events[1].type === 'text:delta') {
      expect(events[1].text).toBe('Hello');
    }
    expect(events[2].type).toBe('text:delta');
    if (events[2].type === 'text:delta') {
      expect(events[2].text).toBe(' world');
    }
  });

  test('passes resume option when sessionId is provided', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'resumed-session',
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
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({
      prompt: 'follow-up',
      sessionId: 'previous-session',
    })) {
      events.push(event);
    }

    // Verify query was called with resume option
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.resume).toBe('previous-session');
  });

  test('does not set resume when no sessionId provided', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'new-session',
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
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({ prompt: 'first message' })) {
      events.push(event);
    }

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.resume).toBeUndefined();
  });

  test('maps block start/stop events from stream', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 's1',
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
            type: 'content_block_start',
            content_block: { type: 'text' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 's1',
        };
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'only this' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-2',
          session_id: 's1',
        };
        yield {
          type: 'stream_event',
          event: { type: 'content_block_stop', index: 0 },
          parent_tool_use_id: null,
          uuid: 'uuid-3',
          session_id: 's1',
        };
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({ prompt: 'test' })) {
      events.push(event);
    }

    // session:init + block:start + text:delta + block:stop = 4 events
    expect(events).toHaveLength(4);
    expect(events[0].type).toBe('session:init');
    expect(events[1].type).toBe('block:start');
    expect(events[2].type).toBe('text:delta');
    expect(events[3].type).toBe('block:stop');
  });

  test('maps thinking deltas from stream', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 's1',
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
            delta: { type: 'thinking_delta', thinking: 'Let me think...' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 's1',
        };
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({ prompt: 'test' })) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('thinking:delta');
    if (events[1].type === 'thinking:delta') {
      expect(events[1].thinking).toBe('Let me think...');
    }
  });

  test('maps result events from stream', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 's1',
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
          type: 'result',
          subtype: 'success',
          uuid: 'uuid-result',
          session_id: 's1',
          duration_ms: 2000,
          duration_api_ms: 1800,
          is_error: false,
          num_turns: 1,
          result: 'Done',
          total_cost_usd: 0.01,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_tokens: 0,
            cache_creation_tokens: 0,
          },
        };
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({ prompt: 'test' })) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('session:result');
    if (events[1].type === 'session:result') {
      expect(events[1].success).toBe(true);
      expect(events[1].costUsd).toBe(0.01);
    }
  });
});

describe('Chat Route - POST /chat', () => {
  let testApp: InstanceType<typeof Hono>;
  let db: Database;

  beforeEach(() => {
    mockQuery.mockReset();
    envAtQueryCall = undefined;
    resetProviderEnv();
    db = createDb(':memory:');
    const chatRouter = createChatRouter(db);
    testApp = new Hono();
    testApp.route('/api/chat', chatRouter);
  });

  afterEach(() => {
    db.close();
    resetProviderEnv();
  });

  test('returns streaming response for valid chat request', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'chat-session-1',
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
            delta: { type: 'text_delta', text: 'Hi there!' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'chat-session-1',
        };
      })()
    );

    // Create a session first so the chat route can persist messages
    const session = createSession(db, 'test-session-id', 'Test');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = await collectSSEEvents(res);
    const parsed = parseSSEData(events);

    // Should contain text-delta chunks and session metadata
    const textDeltas = parsed.filter((e: any) => e.type === 'text-delta');
    expect(textDeltas.length).toBeGreaterThan(0);
  });

  test('sends custom StreamEvent data on data channel', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'data-channel-test',
          model: 'claude-opus-4-6',
          tools: ['Read', 'Edit'],
          mcp_servers: [{ name: 'fs', status: 'connected' }],
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
            delta: { type: 'text_delta', text: 'hello' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'data-channel-test',
        };
      })()
    );

    const session = createSession(db, 'data-channel-session', 'Test');

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
    const streamEvents = extractStreamEvents(parsed);

    // Should have session:init and text:delta on the data channel
    const sessionInit = streamEvents.find(
      (e: StreamEvent) => e.type === 'session:init'
    );
    expect(sessionInit).toBeDefined();
    if (sessionInit && sessionInit.type === 'session:init') {
      expect(sessionInit.sessionId).toBe('data-channel-test');
      expect(sessionInit.model).toBe('claude-opus-4-6');
      expect(sessionInit.tools).toEqual(['Read', 'Edit']);
    }

    const textDelta = streamEvents.find(
      (e: StreamEvent) => e.type === 'text:delta'
    );
    expect(textDelta).toBeDefined();
    if (textDelta && textDelta.type === 'text:delta') {
      expect(textDelta.text).toBe('hello');
    }
  });

  test('extracts last user message as prompt', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 's1',
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
      })()
    );

    const body: ChatRequest = {
      messages: [
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'response' },
        { role: 'user', content: 'second message' },
      ],
    };

    await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Verify the last user message was used as the prompt
    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.prompt).toBe('second message');
  });

  test('uses resume option when session has a claudeSessionId', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'resumed',
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
      })()
    );

    // Create a session and set its claudeSessionId
    const session = createSession(db, 'resume-test-session', 'Test');
    const { updateClaudeSessionId } = await import('../db');
    updateClaudeSessionId(db, session.id, 'previous-claude-session-id');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'follow up' }],
      sessionId: session.id,
    };

    await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.resume).toBe('previous-claude-session-id');
  });

  test('injects prior DB messages into prompt when session exists without claudeSessionId', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'resumed',
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
      })()
    );

    const session = createSession(db, 'forked-session', 'Forked');
    addMessage(db, 'prior-user-message', session.id, 'user', 'Earlier user prompt');
    addMessage(db, 'prior-assistant-message', session.id, 'assistant', 'Earlier assistant reply');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'New turn message' }],
      sessionId: session.id,
    };

    await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.prompt).toContain('<previous_conversation>');
    expect(callArgs.prompt).toContain('Human: Earlier user prompt');
    expect(callArgs.prompt).toContain('Assistant: Earlier assistant reply');
    expect(callArgs.prompt).toContain('\n</previous_conversation>\n\nHuman: New turn message');
    expect(callArgs.options.resume).toBeUndefined();
  });

  test('returns 400 when no user message is provided', async () => {
    const body = { messages: [] };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test('returns 400 when only assistant messages are provided', async () => {
    const body = {
      messages: [{ role: 'assistant', content: 'I am not a user message' }],
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when attachment references fail schema validation', async () => {
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
      attachments: ['', null as unknown as string],
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid chat request payload');
  });

  test('returns 400 when linearIssue payload fails route validation', async () => {
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
      linearIssue: {
        id: 'ISS-999',
        title: '',
      },
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.error).toBe('Invalid linear issue payload');
  });

  test('includes sessionId in the stream metadata', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'metadata-session',
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
            delta: { type: 'text_delta', text: 'test' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'metadata-session',
        };
      })()
    );

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const events = await collectSSEEvents(res);
    const parsed = parseSSEData(events);

    // Look for the finish event that carries sessionId in messageMetadata
    const finishEvent = parsed.find((e: any) => e.type === 'finish');
    expect(finishEvent).toBeDefined();
    expect((finishEvent as any).messageMetadata?.sessionId).toBe('metadata-session');
  });

  test('retries once without resume when stale session error returns raw session id', async () => {
    const staleSessionId = '11111111-2222-3333-4444-555555555555';
    let attempt = 0;

    mockQuery.mockImplementation(() => {
      attempt += 1;
      if (attempt === 1) {
        return (async function* () {
          const staleError = new Error(staleSessionId);
          throw staleError;
        })();
      }

      return (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'recovered-session',
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
            delta: { type: 'text_delta', text: 'Recovered' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'recovered-session',
        };
      })();
    });

    const session = createSession(db, 'stale-claude-session', 'Test');
    updateClaudeSessionId(db, session.id, staleSessionId);

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Recover stale session' }],
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
    const textDeltas = parsed.filter((e: any) => e.type === 'text-delta');
    expect(textDeltas).toHaveLength(1);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const firstCall = mockQuery.mock.calls[0][0] as any;
    const secondCall = mockQuery.mock.calls[1][0] as any;

    expect(firstCall.options.resume).toBe(staleSessionId);
    expect(secondCall.options.resume).toBeUndefined();

    const refreshed = getSession(db, session.id);
    expect(refreshed?.claudeSessionId).toBe('recovered-session');
  });

  test('passes bedrock provider config to the SDK environment', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        envAtQueryCall = captureProviderEnv();
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'provider-beds',
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
      })()
    );

    const session = createSession(db, 'provider-bedrock-session', 'Test');
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'route provider test' }],
      sessionId: session.id,
      provider: 'bedrock',
      providerConfig: { bedrockBaseUrl: 'https://bedrock.internal' },
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    expect(envAtQueryCall?.ANTHROPIC_API_KEY).toBe('');
    expect(envAtQueryCall?.CLAUDE_CODE_USE_BEDROCK).toBe('1');
    expect(envAtQueryCall?.ANTHROPIC_BEDROCK_BASE_URL).toBe('https://bedrock.internal');
  });

  test('passes vertex provider config to the SDK environment', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        envAtQueryCall = captureProviderEnv();
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'provider-vertex',
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
      })()
    );

    const session = createSession(db, 'provider-vertex-session', 'Test');
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'route provider test' }],
      sessionId: session.id,
      provider: 'vertex',
      providerConfig: {
        vertexProjectId: 'test-vertex-project',
        vertexBaseUrl: 'https://vertex.internal',
      },
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    expect(envAtQueryCall?.ANTHROPIC_API_KEY).toBe('');
    expect(envAtQueryCall?.CLAUDE_CODE_USE_VERTEX).toBe('1');
    expect(envAtQueryCall?.ANTHROPIC_VERTEX_PROJECT_ID).toBe('test-vertex-project');
    expect(envAtQueryCall?.ANTHROPIC_VERTEX_BASE_URL).toBe('https://vertex.internal');
  });

  test('passes custom provider config to the SDK environment', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        envAtQueryCall = captureProviderEnv();
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'provider-custom',
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
      })()
    );

    const session = createSession(db, 'provider-custom-session', 'Test');
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'route provider test' }],
      sessionId: session.id,
      provider: 'custom',
      providerConfig: {
        customBaseUrl: 'https://custom.local/v1',
      },
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    expect(envAtQueryCall?.ANTHROPIC_API_KEY).toBe('');
    expect(envAtQueryCall?.ANTHROPIC_BASE_URL).toBe('https://custom.local/v1');
  });

  test('handles stream errors gracefully', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'err-session',
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
        throw new Error('Stream exploded');
      })()
    );

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Should still return 200 (streaming started before error)
    expect(res.status).toBe(200);

    const events = await collectSSEEvents(res);
    const parsed = parseSSEData(events);

    // Should contain an error event
    const errorEvent = parsed.find((e: any) => e.type === 'error');
    expect(errorEvent).toBeDefined();
  });
});

describe('Chat Route - Message Persistence', () => {
  let testApp: InstanceType<typeof Hono>;
  let db: Database;

  beforeEach(() => {
    mockQuery.mockReset();
    envAtQueryCall = undefined;
    resetProviderEnv();
    db = createDb(':memory:');
    const chatRouter = createChatRouter(db);
    testApp = new Hono();
    testApp.route('/api/chat', chatRouter);
  });

  afterEach(() => {
    db.close();
    resetProviderEnv();
  });

  // Helper to create a standard mock that yields init + text delta
  function setupStandardMock(sessionId: string, text: string) {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: sessionId,
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
            delta: { type: 'text_delta', text },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: sessionId,
        };
      })()
    );
  }

  test('persists the user message to the database', async () => {
    setupStandardMock('claude-sess-1', 'Response');

    // Create a session first
    const session = createSession(db, 'persist-test-session', 'Test');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello, Claude!' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Consume the stream so the response completes
    await res.text();

    // Check the database for the persisted user message
    const messages = getMessages(db, session.id);
    const userMessages = messages.filter((m) => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe('Hello, Claude!');
    expect(userMessages[0].sessionId).toBe(session.id);
  });

  test('persists the assistant response after streaming completes', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'claude-sess-2',
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
            delta: { type: 'text_delta', text: 'Hello' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'claude-sess-2',
        };
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' there!' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-2',
          session_id: 'claude-sess-2',
        };
      })()
    );

    const session = createSession(db, 'persist-assistant-session', 'Test');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Consume the stream so the response fully completes
    await res.text();

    // Check for assistant message in DB
    const messages = getMessages(db, session.id);
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0].content).toBe('Hello there!');
    expect(assistantMessages[0].sessionId).toBe(session.id);
  });

  test('persists both user and assistant messages in correct order', async () => {
    setupStandardMock('claude-sess-3', 'I am the assistant reply.');

    const session = createSession(db, 'order-test-session', 'Test');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'What is 2+2?' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    const messages = getMessages(db, session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('What is 2+2?');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('I am the assistant reply.');
  });

  test('messages are associated with the correct session', async () => {
    setupStandardMock('claude-sess-4', 'Reply A');

    const sessionA = createSession(db, 'session-a', 'Session A');
    const sessionB = createSession(db, 'session-b', 'Session B');

    const bodyA: ChatRequest = {
      messages: [{ role: 'user', content: 'Message for A' }],
      sessionId: sessionA.id,
    };

    const resA = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyA),
    });
    await resA.text();

    // Session A should have messages
    const messagesA = getMessages(db, sessionA.id);
    expect(messagesA).toHaveLength(2);
    expect(messagesA[0].content).toBe('Message for A');

    // Session B should have no messages
    const messagesB = getMessages(db, sessionB.id);
    expect(messagesB).toHaveLength(0);
  });

  test('auto-creates a session when no sessionId is provided', async () => {
    setupStandardMock('claude-auto-sess', 'Auto reply');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'No session yet' }],
      // No sessionId provided
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // We can verify by checking the DB has sessions now
    const { listSessions } = await import('../db');
    const sessions = listSessions(db);
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  test('does not persist assistant message when stream errors', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'claude-err',
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
            delta: { type: 'text_delta', text: 'Partial' },
            index: 0,
          },
          parent_tool_use_id: null,
          uuid: 'uuid-1',
          session_id: 'claude-err',
        };
        throw new Error('Stream broke');
      })()
    );

    const session = createSession(db, 'error-session', 'Error Test');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Will fail' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // User message should be persisted, but assistant message should NOT
    // (since the stream errored, the partial response shouldn't be saved)
    const messages = getMessages(db, session.id);
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    expect(userMessages).toHaveLength(1);
    expect(assistantMessages).toHaveLength(0);
  });

  test('updates claude_session_id on the session after streaming', async () => {
    setupStandardMock('claude-real-id-xyz', 'Done');

    const session = createSession(db, 'update-claude-id-session', 'Test');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // The session should now have the claude session ID stored
    const { getSession } = await import('../db');
    const updatedSession = getSession(db, session.id);
    expect(updatedSession?.claudeSessionId).toBe('claude-real-id-xyz');
  });
});
