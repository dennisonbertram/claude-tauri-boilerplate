import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { Database } from 'bun:sqlite';
import {
  getGoogleOAuth,
  updateGoogleOAuthTokens,
  setGoogleOAuthError,
  clearGoogleOAuth,
} from '../../db';

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive',
];

// ---------------------------------------------------------------------------
// OAuth2 client factory
// ---------------------------------------------------------------------------

export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment',
    );
  }

  const port = process.env.PORT || '3131';
  const redirectUri = `http://localhost:${port}/api/google/oauth/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ---------------------------------------------------------------------------
// Authenticated client (credentials from DB)
// ---------------------------------------------------------------------------

export function getAuthenticatedClient(db: Database): OAuth2Client {
  const record = getGoogleOAuth(db);
  if (!record) {
    throw new Error('No Google OAuth credentials stored — user must connect first');
  }

  const client = createOAuth2Client();

  client.setCredentials({
    access_token: record.accessToken,
    refresh_token: record.refreshToken ?? undefined,
    token_type: record.tokenType ?? 'Bearer',
    expiry_date: record.expiresAt ? new Date(record.expiresAt).getTime() : undefined,
  });

  // Persist any automatically-refreshed tokens back to DB.
  // NEVER overwrite refresh_token with null.
  client.on('tokens', (tokens) => {
    updateGoogleOAuthTokens(
      db,
      tokens.access_token ?? record.accessToken,
      tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : undefined,
      tokens.refresh_token ?? undefined, // undefined => DB helper won't overwrite
    );
  });

  return client;
}

// ---------------------------------------------------------------------------
// Proactive refresh
// ---------------------------------------------------------------------------

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes

export async function refreshTokenIfNeeded(db: Database): Promise<void> {
  const record = getGoogleOAuth(db);
  if (!record) return;

  if (!record.expiresAt) return; // no expiry info, rely on auto-refresh

  const expiresAtMs = new Date(record.expiresAt).getTime();
  if (Date.now() + REFRESH_MARGIN_MS < expiresAtMs) return; // still fresh

  const client = getAuthenticatedClient(db);
  try {
    const { credentials } = await client.refreshAccessToken();
    updateGoogleOAuthTokens(
      db,
      credentials.access_token ?? record.accessToken,
      credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : undefined,
      credentials.refresh_token ?? undefined,
    );
  } catch (err) {
    if (isAuthRevoked(err)) {
      setGoogleOAuthError(db, 'Refresh token revoked (invalid_grant)');
      clearGoogleOAuth(db);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Returns true ONLY for `invalid_grant` errors which mean the refresh token
 * has been revoked or is otherwise permanently invalid.
 */
export function isAuthRevoked(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const msg = String((error as any).message ?? '');
  const code = (error as any).code;
  // Google returns "invalid_grant" in the error description when the
  // refresh token is revoked, expired, or the user removed access.
  if (msg.includes('invalid_grant')) return true;
  if (code === 'invalid_grant') return true;
  // Check nested response body
  const responseData = (error as any).response?.data;
  if (responseData?.error === 'invalid_grant') return true;
  return false;
}

/**
 * Returns true for 429 / rateLimitExceeded errors.
 */
export function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as any).code ?? (error as any).status;
  if (status === 429) return true;
  const errors: any[] = (error as any).errors ?? (error as any).response?.data?.error?.errors ?? [];
  return errors.some(
    (e: any) =>
      e.reason === 'rateLimitExceeded' || e.reason === 'userRateLimitExceeded',
  );
}

export interface ClassifiedError {
  code: string;
  message: string;
  retryable: boolean;
  needsReconnect: boolean;
}

/**
 * Classify a Google API error into an actionable shape.
 *
 * Key principle: only `invalid_grant` on refresh triggers `needsReconnect`.
 * 403 insufficientPermissions, rateLimitExceeded, 404, etc. do NOT disconnect.
 */
export function classifyGoogleError(error: unknown): ClassifiedError {
  if (!error || typeof error !== 'object') {
    return {
      code: 'unknown',
      message: String(error),
      retryable: false,
      needsReconnect: false,
    };
  }

  const err = error as any;
  const status: number | undefined = err.code ?? err.status;
  const msg = String(err.message ?? 'Unknown Google API error');

  // Auth revoked — the ONLY case that needs reconnect
  if (isAuthRevoked(error)) {
    return { code: 'invalid_grant', message: msg, retryable: false, needsReconnect: true };
  }

  // Rate limited — retryable
  if (isRateLimited(error)) {
    return { code: 'rate_limited', message: msg, retryable: true, needsReconnect: false };
  }

  // Insufficient permissions — NOT a disconnect
  if (status === 403) {
    return { code: 'forbidden', message: msg, retryable: false, needsReconnect: false };
  }

  // Not found
  if (status === 404) {
    return { code: 'not_found', message: msg, retryable: false, needsReconnect: false };
  }

  // 401 but not invalid_grant — token may have just expired, retryable once
  if (status === 401) {
    return { code: 'unauthorized', message: msg, retryable: true, needsReconnect: false };
  }

  // Server errors — retryable
  if (typeof status === 'number' && status >= 500) {
    return { code: 'server_error', message: msg, retryable: true, needsReconnect: false };
  }

  return { code: 'unknown', message: msg, retryable: false, needsReconnect: false };
}
