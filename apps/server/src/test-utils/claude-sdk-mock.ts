import { mock } from 'bun:test';

type QueryArgs = { options?: { env?: Record<string, unknown> } };

function defaultStream() {
  return (async function* () {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: 'test-session',
      model: 'claude-opus-4-6',
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
}

const globalState = globalThis as typeof globalThis & {
  __claudeSdkMockInstalled?: boolean;
  __claudeSdkMockQuery?: ReturnType<typeof mock<(args?: QueryArgs) => AsyncGenerator<unknown>>>;
};

export const mockQuery =
  globalState.__claudeSdkMockQuery ??
  (globalState.__claudeSdkMockQuery = mock((_args?: QueryArgs) => defaultStream()));

if (!globalState.__claudeSdkMockInstalled) {
  mock.module('@anthropic-ai/claude-agent-sdk', () => ({
    query: mockQuery,
  }));
  globalState.__claudeSdkMockInstalled = true;
}
