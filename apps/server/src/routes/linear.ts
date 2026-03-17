import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { z } from 'zod';
import { clearLinearOAuth, getLinearOAuth, upsertLinearOAuth } from '../db';

type LinearOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
};

type LinearIssueNode = {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  createdAt: string;
  url?: string | null;
};

const states = new Map<string, number>();
const STATE_TTL_MS = 15 * 60 * 1000;

function nowMs(): number {
  return Date.now();
}

function pruneStates() {
  const cutoff = nowMs() - STATE_TTL_MS;
  for (const [state, createdAt] of states.entries()) {
    if (createdAt < cutoff) states.delete(state);
  }
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`Missing required env var: ${key}`);
}

async function linearGraphql<T>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Linear GraphQL request failed (${res.status})`);
  }

  const json = (await res.json()) as any;
  if (json?.errors?.length) {
    throw new Error('Linear GraphQL returned errors');
  }

  return json.data as T;
}

function summarize(description?: string | null): string | undefined {
  if (!description) return undefined;
  const trimmed = description.trim();
  if (!trimmed) return undefined;
  return trimmed.split('\n')[0]?.slice(0, 280);
}

export function createLinearRouter(db: Database) {
  const router = new Hono();

  router.get('/status', (c) => {
    const oauth = getLinearOAuth(db);
    return c.json({ connected: Boolean(oauth?.accessToken) });
  });

  router.post('/disconnect', (c) => {
    clearLinearOAuth(db);
    return c.json({ connected: false });
  });

  router.get('/oauth/authorize-url', (c) => {
    pruneStates();
    let clientId = '';
    let redirectUri = '';
    try {
      clientId = requireEnv('LINEAR_CLIENT_ID');
      redirectUri = requireEnv('LINEAR_OAUTH_REDIRECT_URI');
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Missing Linear env', code: 'LINEAR_ENV_MISSING' },
        500
      );
    }
    const scopes = process.env.LINEAR_OAUTH_SCOPES?.trim() || 'read';

    const state = crypto.randomUUID();
    states.set(state, nowMs());

    const url = new URL('https://linear.app/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', state);

    return c.json({ url: url.toString() });
  });

  const oauthCallbackSchema = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  });

  router.get('/oauth/callback', async (c) => {
    const parsed = oauthCallbackSchema.safeParse({
      code: c.req.query('code'),
      state: c.req.query('state'),
    });
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid OAuth callback params',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        400
      );
    }

    pruneStates();
    if (!states.has(parsed.data.state)) {
      return c.json({ error: 'Invalid OAuth state', code: 'INVALID_STATE' }, 400);
    }
    states.delete(parsed.data.state);

    let clientId = '';
    let clientSecret = '';
    let redirectUri = '';
    try {
      clientId = requireEnv('LINEAR_CLIENT_ID');
      clientSecret = requireEnv('LINEAR_CLIENT_SECRET');
      redirectUri = requireEnv('LINEAR_OAUTH_REDIRECT_URI');
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Missing Linear env', code: 'LINEAR_ENV_MISSING' },
        500
      );
    }

    const tokenRes = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: parsed.data.code,
      }),
    });

    if (!tokenRes.ok) {
      return c.json(
        { error: `Token exchange failed (${tokenRes.status})`, code: 'LINEAR_UPSTREAM_ERROR' },
        502
      );
    }

    const tokenJson = (await tokenRes.json()) as LinearOAuthTokenResponse;
    if (!tokenJson?.access_token) {
      return c.json(
        { error: 'Token exchange missing access_token', code: 'LINEAR_UPSTREAM_ERROR' },
        502
      );
    }

    const expiresAt =
      typeof tokenJson.expires_in === 'number'
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : undefined;

    upsertLinearOAuth(db, {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      tokenType: tokenJson.token_type,
      scope: tokenJson.scope,
      expiresAt,
    });

    return c.json({ ok: true });
  });

  router.get('/issues', async (c) => {
    const oauth = getLinearOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Linear is not connected', code: 'LINEAR_NOT_CONNECTED' }, 401);
    }
    const accessToken = oauth.accessToken;
    const query = (c.req.query('q') ?? '').trim();
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 25), 1), 50);

    const gql = query.length
      ? `
        query Issues($query: String!, $first: Int!) {
          issues(
            first: $first,
            filter: {
              or: [
                { title: { containsIgnoreCase: $query } },
                { identifier: { containsIgnoreCase: $query } }
              ]
            }
          ) {
            nodes {
              id
              identifier
              title
              description
              createdAt
              url
            }
          }
        }
      `
      : `
        query Issues($first: Int!) {
          issues(first: $first) {
            nodes {
              id
              identifier
              title
              description
              createdAt
              url
            }
          }
        }
      `;

    let data: { issues: { nodes: LinearIssueNode[] } };
    try {
      data = await linearGraphql<{ issues: { nodes: LinearIssueNode[] } }>(
        accessToken,
        gql,
        query.length ? { query, first: limit } : { first: limit }
      );
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Linear upstream error', code: 'LINEAR_UPSTREAM_ERROR' },
        502
      );
    }

    const issues = (data.issues?.nodes ?? [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((issue) => ({
        id: issue.identifier,
        title: issue.title,
        summary: summarize(issue.description),
        url: issue.url ?? undefined,
        createdAt: issue.createdAt,
      }));

    return c.json({ issues });
  });

  router.get('/issues/:identifier', async (c) => {
    const oauth = getLinearOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Linear is not connected', code: 'LINEAR_NOT_CONNECTED' }, 401);
    }
    const accessToken = oauth.accessToken;
    const identifier = c.req.param('identifier');

    const gql = `
      query IssueByIdentifier($identifier: String!) {
        issues(first: 1, filter: { identifier: { eq: $identifier } }) {
          nodes {
            id
            identifier
            title
            description
            createdAt
            url
          }
        }
      }
    `;

    let data: { issues: { nodes: LinearIssueNode[] } };
    try {
      data = await linearGraphql<{ issues: { nodes: LinearIssueNode[] } }>(
        accessToken,
        gql,
        { identifier }
      );
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Linear upstream error', code: 'LINEAR_UPSTREAM_ERROR' },
        502
      );
    }

    const issue = data.issues?.nodes?.[0];
    if (!issue) {
      return c.json({ error: 'Linear issue not found', code: 'NOT_FOUND' }, 404);
    }

    return c.json({
      id: issue.identifier,
      title: issue.title,
      summary: summarize(issue.description),
      url: issue.url ?? undefined,
      createdAt: issue.createdAt,
    });
  });

  return router;
}
