import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getGoogleOAuth } from '../../db';
import { classifyGoogleError } from '../../services/google/auth';
import { listMessages, getMessage, sendMessage } from '../../services/google/gmail';

function codeToHttpStatus(code: string): 400 | 401 | 403 | 404 | 429 | 500 | 502 {
  switch (code) {
    case 'not_found': return 404;
    case 'forbidden': return 403;
    case 'unauthorized': return 401;
    case 'rate_limited': return 429;
    case 'invalid_grant': return 401;
    case 'server_error': return 502;
    default: return 500;
  }
}

export function createGmailRouter(db: Database) {
  const router = new Hono();

  // ----- GET /messages -----
  router.get('/messages', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const q = c.req.query('q') ?? '';
    const pageToken = c.req.query('pageToken');
    const maxResults = Math.min(Math.max(Number(c.req.query('maxResults') ?? 20), 1), 100);

    try {
      const result = await listMessages(db, q || undefined, pageToken ?? undefined, maxResults);
      return c.json(result);
    } catch (err) {
      const classified = classifyGoogleError(err);
      return c.json(
        {
          error: classified.message,
          code: classified.code,
          provider: 'google',
          retryable: classified.retryable,
          needsReconnect: classified.needsReconnect,
        },
        codeToHttpStatus(classified.code),
      );
    }
  });

  // ----- GET /messages/:id -----
  router.get('/messages/:id', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const id = c.req.param('id');

    try {
      const message = await getMessage(db, id);
      return c.json(message);
    } catch (err) {
      const classified = classifyGoogleError(err);
      return c.json(
        {
          error: classified.message,
          code: classified.code,
          provider: 'google',
          retryable: classified.retryable,
          needsReconnect: classified.needsReconnect,
        },
        codeToHttpStatus(classified.code),
      );
    }
  });

  // ----- POST /send -----
  router.post('/send', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const body = await c.req.json<{
      to: string;
      subject: string;
      body: string;
      threadId?: string;
    }>();

    if (!body.to || !body.subject || !body.body) {
      return c.json(
        { error: 'Missing required fields: to, subject, body', code: 'VALIDATION_ERROR' },
        400
      );
    }

    try {
      const result = await sendMessage(db, body.to, body.subject, body.body, body.threadId);
      return c.json(result);
    } catch (err) {
      const classified = classifyGoogleError(err);
      return c.json(
        {
          error: classified.message,
          code: classified.code,
          provider: 'google',
          retryable: classified.retryable,
          needsReconnect: classified.needsReconnect,
        },
        codeToHttpStatus(classified.code),
      );
    }
  });

  return router;
}
