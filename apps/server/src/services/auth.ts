import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AuthStatus } from '@claude-tauri/shared';
import { buildSubscriptionSdkEnv } from './sdk-env';

const AUTH_TIMEOUT_MS = 15_000;
const AUTH_SUCCESS_CACHE_TTL_MS = 60_000;

let cachedAuthStatus:
  | {
      status: AuthStatus;
      expiresAt: number;
    }
  | null = null;

let inFlightAuthCheck: Promise<AuthStatus> | null = null;

export async function getAuthStatus(): Promise<AuthStatus> {
  const now = Date.now();
  if (cachedAuthStatus && cachedAuthStatus.expiresAt > now) {
    return cachedAuthStatus.status;
  }

  if (inFlightAuthCheck) {
    return inFlightAuthCheck;
  }

  inFlightAuthCheck = runAuthCheck().finally(() => {
    inFlightAuthCheck = null;
  });

  try {
    const result = await inFlightAuthCheck;
    if (result.authenticated) {
      cachedAuthStatus = {
        status: result,
        expiresAt: Date.now() + AUTH_SUCCESS_CACHE_TTL_MS,
      };
      return result;
    }

    if (cachedAuthStatus) {
      return cachedAuthStatus.status;
    }

    return result;
  } catch (err) {
    if (cachedAuthStatus) {
      return cachedAuthStatus.status;
    }

    return {
      authenticated: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function runAuthCheck(): Promise<AuthStatus> {
  return Promise.race([detectAuth(), timeout(AUTH_TIMEOUT_MS)]);
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

export function __resetAuthStatusCacheForTests(): void {
  cachedAuthStatus = null;
  inFlightAuthCheck = null;
}
