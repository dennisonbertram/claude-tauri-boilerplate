import { apiFetch } from './api-config';

export type GoogleStatus = {
  connected: boolean;
  configured: boolean;
  account?: {
    email: string;
    name?: string;
    picture?: string;
  };
  grantedScopes?: string[] | string;
  missingScopes?: string[];
  expiresAt?: string;
  needsReauth: boolean;
  lastError?: string;
};

export type GoogleAuthAttemptStatus = {
  status: 'pending' | 'success' | 'denied' | 'expired' | 'error';
  error?: string;
};

async function expectOk(res: Response): Promise<void> {
  if (res.ok) return;
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = String(body.error);
  } catch {
    // ignore
  }
  throw new Error(message);
}

export async function getStatus(): Promise<GoogleStatus> {
  const res = await apiFetch(`/api/google/status`);
  await expectOk(res);
  return (await res.json()) as GoogleStatus;
}

export async function getAuthorizeUrl(): Promise<{ url: string; attemptId: string }> {
  const res = await apiFetch(`/api/google/oauth/authorize-url`);
  await expectOk(res);
  return (await res.json()) as { url: string; attemptId: string };
}

export async function getAttemptStatus(attemptId: string): Promise<GoogleAuthAttemptStatus> {
  const res = await apiFetch(`/api/google/oauth/attempt-status/${encodeURIComponent(attemptId)}`);
  await expectOk(res);
  return (await res.json()) as GoogleAuthAttemptStatus;
}

export async function disconnect(): Promise<void> {
  const res = await apiFetch(`/api/google/disconnect`, { method: 'POST' });
  await expectOk(res);
}

/** Force-refresh the access token on the server */
export async function refreshToken(): Promise<void> {
  const res = await apiFetch(`/api/google/refresh`, { method: 'POST' });
  await expectOk(res);
}
