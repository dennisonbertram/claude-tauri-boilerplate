import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { ChatRequest } from '@claude-tauri/shared';

// Mock the claude-agent-sdk before importing anything that uses it
const mockQuery = mock(() => {
  return (async function* () {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: 'test-session-abc',
    };
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello' },
      },
    };
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: ' world' },
      },
    };
  })();
});

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Import AFTER mocking
const { streamClaude } = await import('../services/claude');
const { chatRouter } = await import('./chat');
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

describe('Claude Service - streamClaude()', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('yields session event with sessionId from init', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'session-123',
        };
      })()
    );

    const events: Array<{ type: string; sessionId?: string; text?: string }> = [];
    for await (const event of streamClaude({ prompt: 'hi' })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'session', sessionId: 'session-123' });
  });

  test('yields text-delta events from content_block_delta', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'session-456',
        };
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' },
          },
        };
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' world' },
          },
        };
      })()
    );

    const events: Array<{ type: string; sessionId?: string; text?: string }> = [];
    for await (const event of streamClaude({ prompt: 'test' })) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'session', sessionId: 'session-456' });
    expect(events[1]).toEqual({ type: 'text-delta', text: 'Hello' });
    expect(events[2]).toEqual({ type: 'text-delta', text: ' world' });
  });

  test('passes resume option when sessionId is provided', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield { type: 'system', subtype: 'init', session_id: 'resumed-session' };
      })()
    );

    const events = [];
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
        yield { type: 'system', subtype: 'init', session_id: 'new-session' };
      })()
    );

    const events = [];
    for await (const event of streamClaude({ prompt: 'first message' })) {
      events.push(event);
    }

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.resume).toBeUndefined();
  });

  test('ignores non-text stream events', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield { type: 'system', subtype: 'init', session_id: 's1' };
        yield {
          type: 'stream_event',
          event: { type: 'content_block_start', content_block: { type: 'text' } },
        };
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'only this' },
          },
        };
        yield {
          type: 'stream_event',
          event: { type: 'content_block_stop' },
        };
      })()
    );

    const events: Array<{ type: string }> = [];
    for await (const event of streamClaude({ prompt: 'test' })) {
      events.push(event);
    }

    // Should only have session + one text-delta (ignoring start/stop)
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('session');
    expect(events[1].type).toBe('text-delta');
  });
});

describe('Chat Route - POST /chat', () => {
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    mockQuery.mockReset();
    testApp = new Hono();
    testApp.route('/api/chat', chatRouter);
  });

  test('returns streaming response for valid chat request', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield { type: 'system', subtype: 'init', session_id: 'chat-session-1' };
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hi there!' },
          },
        };
      })()
    );

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
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

  test('extracts last user message as prompt', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield { type: 'system', subtype: 'init', session_id: 's1' };
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

  test('uses resume option when sessionId is provided', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield { type: 'system', subtype: 'init', session_id: 'resumed' };
      })()
    );

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'follow up' }],
      sessionId: 'previous-session-id',
    };

    await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.resume).toBe('previous-session-id');
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

  test('includes sessionId in the stream metadata', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield { type: 'system', subtype: 'init', session_id: 'metadata-session' };
        yield {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'test' },
          },
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

  test('handles stream errors gracefully', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield { type: 'system', subtype: 'init', session_id: 'err-session' };
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
