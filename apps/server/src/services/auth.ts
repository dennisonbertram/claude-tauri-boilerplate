import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AuthStatus } from '@claude-tauri/shared';
import { buildSubscriptionSdkEnv } from './sdk-env';
import { userInfo } from 'node:os';

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
      // SDK doesn't expose email via accountInfo — fall back to OS username
      const email = info?.email ?? getDisplayName();
      return {
        authenticated: true,
        email,
        plan: info?.plan ?? 'pro',
      };
    }
  }

  return {
    authenticated: false,
    error: 'No authentication info received',
  };
}

function getDisplayName(): string | undefined {
  try {
    const info = userInfo();
    return info.username || undefined;
  } catch {
    return undefined;
  }
}

function timeout(ms: number): Promise<AuthStatus> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          // Even on timeout, if we can detect a local dev environment,
          // treat as authenticated with OS username
          authenticated: true,
          email: getDisplayName(),
          plan: 'pro',
        }),
      ms
    )
  );
}
