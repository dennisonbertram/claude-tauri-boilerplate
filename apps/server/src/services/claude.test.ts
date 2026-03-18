import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

type EnvSnapshot = Record<string, string | undefined>;

// Capture the env values at the moment query() is called
let envAtQueryCall: EnvSnapshot | undefined;

const FAKE_KEY = 'sk-ant-fake-key-for-testing';
const providerEnvKeys = [
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'ANTHROPIC_BASE_URL',
  'RUNTIME_TOKEN',
];

function captureProviderEnv(): EnvSnapshot {
  return providerEnvKeys.reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {} as EnvSnapshot);
}

function setKnownProviderEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function resetProviderEnv() {
  setKnownProviderEnv('ANTHROPIC_API_KEY', FAKE_KEY);
  setKnownProviderEnv('CLAUDE_CODE_USE_BEDROCK', undefined);
  setKnownProviderEnv('CLAUDE_CODE_USE_VERTEX', undefined);
  setKnownProviderEnv('ANTHROPIC_BEDROCK_BASE_URL', undefined);
  setKnownProviderEnv('ANTHROPIC_VERTEX_BASE_URL', undefined);
  setKnownProviderEnv('ANTHROPIC_VERTEX_PROJECT_ID', undefined);
  setKnownProviderEnv('ANTHROPIC_BASE_URL', undefined);
  setKnownProviderEnv('RUNTIME_TOKEN', undefined);
}

function snapshotMatches(expected: EnvSnapshot) {
  expect(envAtQueryCall).toMatchObject(expected);
}

const mockQuery = mock(() => {
  envAtQueryCall = captureProviderEnv();
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
  beforeEach(() => {
    mockQuery.mockReset();
    envAtQueryCall = undefined;
    resetProviderEnv();
    // Re-set the capture logic after reset
    mockQuery.mockImplementation(() => {
      envAtQueryCall = captureProviderEnv();
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
    resetProviderEnv();
  });

  test('clears ANTHROPIC_API_KEY to "" before calling query()', async () => {
    const gen = streamClaude({ prompt: 'hello' });
    // consume the stream
    for await (const _ of gen) { /* drain */ }

    expect(envAtQueryCall?.ANTHROPIC_API_KEY).toBe('');
  });

  test('restores ANTHROPIC_API_KEY after stream completes', async () => {
    const gen = streamClaude({ prompt: 'hello' });
    for await (const _ of gen) { /* drain */ }

    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });

  test('restores ANTHROPIC_API_KEY even when stream throws', async () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = '1';
    mockQuery.mockImplementation(() => {
      envAtQueryCall = captureProviderEnv();
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
    expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe('1');
  });

  test('uses Bedrock env variables when provider=bedrock', async () => {
    const gen = streamClaude({
      prompt: 'hello',
      provider: 'bedrock',
      providerConfig: {
        bedrockBaseUrl: 'https://bedrock.internal',
      },
    });
    for await (const _ of gen) { /* drain */ }

    snapshotMatches({
      ANTHROPIC_API_KEY: '',
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDE_CODE_USE_VERTEX: undefined,
      ANTHROPIC_BEDROCK_BASE_URL: 'https://bedrock.internal',
      ANTHROPIC_VERTEX_BASE_URL: undefined,
      ANTHROPIC_VERTEX_PROJECT_ID: undefined,
      ANTHROPIC_BASE_URL: undefined,
    });
  });

  test('uses Vertex env variables when provider=vertex', async () => {
    const gen = streamClaude({
      prompt: 'hello',
      provider: 'vertex',
      providerConfig: {
        vertexBaseUrl: 'https://vertex.internal',
        vertexProjectId: 'vertex-project',
      },
    });
    for await (const _ of gen) { /* drain */ }

    snapshotMatches({
      ANTHROPIC_API_KEY: '',
      CLAUDE_CODE_USE_BEDROCK: undefined,
      CLAUDE_CODE_USE_VERTEX: '1',
      ANTHROPIC_BEDROCK_BASE_URL: undefined,
      ANTHROPIC_VERTEX_BASE_URL: 'https://vertex.internal',
      ANTHROPIC_VERTEX_PROJECT_ID: 'vertex-project',
      ANTHROPIC_BASE_URL: undefined,
    });
  });

  test('uses custom base URL when provider=custom', async () => {
    const gen = streamClaude({
      prompt: 'hello',
      provider: 'custom',
      providerConfig: {
        customBaseUrl: 'https://gateway.internal',
      },
    });
    for await (const _ of gen) { /* drain */ }

    snapshotMatches({
      ANTHROPIC_API_KEY: '',
      CLAUDE_CODE_USE_BEDROCK: undefined,
      CLAUDE_CODE_USE_VERTEX: undefined,
      ANTHROPIC_BEDROCK_BASE_URL: undefined,
      ANTHROPIC_VERTEX_BASE_URL: undefined,
      ANTHROPIC_VERTEX_PROJECT_ID: undefined,
      ANTHROPIC_BASE_URL: 'https://gateway.internal',
    });
  });

  test('applies runtime environment variables for Claude stream', async () => {
    const gen = streamClaude({
      prompt: 'hello',
      runtimeEnv: {
        RUNTIME_TOKEN: 'token-123',
      },
    });
    for await (const _ of gen) { /* drain */ }

    expect(envAtQueryCall?.RUNTIME_TOKEN).toBe('token-123');
  });

  test('passes additional directories to query options when provided', async () => {
    const gen = streamClaude({
      prompt: 'hello',
      additionalDirectories: ['/repo-a', '/repo-b'],
    });
    for await (const _ of gen) { /* drain */ }

    expect((mockQuery.mock.calls[0]?.[0] as any).options.additionalDirectories).toEqual([
      '/repo-a',
      '/repo-b',
    ]);
  });

  test('restores custom runtime environment variables after streaming', async () => {
    process.env.RUNTIME_TOKEN = 'base';

    const gen = streamClaude({
      prompt: 'hello',
      runtimeEnv: {
        RUNTIME_TOKEN: 'token-123',
      },
    });
    for await (const _ of gen) { /* drain */ }

    expect(process.env.RUNTIME_TOKEN).toBe('base');
  });

  test('overwrites ANTHROPIC_API_KEY with runtime env value when explicitly provided', async () => {
    const gen = streamClaude({
      prompt: 'hello',
      runtimeEnv: {
        ANTHROPIC_API_KEY: 'explicit-key',
      },
    });
    for await (const _ of gen) { /* drain */ }

    expect(envAtQueryCall?.ANTHROPIC_API_KEY).toBe('explicit-key');
  });
});
