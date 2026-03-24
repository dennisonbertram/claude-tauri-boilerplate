import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getGoogleOAuth } from '../../db';
import { classifyGoogleError } from '../../services/google/auth';
import { getDocContent } from '../../services/google/docs';

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
        classified.status as 400 | 401 | 403 | 404 | 429 | 500 | 502
      );
    }
  });

  return router;
}
