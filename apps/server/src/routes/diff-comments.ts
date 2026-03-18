import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import {
  getWorkspace,
  listDiffComments,
  createDiffComment,
  getDiffComment,
  deleteDiffComment,
} from '../db';

const createDiffCommentSchema = z.object({
  filePath: z.string().min(1, 'filePath is required'),
  lineNumber: z.number().int().positive().nullable().optional(),
  content: z.string().min(1, 'content is required'),
  author: z.enum(['user', 'ai']).optional().default('user'),
});

export function createDiffCommentsRouter(db: Database) {
  const router = new Hono();

  // GET /api/workspaces/:id/diff-comments — list all comments for a workspace
  router.get('/:id/diff-comments', (c) => {
    const workspaceId = c.req.param('id');

    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const comments = listDiffComments(db, workspaceId);
    return c.json(comments);
  });

  // POST /api/workspaces/:id/diff-comments — create a comment
  router.post('/:id/diff-comments', async (c) => {
    const workspaceId = c.req.param('id');

    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body', code: 'VALIDATION_ERROR' }, 400);
    }

    const parsed = createDiffCommentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.errors[0]?.message ?? 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.errors,
        },
        400
      );
    }

    const { filePath, lineNumber, content, author } = parsed.data;
    const id = crypto.randomUUID();
    const comment = createDiffComment(db, id, workspaceId, filePath, content, lineNumber ?? null, author);
    return c.json(comment, 201);
  });

  // DELETE /api/workspaces/:id/diff-comments/:commentId — delete a comment
  router.delete('/:id/diff-comments/:commentId', (c) => {
    const workspaceId = c.req.param('id');
    const commentId = c.req.param('commentId');

    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const comment = getDiffComment(db, workspaceId, commentId);
    if (!comment) {
      return c.json({ error: 'Comment not found', code: 'NOT_FOUND' }, 404);
    }

    deleteDiffComment(db, workspaceId, commentId);
    return c.json({ success: true });
  });

  return router;
}
