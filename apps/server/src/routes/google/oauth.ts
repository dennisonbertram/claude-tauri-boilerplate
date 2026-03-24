import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { z } from 'zod';
import {
  getGoogleOAuth,
  upsertGoogleOAuth,
  clearGoogleOAuth,
  updateGoogleOAuthTokens,
  setGoogleOAuthError,
} from '../../db';
import { createOAuth2Client, GOOGLE_SCOPES, classifyGoogleError } from '../../services/google/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingAuth = {
  createdAt: number;
  codeVerifier: string;
  attemptId: string;
};

type AuthAttempt = {
  status: 'pending' | 'success' | 'denied' | 'expired' | 'error';
  error?: string;
};

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const pendingAuths = new Map<string, PendingAuth>();
const authAttempts = new Map<string, AuthAttempt>();
const STATE_TTL_MS = 15 * 60 * 1000;
const ATTEMPT_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowMs(): number {
  return Date.now();
}

function pruneStates(): void {
  const cutoff = nowMs() - STATE_TTL_MS;
  for (const [state, pending] of pendingAuths.entries()) {
    if (pending.createdAt < cutoff) {
      // Also expire its attempt
      const attempt = authAttempts.get(pending.attemptId);
      if (attempt && attempt.status === 'pending') {
        authAttempts.set(pending.attemptId, { status: 'expired' });
      }
      pendingAuths.delete(state);
    }
  }
}

function pruneAttempts(): void {
  const cutoff = nowMs() - ATTEMPT_TTL_MS;
  // We don't store createdAt on attempts directly, so prune completed ones after TTL
  // (pending ones are pruned via pruneStates)
  for (const [id, attempt] of authAttempts.entries()) {
    if (attempt.status !== 'pending') {
      // Keep for a while so frontend can poll, then clean up
      // We'll just keep a max size cap
      if (authAttempts.size > 100) {
        authAttempts.delete(id);
      }
    }
  }
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`Missing required env var: ${key}`);
}

function getRedirectUri(): string {
  const port = process.env.PORT || '3131';
  return `http://localhost:${port}/api/google/oauth/callback`;
}

async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  const codeVerifier = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { codeVerifier, codeChallenge };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1]!;
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}

function successHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Auth — Success</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
    .card { background: white; border-radius: 12px; padding: 2rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; }
    h1 { color: #1a73e8; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #5f6368; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Successful</h1>
    <p>You can close this window and return to the app.</p>
  </div>
  <script>history.replaceState(null, '', window.location.pathname);</script>
</body>
</html>`;
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Auth — Error</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
    .card { background: white; border-radius: 12px; padding: 2rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; }
    h1 { color: #d93025; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #5f6368; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Failed</h1>
    <p>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    <p>You can close this window and try again.</p>
  </div>
  <script>history.replaceState(null, '', window.location.pathname);</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createGoogleOAuthRouter(db: Database) {
  const router = new Hono();

  // ----- GET /status -----
  router.get('/status', (c) => {
    const configured = Boolean(process.env.GOOGLE_CLIENT_ID);
    const oauth = getGoogleOAuth(db);

    if (!oauth) {
      return c.json({
        connected: false,
        configured,
      });
    }

    const grantedSet = new Set(
      oauth.grantedScopes ? oauth.grantedScopes.split(' ').filter(Boolean) : []
    );

    // Google returns full URIs for shorthand scopes, so we need equivalence mapping
    const SCOPE_ALIASES: Record<string, string[]> = {
      email: ['email', 'https://www.googleapis.com/auth/userinfo.email'],
      profile: ['profile', 'https://www.googleapis.com/auth/userinfo.profile'],
    };

    const requiredScopes = GOOGLE_SCOPES;
    const missingScopes = requiredScopes.filter((s) => {
      if (grantedSet.has(s)) return false;
      // Check aliases — e.g. "email" is satisfied by "userinfo.email"
      const aliases = SCOPE_ALIASES[s];
      if (aliases) return !aliases.some((alias) => grantedSet.has(alias));
      return true;
    });

    const needsReauth =
      missingScopes.length > 0 ||
      Boolean(
        oauth.lastError &&
          (oauth.lastError.includes('revoked') ||
            oauth.lastError.includes('invalid_grant') ||
            oauth.lastError.includes('Token has been expired or revoked'))
      );

    return c.json({
      connected: Boolean(oauth.accessToken),
      configured,
      account: {
        email: oauth.email,
        name: oauth.name,
        picture: oauth.picture,
      },
      grantedScopes: oauth.grantedScopes ? oauth.grantedScopes.split(' ') : [],
      missingScopes: missingScopes.length > 0 ? missingScopes : undefined,
      expiresAt: oauth.expiresAt,
      needsReauth,
      lastError: oauth.lastError,
    });
  });

  // ----- GET /oauth/authorize-url -----
  router.get('/oauth/authorize-url', async (c) => {
    pruneStates();
    pruneAttempts();

    let clientId: string;
    try {
      clientId = requireEnv('GOOGLE_CLIENT_ID');
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Missing Google env', code: 'GOOGLE_ENV_MISSING' },
        500
      );
    }

    const state = crypto.randomUUID();
    const attemptId = crypto.randomUUID();
    const { codeVerifier, codeChallenge } = await generatePKCE();

    pendingAuths.set(state, { createdAt: nowMs(), codeVerifier, attemptId });
    authAttempts.set(attemptId, { status: 'pending' });

    const redirectUri = getRedirectUri();

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return c.json({ url: url.toString(), attemptId });
  });

  // ----- GET /oauth/callback -----
  const oauthCallbackSchema = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  });

  router.get('/oauth/callback', async (c) => {
    pruneStates();

    // Check for error param first (user denied)
    const errorParam = c.req.query('error');
    if (errorParam) {
      const state = c.req.query('state');
      if (state) {
        const pending = pendingAuths.get(state);
        if (pending) {
          authAttempts.set(pending.attemptId, {
            status: 'denied',
            error: errorParam,
          });
          pendingAuths.delete(state);
        }
      }
      return c.html(errorHtml('Access was denied. Please try again if you want to connect your Google account.'), 200, {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
    }

    const parsed = oauthCallbackSchema.safeParse({
      code: c.req.query('code'),
      state: c.req.query('state'),
    });

    if (!parsed.success) {
      return c.html(errorHtml('Invalid callback parameters.'), 400, {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
    }

    const { code, state } = parsed.data;

    const pending = pendingAuths.get(state);
    if (!pending) {
      return c.html(errorHtml('Invalid or expired OAuth state. Please try again.'), 400, {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
    }

    const { codeVerifier, attemptId } = pending;
    pendingAuths.delete(state);

    let clientId: string;
    let clientSecret: string;
    try {
      clientId = requireEnv('GOOGLE_CLIENT_ID');
      clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
    } catch (err) {
      authAttempts.set(attemptId, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Missing Google env vars',
      });
      return c.html(errorHtml('Server configuration error.'), 500, {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
    }

    const redirectUri = getRedirectUri();

    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      authAttempts.set(attemptId, {
        status: 'error',
        error: `Token exchange failed (${tokenRes.status})`,
      });
      return c.html(errorHtml('Token exchange failed. Please try again.'), 502, {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
    };

    if (!tokenJson.access_token) {
      authAttempts.set(attemptId, {
        status: 'error',
        error: 'No access token in response',
      });
      return c.html(errorHtml('No access token received from Google.'), 502, {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
    }

    if (!tokenJson.refresh_token) {
      authAttempts.set(attemptId, {
        status: 'error',
        error: 'No refresh token received. You may need to revoke access at https://myaccount.google.com/permissions and try again.',
      });
      return c.html(
        errorHtml(
          'No refresh token received. Please revoke this app at myaccount.google.com/permissions and reconnect.'
        ),
        502,
        {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        }
      );
    }

    // Decode ID token to get user info
    let sub = '';
    let email = '';
    let emailVerified = false;
    let name: string | undefined;
    let picture: string | undefined;

    if (tokenJson.id_token) {
      try {
        const payload = decodeJwtPayload(tokenJson.id_token);
        sub = (payload.sub as string) || '';
        email = (payload.email as string) || '';
        emailVerified = Boolean(payload.email_verified);
        name = (payload.name as string) || undefined;
        picture = (payload.picture as string) || undefined;
      } catch {
        // Fallback: fetch from userinfo endpoint
      }
    }

    // Fallback to userinfo if id_token didn't yield email
    if (!email) {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        });
        if (userInfoRes.ok) {
          const userInfo = (await userInfoRes.json()) as Record<string, unknown>;
          sub = (userInfo.sub as string) || sub;
          email = (userInfo.email as string) || email;
          emailVerified = Boolean(userInfo.email_verified);
          name = (userInfo.name as string) || name;
          picture = (userInfo.picture as string) || picture;
        }
      } catch {
        // non-fatal
      }
    }

    const expiresAt =
      typeof tokenJson.expires_in === 'number'
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : undefined;

    upsertGoogleOAuth(db, {
      googleSub: sub,
      email,
      emailVerified,
      name,
      picture,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      tokenType: tokenJson.token_type,
      grantedScopes: tokenJson.scope,
      expiresAt,
    });

    authAttempts.set(attemptId, { status: 'success' });

    return c.html(successHtml(), 200, {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    });
  });

  // ----- GET /oauth/attempt-status/:attemptId -----
  router.get('/oauth/attempt-status/:attemptId', (c) => {
    const attemptId = c.req.param('attemptId');
    const attempt = authAttempts.get(attemptId);

    if (!attempt) {
      return c.json({ status: 'expired' });
    }

    return c.json({
      status: attempt.status,
      error: attempt.error,
    });
  });

  // ----- POST /disconnect -----
  router.post('/disconnect', async (c) => {
    const oauth = getGoogleOAuth(db);

    if (oauth?.refreshToken) {
      // Best-effort revoke at Google
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(oauth.refreshToken)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
      } catch {
        // non-fatal
      }
    }

    clearGoogleOAuth(db);
    return c.json({ connected: false });
  });

  // ----- POST /refresh -----
  router.post('/refresh', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.refreshToken) {
      return c.json({ error: 'No refresh token available', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    let clientId: string;
    let clientSecret: string;
    try {
      clientId = requireEnv('GOOGLE_CLIENT_ID');
      clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Missing Google env', code: 'GOOGLE_ENV_MISSING' },
        500
      );
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: oauth.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      setGoogleOAuthError(db, `Token refresh failed (${tokenRes.status}): ${errText}`);
      return c.json(
        { error: `Token refresh failed (${tokenRes.status})`, code: 'GOOGLE_UPSTREAM_ERROR' },
        502
      );
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenJson.access_token) {
      return c.json(
        { error: 'No access token in refresh response', code: 'GOOGLE_UPSTREAM_ERROR' },
        502
      );
    }

    const expiresAt =
      typeof tokenJson.expires_in === 'number'
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : undefined;

    updateGoogleOAuthTokens(db, tokenJson.access_token, expiresAt, tokenJson.refresh_token);

    return c.json({ ok: true, expiresAt });
  });

  return router;
}
