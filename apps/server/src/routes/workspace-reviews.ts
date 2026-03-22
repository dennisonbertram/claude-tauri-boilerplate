import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import {
  getWorkspace,
  getOrCreateWorkspaceReview,
  updateWorkspaceReview,
  upsertReviewFile,
  getReviewFiles,
  createReviewComment,
  updateReviewComment,
  deleteReviewComment,
  getReviewComments,
  createReviewTodo,
  updateReviewTodo,
  getReviewTodos,
  computeMergeReadiness,
} from '../db';

/**
 * Review cockpit sub-router.
 *
 * All routes are mounted under /api/workspaces/:id/review by the parent router.
 * The parent is responsible for resolving the workspace; here we re-verify so the
 * module stays self-contained.
 */
export function createWorkspaceReviewRouter(db: Database) {
  const router = new Hono();

  // GET /api/workspaces/:id/review — Get (or lazy-create) review state + readiness
  router.get('/:id/review', (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const review = getOrCreateWorkspaceReview(db, id);
    const files = getReviewFiles(db, review.id);
    const comments = getReviewComments(db, review.id);
    const todos = getReviewTodos(db, review.id);
    const merge_readiness = computeMergeReadiness(review, files, todos);
    return c.json({ ...review, files, comments, todos, merge_readiness });
  });

  // PUT /api/workspaces/:id/review — Update review settings
  router.put('/:id/review', async (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      selected_from_ref: z.string().optional().nullable(),
      selected_to_ref: z.string().optional().nullable(),
      filter_mode: z.enum(['all', 'reviewed', 'unreviewed']).optional(),
      view_mode: z.enum(['unified', 'side-by-side']).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400);
    }

    const review = getOrCreateWorkspaceReview(db, id);
    updateWorkspaceReview(db, review.id, parsed.data as Parameters<typeof updateWorkspaceReview>[2]);
    const updated = getOrCreateWorkspaceReview(db, id);
    const files = getReviewFiles(db, review.id);
    const comments = getReviewComments(db, review.id);
    const todos = getReviewTodos(db, review.id);
    const merge_readiness = computeMergeReadiness(updated, files, todos);
    return c.json({ ...updated, files, comments, todos, merge_readiness });
  });

  // POST /api/workspaces/:id/review/files — Upsert file review state
  router.post('/:id/review/files', async (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      file_path: z.string().min(1),
      review_state: z.enum(['unreviewed', 'reviewed', 'ignored']),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400);
    }

    const review = getOrCreateWorkspaceReview(db, id);
    const file = upsertReviewFile(db, review.id, parsed.data.file_path, parsed.data.review_state);
    return c.json(file);
  });

  // GET /api/workspaces/:id/review/comments — List review comments
  router.get('/:id/review/comments', (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const review = getOrCreateWorkspaceReview(db, id);
    const comments = getReviewComments(db, review.id);
    return c.json(comments);
  });

  // POST /api/workspaces/:id/review/comments — Create review comment
  router.post('/:id/review/comments', async (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      file_path: z.string().min(1),
      diff_line_key: z.string().optional().nullable(),
      old_line: z.number().int().optional().nullable(),
      new_line: z.number().int().optional().nullable(),
      markdown: z.string().min(1),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400);
    }

    const review = getOrCreateWorkspaceReview(db, id);
    const comment = createReviewComment(db, review.id, parsed.data);
    return c.json(comment, 201);
  });

  // PATCH /api/workspaces/:id/review/comments/:commentId — Update review comment
  router.patch('/:id/review/comments/:commentId', async (c) => {
    const id = c.req.param('id');
    const commentId = c.req.param('commentId');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      markdown: z.string().min(1).optional(),
      status: z.enum(['open', 'resolved', 'outdated']).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400);
    }

    updateReviewComment(db, commentId, parsed.data);
    const review = getOrCreateWorkspaceReview(db, id);
    const comments = getReviewComments(db, review.id);
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) {
      return c.json({ error: 'Comment not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json(comment);
  });

  // DELETE /api/workspaces/:id/review/comments/:commentId — Delete review comment
  router.delete('/:id/review/comments/:commentId', (c) => {
    const id = c.req.param('id');
    const commentId = c.req.param('commentId');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const deleted = deleteReviewComment(db, commentId);
    if (!deleted) {
      return c.json({ error: 'Comment not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json({ ok: true });
  });

  // GET /api/workspaces/:id/review/todos — List review todos
  router.get('/:id/review/todos', (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const review = getOrCreateWorkspaceReview(db, id);
    const todos = getReviewTodos(db, review.id);
    return c.json(todos);
  });

  // POST /api/workspaces/:id/review/todos — Create review todo
  router.post('/:id/review/todos', async (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      body: z.string().min(1),
      source: z.enum(['local', 'check', 'agent']).optional(),
      file_path: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400);
    }

    const review = getOrCreateWorkspaceReview(db, id);
    const todo = createReviewTodo(db, review.id, parsed.data);
    return c.json(todo, 201);
  });

  // PATCH /api/workspaces/:id/review/todos/:todoId — Update review todo
  router.patch('/:id/review/todos/:todoId', async (c) => {
    const id = c.req.param('id');
    const todoId = c.req.param('todoId');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      status: z.enum(['open', 'done']).optional(),
      body: z.string().min(1).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400);
    }

    updateReviewTodo(db, todoId, parsed.data);
    const review = getOrCreateWorkspaceReview(db, id);
    const todos = getReviewTodos(db, review.id);
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) {
      return c.json({ error: 'Todo not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json(todo);
  });

  return router;
}
