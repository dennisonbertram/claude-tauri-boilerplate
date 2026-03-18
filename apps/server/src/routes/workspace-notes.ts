import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { getWorkspace } from '../db';

const CONTEXT_DIR = '.context';
const NOTES_FILE = 'notes.md';

const putNotesSchema = z.object({
  content: z.string(),
});

export function createWorkspaceNotesRouter(db: Database) {
  const router = new Hono();

  // GET /api/workspaces/:id/notes — read .context/notes.md
  router.get('/:id/notes', async (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const notesPath = join(workspace.worktreePath, CONTEXT_DIR, NOTES_FILE);
    const file = Bun.file(notesPath);
    const exists = await file.exists();

    if (!exists) {
      return c.json({ content: '' });
    }

    const content = await file.text();
    return c.json({ content });
  });

  // PUT /api/workspaces/:id/notes — write .context/notes.md
  router.put('/:id/notes', async (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = putNotesSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid request: content field is required', code: 'VALIDATION_ERROR' },
        400
      );
    }

    const contextDir = join(workspace.worktreePath, CONTEXT_DIR);
    mkdirSync(contextDir, { recursive: true });

    const notesPath = join(contextDir, NOTES_FILE);
    await Bun.write(notesPath, parsed.data.content);

    return c.json({ ok: true });
  });

  return router;
}
