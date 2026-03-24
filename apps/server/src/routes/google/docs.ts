import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getGoogleOAuth } from '../../db';
import { classifyGoogleError } from '../../services/google/auth';
import { getDocContent } from '../../services/google/docs';

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

export function createDocsRouter(db: Database) {
  const router = new Hono();

  // ----- GET /:id -----
  router.get('/:id', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const docId = c.req.param('id');

    try {
      const content = await getDocContent(db, docId);
      return c.json(content);
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
