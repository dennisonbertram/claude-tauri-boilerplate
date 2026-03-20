import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { generateSessionTitle } from './auto-namer-impl';

const FAKE_KEY = 'sk-ant-fake-key-for-testing';

function makeQueryFn(events: unknown[]) {
  return (_opts: unknown) =>
    (async function* () {
      for (const event of events) yield event;
    })();
}

describe('generateSessionTitle - subscription auth regression', () => {
  let envAtQueryCall: string | undefined;

  beforeEach(() => {
    envAtQueryCall = undefined;
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });

  test('passes a request-scoped blank ANTHROPIC_API_KEY and leaves process.env unchanged', async () => {
    const queryFn = (opts: any) => {
      envAtQueryCall = opts?.options?.env?.ANTHROPIC_API_KEY;
      return (async function* () {
        yield { type: 'result', subtype: 'success', result: 'Test Title' };
      })();
    };

    await generateSessionTitle([{ role: 'user', content: 'hello' }], undefined, queryFn as any);

    expect(envAtQueryCall).toBe('');
    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });

  test('leaves process.env unchanged even when query throws', async () => {
    const queryFn = (opts: any) =>
      (async function* () {
        envAtQueryCall = opts?.options?.env?.ANTHROPIC_API_KEY;
        throw new Error('SDK error');
      })();

    try {
      await generateSessionTitle([{ role: 'user', content: 'hello' }], undefined, queryFn as any);
    } catch {
      // expected
    }

    expect(envAtQueryCall).toBe('');
    expect(process.env.ANTHROPIC_API_KEY).toBe(FAKE_KEY);
  });

  test('returns a trimmed title capped at 60 characters', async () => {
    const longTitle = `  ${'A'.repeat(80)}  `;
    const result = await generateSessionTitle(
      [{ role: 'user', content: 'hello' }],
      undefined,
      makeQueryFn([{ type: 'result', subtype: 'success', result: longTitle }]) as any
    );

    expect(result.length).toBe(60);
    expect(result).toBe('A'.repeat(60));
  });
});
