import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { getSession, getThreadMessages } from '../db';

// ─── Session thread route: GET /api/sessions/:sessionId/thread ────────────────

export function createSessionThreadRouter(db: Database) {
  const router = new Hono();

  // GET /api/sessions/:sessionId/thread — return ThreadMessage[] with parts
  // Returns 404 if the session does not exist.
  // Returns 200 with an array of ThreadMessage objects.
  // Legacy messages without explicit message_parts get a synthesized text part.
  router.get('/:sessionId/thread', (c) => {
    const sessionId = c.req.param('sessionId');

    const session = getSession(db, sessionId);
    if (!session) {
      return c.json({ error: 'Session not found', code: 'NOT_FOUND' }, 404);
    }

    const threadMessages = getThreadMessages(db, sessionId);
    return c.json(threadMessages);
  });

  return router;
}
