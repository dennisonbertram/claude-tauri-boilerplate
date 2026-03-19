import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { generateContextSummary } from './context-summary';

const FAKE_KEY = 'sk-ant-fake-key-for-testing';

const TWO_MESSAGES = [
  { role: 'user', content: 'Why is my React component re-rendering?' },
  { role: 'assistant', content: 'This is likely caused by an unstable reference.' },
];

// Helper: build a fake query function that yields the given events
function makeQueryFn(events: unknown[]) {
  return (_opts: unknown) =>
    (async function* () {
      for (const event of events) yield event;
    })();
}

describe('generateContextSummary', () => {
  let envAtQueryCall: string | undefined;

  beforeEach(() => {
    envAtQueryCall = undefined;
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });

  test('returns the summary text from SDK result', async () => {
    const queryFn = makeQueryFn([
      { type: 'result', subtype: 'success', result: 'Debugging a React render loop' },
    ]);
    const result = await generateContextSummary(TWO_MESSAGES, undefined, queryFn as any);
    expect(result).toBe('Debugging a React render loop');
  });

  test('returns null when SDK returns empty result', async () => {
    const queryFn = makeQueryFn([{ type: 'result', subtype: 'success', result: '' }]);
    const result = await generateContextSummary(TWO_MESSAGES, undefined, queryFn as any);
    expect(result).toBeNull();
  });

  test('returns null when SDK emits no result event', async () => {
    const queryFn = makeQueryFn([{ type: 'system', subtype: 'init', session_id: 'abc' }]);
    const result = await generateContextSummary(TWO_MESSAGES, undefined, queryFn as any);
    expect(result).toBeNull();
  });

  test('clears ANTHROPIC_API_KEY during query call', async () => {
    const queryFn = (_opts: unknown) => {
      envAtQueryCall = process.env.ANTHROPIC_API_KEY;
      return (async function* () {
        yield { type: 'result', subtype: 'success', result: 'test' };
      })();
    };
    await generateContextSummary(TWO_MESSAGES, undefined, queryFn as any);
    expect(envAtQueryCall).toBe('');
  });

  test('restores ANTHROPIC_API_KEY after completion', async () => {
    const queryFn = makeQueryFn([
      { type: 'result', subtype: 'success', result: 'Debugging React hooks' },
    ]);
    await generateContextSummary(TWO_MESSAGES, undefined, queryFn as any);
    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });

  test('restores ANTHROPIC_API_KEY even when query throws', async () => {
    const queryFn = (_opts: unknown) =>
      (async function* () {
        throw new Error('SDK error');
        yield; // unreachable but needed for generator type
      })();
    try {
      await generateContextSummary(TWO_MESSAGES, undefined, queryFn as any);
    } catch {
      // expected
    }
    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });

  test('caps summary at 80 characters', async () => {
    const longSummary = 'A'.repeat(100);
    const queryFn = makeQueryFn([{ type: 'result', subtype: 'success', result: longSummary }]);
    const result = await generateContextSummary(TWO_MESSAGES, undefined, queryFn as any);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(80);
  });

  test('trims whitespace from summary', async () => {
    const queryFn = makeQueryFn([
      { type: 'result', subtype: 'success', result: '  Debugging hooks  ' },
    ]);
    const result = await generateContextSummary(TWO_MESSAGES, undefined, queryFn as any);
    expect(result).toBe('Debugging hooks');
  });
});
