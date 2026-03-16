import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

let envAtQueryCall: string | undefined;

const mockQuery = mock(() => {
  envAtQueryCall = process.env.ANTHROPIC_API_KEY;
  return (async function* () {
    yield {
      type: 'result',
      subtype: 'success',
      result: 'Test Session Title',
    };
  })();
});

mock.module('@anthropic-ai/claude-agent-sdk', () => ({ query: mockQuery }));

const { generateSessionTitle } = await import('./auto-namer');

describe('generateSessionTitle - subscription auth regression', () => {
  const FAKE_KEY = 'sk-ant-fake-key-for-testing';

  beforeEach(() => {
    mockQuery.mockReset();
    envAtQueryCall = undefined;
    mockQuery.mockImplementation(() => {
      envAtQueryCall = process.env.ANTHROPIC_API_KEY;
      return (async function* () {
        yield { type: 'result', subtype: 'success', result: 'Test Title' };
      })();
    });
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });

  test('clears ANTHROPIC_API_KEY to "" before calling query()', async () => {
    await generateSessionTitle([{ role: 'user', content: 'hello' }]);
    expect(envAtQueryCall).toBe('');
  });

  test('restores ANTHROPIC_API_KEY after completion', async () => {
    await generateSessionTitle([{ role: 'user', content: 'hello' }]);
    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });

  test('restores ANTHROPIC_API_KEY even when query throws', async () => {
    mockQuery.mockImplementation(() => {
      envAtQueryCall = process.env.ANTHROPIC_API_KEY;
      return (async function* () {
        throw new Error('SDK error');
      })();
    });

    try {
      await generateSessionTitle([{ role: 'user', content: 'hello' }]);
    } catch {
      // expected
    }

    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });
});
