import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import {
  createSession,
  listSessions,
  getSession,
  getMessages,
  deleteSession,
} from '../db';

const createSessionSchema = z.object({
  title: z.string().max(500).optional(),
});

export function createSessionsRouter(db: Database) {
  const router = new Hono();

  router.get('/', (c) => {
    const sessions = listSessions(db);
    return c.json(sessions);
  });

  router.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));

    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error('Invalid session data');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = parsed.error.flatten();
      throw err;
    }

    const id = crypto.randomUUID();
    const session = createSession(db, id, parsed.data.title);
    return c.json(session, 201);
  });

  router.get('/:id/messages', (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }
    const messages = getMessages(db, id);
    return c.json(messages);
  });

  router.delete('/:id', (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }
    deleteSession(db, id);
    return c.json({ ok: true });
  });

  return router;
}
