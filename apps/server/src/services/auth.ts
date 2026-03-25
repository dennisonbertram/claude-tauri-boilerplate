import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AuthStatus } from '@claude-tauri/shared';
import { buildSubscriptionSdkEnv } from './sdk-env';

const AUTH_TIMEOUT_MS = 10_000;

export async function getAuthStatus(): Promise<AuthStatus> {
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
  }
}

async function detectAuth(): Promise<AuthStatus> {
  const stream = query({
    prompt: 'OK',
    options: {
      maxTurns: 1,
      env: buildSubscriptionSdkEnv(),
    },
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
          error: `Auth check timed out after ${Math.round(ms / 1000)}s`,
        }),
      ms
    )
  );
}
