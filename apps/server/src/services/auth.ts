import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AuthStatus } from '@claude-tauri/shared';

const AUTH_TIMEOUT_MS = 10_000;

export async function getAuthStatus(): Promise<AuthStatus> {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = '';

  try {
    const result = await Promise.race([
      detectAuth(),
      timeout(AUTH_TIMEOUT_MS),
    ]);
    return result;
  } catch (err) {
    return {
      authenticated: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    process.env.ANTHROPIC_API_KEY = savedKey ?? '';
  }
}

async function detectAuth(): Promise<AuthStatus> {
  const stream = query({
    prompt: 'OK',
    options: { maxTurns: 1 },
  });

  for await (const event of stream) {
    if (event.type === 'system' && event.subtype === 'init') {
      const info = (event as any).accountInfo;
      return {
        authenticated: true,
        email: info?.email,
        plan: info?.plan ?? 'pro',
      };
    }
  }

  return {
    authenticated: false,
    error: 'No authentication info received',
  };
}

function timeout(ms: number): Promise<AuthStatus> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          authenticated: false,
          error: `Auth check timed out after ${ms / 1000}s`,
        }),
      ms
    )
  );
}
