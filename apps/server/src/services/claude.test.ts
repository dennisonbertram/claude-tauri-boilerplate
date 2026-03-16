import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// Capture the env value at the moment query() is called
let envAtQueryCall: string | undefined;

const mockQuery = mock(() => {
  envAtQueryCall = process.env.ANTHROPIC_API_KEY;
  return (async function* () {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: 'test-session',
      model: 'claude-sonnet-4-6',
      tools: [],
      mcp_servers: [],
      claude_code_version: '1.0.0',
      cwd: '/tmp',
      permissionMode: 'default',
      apiKeySource: 'claude_ai',
      slash_commands: [],
      output_style: 'text',
      skills: [],
      plugins: [],
    };
  })();
});

mock.module('@anthropic-ai/claude-agent-sdk', () => ({ query: mockQuery }));

const { streamClaude } = await import('./claude');

describe('streamClaude - subscription auth regression', () => {
  const FAKE_KEY = 'sk-ant-fake-key-for-testing';

  beforeEach(() => {
    mockQuery.mockReset();
    envAtQueryCall = undefined;
    // Re-set the capture logic after reset
    mockQuery.mockImplementation(() => {
      envAtQueryCall = process.env.ANTHROPIC_API_KEY;
      return (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session',
          model: 'claude-sonnet-4-6',
          tools: [],
          mcp_servers: [],
          claude_code_version: '1.0.0',
          cwd: '/tmp',
          permissionMode: 'default',
          apiKeySource: 'claude_ai',
          slash_commands: [],
          output_style: 'text',
          skills: [],
          plugins: [],
        };
      })();
    });
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });

  test('clears ANTHROPIC_API_KEY to "" before calling query()', async () => {
    const gen = streamClaude({ prompt: 'hello' });
    // consume the stream
    for await (const _ of gen) { /* drain */ }

    expect(envAtQueryCall).toBe('');
  });

  test('restores ANTHROPIC_API_KEY after stream completes', async () => {
    const gen = streamClaude({ prompt: 'hello' });
    for await (const _ of gen) { /* drain */ }

    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });

  test('restores ANTHROPIC_API_KEY even when stream throws', async () => {
    mockQuery.mockImplementation(() => {
      envAtQueryCall = process.env.ANTHROPIC_API_KEY;
      return (async function* () {
        throw new Error('SDK error');
      })();
    });

    const gen = streamClaude({ prompt: 'hello' });
    try {
      for await (const _ of gen) { /* drain */ }
    } catch {
      // expected
    }

    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });
});
