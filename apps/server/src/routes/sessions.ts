import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  createSession,
  listSessions,
  getSession,
  getMessages,
  deleteSession,
} from '../db';

export function createSessionsRouter(db: Database) {
  const router = new Hono();

  router.get('/', (c) => {
    const sessions = listSessions(db);
    return c.json(sessions);
  });

  router.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const id = crypto.randomUUID();
    const session = createSession(db, id, body.title);
    return c.json(session, 201);
  });

  router.get('/:id/messages', (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    const messages = getMessages(db, id);
    return c.json(messages);
  });

  router.delete('/:id', (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    deleteSession(db, id);
    return c.json({ ok: true });
  });

  return router;
}
