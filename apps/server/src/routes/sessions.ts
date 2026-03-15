import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import {
  createSession,
  listSessions,
  getSession,
  getMessages,
  deleteSession,
  updateSessionTitle,
  addMessage,
} from '../db';

const createSessionSchema = z.object({
  title: z.string().max(500).optional(),
});

const renameSessionSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(500).transform((s) => s.trim()),
});

const forkSessionSchema = z.object({
  title: z.string().max(500).optional(),
  messageIndex: z.number().int().min(0).optional(),
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

  // ─── Rename session ───
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = renameSessionSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error('Invalid title');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = parsed.error.flatten();
      throw err;
    }

    updateSessionTitle(db, id, parsed.data.title);

    // Re-fetch the session to return updated data
    const updated = getSession(db, id);
    return c.json(updated);
  });

  // ─── Fork session ───
  router.post('/:id/fork', async (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = forkSessionSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error('Invalid fork data');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = parsed.error.flatten();
      throw err;
    }

    const title = parsed.data.title || `${session.title} (fork)`;
    const newId = crypto.randomUUID();
    const forkedSession = createSession(db, newId, title);

    // Copy messages from original session
    const messages = getMessages(db, id);
    const limit =
      parsed.data.messageIndex !== undefined
        ? parsed.data.messageIndex
        : messages.length;
    const messagesToCopy = messages.slice(0, limit);

    for (const msg of messagesToCopy) {
      addMessage(db, crypto.randomUUID(), newId, msg.role, msg.content);
    }

    return c.json(forkedSession, 201);
  });

  // ─── Export session ───
  router.get('/:id/export', (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }

    const format = c.req.query('format') || 'json';

    if (format !== 'json' && format !== 'md') {
      return c.json(
        {
          error: 'Invalid format. Supported: json, md',
          code: 'VALIDATION_ERROR',
        },
        400
      );
    }

    const messages = getMessages(db, id);
    // Sanitize the title for use in filenames
    const safeTitle = session.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

    if (format === 'md') {
      let md = `# ${session.title}\n\n`;
      md += `*Exported: ${new Date().toISOString()}*\n\n`;
      md += `---\n\n`;

      for (const msg of messages) {
        const label = msg.role === 'user' ? 'User' : 'Assistant';
        md += `**${label}:**\n\n${msg.content}\n\n---\n\n`;
      }

      c.header('Content-Type', 'text/markdown; charset=utf-8');
      c.header(
        'Content-Disposition',
        `attachment; filename="${safeTitle}.md"`
      );
      return c.body(md);
    }

    // JSON format
    const exportData = {
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      exportedAt: new Date().toISOString(),
    };

    c.header(
      'Content-Disposition',
      `attachment; filename="${safeTitle}.json"`
    );
    return c.json(exportData);
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
