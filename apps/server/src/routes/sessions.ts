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
  linkSessionToProfile,
  getAgentProfile,
} from '../db';
import { generateRandomName } from '../services/name-generator';
import { generateSessionTitle } from '../services/auto-namer';
import { generateContextSummary } from '../services/context-summary';

const DEBUG_LOGS_ENABLED = process.env.CLAUDE_TAURI_DEBUG_LOGS === '1';

const createSessionSchema = z.object({
  title: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
  profileId: z.string().uuid().optional(),
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
    const searchQuery = c.req.query('q') || '';
    const sessions = listSessions(db, searchQuery);
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
    const title = (parsed.data.title && parsed.data.title !== 'New Chat')
      ? parsed.data.title
      : generateRandomName();

    // Validate the profile exists if profileId is provided
    if (parsed.data.profileId) {
      const profile = getAgentProfile(db, parsed.data.profileId);
      if (!profile) {
        return c.json(
          { error: 'Agent profile not found', code: 'NOT_FOUND' },
          404
        );
      }
    }

    createSession(db, id, title, undefined, parsed.data.model);

    // Link the session to the agent profile if applicable
    if (parsed.data.profileId) {
      linkSessionToProfile(db, id, parsed.data.profileId);
    }

    // Re-fetch so profileId is included in the response
    const session = getSession(db, id)!;
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
    const forkedSession = createSession(db, newId, title, undefined, session.model);

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

    // Include messageCount so the isTrulyEmpty heuristic in the frontend
    // works immediately without waiting for a sessions list refresh.
    return c.json({ ...forkedSession, messageCount: messagesToCopy.length }, 201);
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
    const safeTitle = session.title
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50);

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

  // ─── Context summary ───
  router.get('/:id/summary', async (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }

    const messages = getMessages(db, id);
    if (messages.length < 2) {
      return c.json({ summary: null });
    }

    try {
      const summary = await generateContextSummary(messages);
      return c.json({ summary });
    } catch (err) {
      if (DEBUG_LOGS_ENABLED) {
        console.error('[summary] Failed to generate summary:', err);
      } else {
        console.error('[summary] Failed to generate summary:', err instanceof Error ? err.message.split('\n')[0] : 'unknown error');
      }
      return c.json(
        { error: 'Failed to generate summary', code: 'GENERATION_ERROR' },
        500
      );
    }
  });

  // ─── Auto-name session ───
  router.post('/:id/auto-name', async (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }

    const messages = getMessages(db, id);
    if (messages.length === 0) {
      return c.json(
        { error: 'No messages to generate title from', code: 'NO_MESSAGES' },
        400
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const model = typeof body.model === 'string' ? body.model : undefined;
    const privacyMode = body.privacyMode === true;

    // In privacy mode, skip external AI calls and use a local deterministic title.
    if (privacyMode) {
      const fallback = `Session ${new Date().toLocaleDateString()}`;
      updateSessionTitle(db, id, fallback);
      return c.json({ title: fallback });
    }

    try {
      const title = await generateSessionTitle(messages, model);
      updateSessionTitle(db, id, title);
      return c.json({ title });
    } catch (err) {
      if (DEBUG_LOGS_ENABLED) {
        console.error('[auto-name] Failed to generate title:', err);
      } else {
        console.error('[auto-name] Failed to generate title:', err instanceof Error ? err.message.split('\n')[0] : 'unknown error');
      }
      return c.json(
        { error: 'Failed to generate title', code: 'GENERATION_ERROR' },
        500
      );
    }
  });

  return router;
}
