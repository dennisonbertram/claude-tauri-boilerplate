import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import { isAbsolute, resolve } from 'node:path';
import {
  getProject,
  listWorkspaces,
  getWorkspace,
  transitionWorkspaceStatus,
  deleteWorkspace as dbDeleteWorkspace,
  getSessionForWorkspace,
  getWorkspaceEvents,
  updateWorkspaceRecoveryStatus,
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
import { worktreeOrchestrator } from '../services/worktree-orchestrator';
import { worktreeService } from '../services/worktree';
import { reconcileProjectWorkspaces } from '../services/workspace-reconciler';
import type { WorkspaceStatus } from '@claude-tauri/shared';
import {
  buildAdditionalDirectoryPathPolicy,
  canonicalizePath,
  canonicalizeRoots,
  isPathWithinAnyRoot,
} from '../utils/paths';

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  baseBranch: z.string().min(1).max(255).optional(),
  branchPrefix: z.string().min(1).max(80).optional(),
  sourceBranch: z.string().min(1).max(255).optional(),
  additionalDirectories: z.array(z.string().min(1)).optional(),
  linearIssue: z
    .object({
      id: z.string().min(1, 'issue id is required'),
      title: z.string().min(1, 'issue title is required'),
      summary: z.string().optional(),
      url: z.string().url().optional(),
    })
    .optional(),
  githubIssue: z
    .object({
      number: z.number().int().positive('issue number must be a positive integer'),
      title: z.string().min(1, 'issue title is required'),
      url: z.string().url().optional(),
      repo: z.string().optional(),
    })
    .optional(),
});

const workspaceUpdateSchema = z.object({
  name: z.string().min(1, 'name is required').max(100).optional(),
  branch: z.string().min(1, 'branch is required').max(255).optional(),
  additionalDirectories: z.array(z.string().min(1)).optional(),
}).refine(
  (data) => data.name !== undefined || data.branch !== undefined || data.additionalDirectories !== undefined,
  { message: 'Either name, branch, or additionalDirectories must be provided', path: ['name'] }
);

async function normalizeAdditionalDirectories(
  input: string[] | undefined,
  workspaceRoot: string,
  allowedRoots: string[],
  errorMessage: string
): Promise<string[] | undefined> {
  if (input === undefined) return undefined;

  const normalized = new Set<string>();
  for (const rawEntry of input) {
    const trimmed = rawEntry.trim();
    if (!trimmed) continue;

    const resolved = isAbsolute(trimmed) ? trimmed : resolve(workspaceRoot, trimmed);
    const canonical = await canonicalizePath(resolved);
    if (!isPathWithinAnyRoot(canonical, allowedRoots)) {
      throw new Error(errorMessage);
    }
    normalized.add(canonical);
  }

  return [...normalized];
}

const workspaceOperationLocks = new Map<string, Promise<unknown>>();

export function createWorkspaceRouter(db: Database) {
  const router = new Hono();

  // GET /api/projects/:projectId/workspaces — List workspaces for a project
  router.get('/:projectId/workspaces', (c) => {
    const projectId = c.req.param('projectId');

    const project = getProject(db, projectId);
    if (!project) {
      return c.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        404
      );
    }

    const workspaces = listWorkspaces(db, projectId);
    return c.json(workspaces);
  });

  // POST /api/projects/:projectId/workspaces — Create a workspace
  router.post('/:projectId/workspaces', async (c) => {
    const projectId = c.req.param('projectId');
    const project = getProject(db, projectId);
    if (!project) {
      return c.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        404
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = createWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error('Invalid workspace data');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = parsed.error.flatten();
      throw err;
    }

    let additionalDirectories: string[] = [];
    try {
      const pathPolicy = buildAdditionalDirectoryPathPolicy(project.repoPathCanonical);
      const allowedRoots = await canonicalizeRoots(pathPolicy.allowedRoots);
      additionalDirectories =
        (await normalizeAdditionalDirectories(
          parsed.data.additionalDirectories,
          project.repoPathCanonical,
          allowedRoots,
          pathPolicy.errorMessage
        )) ?? [];
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Invalid additionalDirectories payload',
          code: 'VALIDATION_ERROR',
        },
        400
      );
    }

    const workspace = await worktreeOrchestrator.createWorkspace(
      db,
      projectId,
      parsed.data.name,
      parsed.data.baseBranch,
      parsed.data.sourceBranch,
      parsed.data.branchPrefix,
      parsed.data.linearIssue,
      additionalDirectories,
      parsed.data.githubIssue
    );
    return c.json(workspace, 201);
  });

  // POST /api/projects/:projectId/workspaces/reconcile — Reconcile workspace state
  router.post('/:projectId/workspaces/reconcile', async (c) => {
    const projectId = c.req.param('projectId');
    const project = getProject(db, projectId);
    if (!project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    const workspaces = listWorkspaces(db, projectId);
    const result = await reconcileProjectWorkspaces(
      db,
      projectId,
      project.repoPathCanonical,
      workspaces.map(ws => ({
        id: ws.id,
        branch: ws.branch,
        worktreePath: ws.worktreePath,
        status: ws.status,
        errorMessage: ws.errorMessage ?? null,
      }))
    );

    return c.json(result);
  });

  return router;
}

/**
 * Flat workspace routes for /api/workspaces/:id
 */
export function createFlatWorkspaceRouter(db: Database) {
  const router = new Hono();

  // GET /api/workspaces/:id — Get workspace details
  router.get('/:id', (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json(
        { error: 'Workspace not found', code: 'NOT_FOUND' },
        404
      );
    }
    return c.json(workspace);
  });

  // GET /api/workspaces/:id/session — Get the most recent session for a workspace
  router.get('/:id/session', (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const session = getSessionForWorkspace(db, id);
    return c.json(session ?? null);
  });

  // GET /api/workspaces/:id/events — Get lifecycle events for a workspace
  router.get('/:id/events', (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 20), 100) : 20;
    const events = getWorkspaceEvents(db, id, limit);
    return c.json({ workspaceId: id, events });
  });

  // GET /api/workspaces/:id/recovery-status — Get recovery status for a workspace
  router.get('/:id/recovery-status', (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json({
      workspaceId: id,
      recoveryStatus: workspace.recoveryStatus ?? 'healthy',
      lastReconciledAt: workspace.lastReconciledAt ?? null,
    });
  });

  // DELETE /api/workspaces/:id — Delete a workspace
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const force = c.req.query('force') === 'true';

    return withWorkspaceOperationLock(id, async () => {
      await worktreeOrchestrator.deleteWorkspace(db, id, {
        force,
        deleteBranch: true,
      });
      return c.json({ ok: true });
    });
  });

  // PATCH /api/workspaces/:id — Rename/update workspace metadata
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json(
        { error: 'Workspace not found', code: 'NOT_FOUND' },
        404
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = workspaceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error('Invalid workspace update payload');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = parsed.error.flatten();
      throw err;
    }

    return withWorkspaceOperationLock(id, async () => {
      let additionalDirectories: string[] | undefined;
      const project = getProject(db, workspace.projectId);
      if (!project) {
        return c.json(
          { error: 'Project not found', code: 'NOT_FOUND' },
          404
        );
      }

      try {
        const pathPolicy = buildAdditionalDirectoryPathPolicy(
          project.repoPathCanonical,
          workspace.worktreePathCanonical
        );
        const allowedRoots = await canonicalizeRoots(pathPolicy.allowedRoots);
        additionalDirectories = await normalizeAdditionalDirectories(
          parsed.data.additionalDirectories,
          workspace.worktreePath,
          allowedRoots,
          pathPolicy.errorMessage
        );
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : 'Invalid additionalDirectories payload',
            code: 'VALIDATION_ERROR',
          },
          400
        );
      }

      const updatedWorkspace = await worktreeOrchestrator.renameWorkspace(
        db,
        id,
        {
          ...parsed.data,
          additionalDirectories,
        }
      );
      return c.json(updatedWorkspace);
    });
  });

  // GET /api/workspaces/:id/diff — Get diff for the workspace
  router.get('/:id/diff', async (c) => {
    const id = c.req.param('id');
    const fromRef = c.req.query('fromRef');
    const toRef = c.req.query('toRef');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json(
        { error: 'Workspace not found', code: 'NOT_FOUND' },
        404
      );
    }

    if ((fromRef && !toRef) || (toRef && !fromRef)) {
      return c.json(
        {
          error: 'fromRef and toRef must be provided together',
          code: 'VALIDATION_ERROR',
        },
        400
      );
    }

    const range = fromRef && toRef ? { fromRef, toRef } : undefined;

    const usableStatuses: WorkspaceStatus[] = ['ready', 'active'];
    if (!usableStatuses.includes(workspace.status)) {
      return c.json(
        { error: `Workspace is in '${workspace.status}' state`, code: 'INVALID_STATE' },
        400
      );
    }

    const diff = await worktreeService.getWorktreeDiff(
      workspace.worktreePath,
      workspace.baseBranch,
      range
    );
    return c.json({ diff, workspaceId: id });
  });

  // GET /api/workspaces/:id/changed-files — List changed files
  router.get('/:id/changed-files', async (c) => {
    const id = c.req.param('id');
    const fromRef = c.req.query('fromRef');
    const toRef = c.req.query('toRef');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json(
        { error: 'Workspace not found', code: 'NOT_FOUND' },
        404
      );
    }

    if ((fromRef && !toRef) || (toRef && !fromRef)) {
      return c.json(
        {
          error: 'fromRef and toRef must be provided together',
          code: 'VALIDATION_ERROR',
        },
        400
      );
    }

    const range = fromRef && toRef ? { fromRef, toRef } : undefined;

    const usableStatuses: WorkspaceStatus[] = ['ready', 'active'];
    if (!usableStatuses.includes(workspace.status)) {
      return c.json(
        { error: `Workspace is in '${workspace.status}' state`, code: 'INVALID_STATE' },
        400
      );
    }

    const files = await worktreeService.getChangedFiles(
      workspace.worktreePath,
      workspace.baseBranch,
      range
    );
    return c.json({ files, workspaceId: id });
  });

  // GET /api/workspaces/:id/revisions — List recent revisions in workspace branch
  router.get('/:id/revisions', async (c) => {
    const id = c.req.param('id');
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json(
        { error: 'Workspace not found', code: 'NOT_FOUND' },
        404
      );
    }

    const usableStatuses: WorkspaceStatus[] = ['ready', 'active'];
    if (!usableStatuses.includes(workspace.status)) {
      return c.json(
        { error: `Workspace is in '${workspace.status}' state`, code: 'INVALID_STATE' },
        400
      );
    }

    const revisions = await worktreeService.getWorkspaceRevisions(workspace.worktreePath);
    return c.json({ workspaceId: id, revisions });
  });

  // POST /api/workspaces/:id/merge — Merge workspace branch into base branch
  router.post('/:id/merge', async (c) => {
    const id = c.req.param('id');
    return withWorkspaceOperationLock(id, async () => {
      const workspace = getWorkspace(db, id);
      if (!workspace) {
        return c.json(
          { error: 'Workspace not found', code: 'NOT_FOUND' },
          404
        );
      }

      const mergeableStatuses: WorkspaceStatus[] = ['ready', 'active'];
      if (!mergeableStatuses.includes(workspace.status)) {
        return c.json(
          { error: `Cannot merge workspace in '${workspace.status}' state`, code: 'INVALID_STATE' },
          400
        );
      }

      const project = getProject(db, workspace.projectId);
      if (!project) {
        return c.json(
          { error: 'Project not found', code: 'NOT_FOUND' },
          404
        );
      }

      transitionWorkspaceStatus(db, id, 'merging');

      try {
        // Auto-commit uncommitted changes in the worktree before merge
        await autoCommitWorktree(workspace.worktreePath);

        const result = await worktreeService.mergeWorktreeBranch(
          project.repoPathCanonical,
          workspace.branch,
          workspace.baseBranch
        );

        if (result.success) {
          transitionWorkspaceStatus(db, id, 'merged');
          // Clean up worktree after successful merge
          try {
            await worktreeService.removeWorktree(
              project.repoPathCanonical,
              workspace.worktreePath,
              true
            );
          } catch {
            // Best-effort cleanup — merge already succeeded
          }
          return c.json({ success: true, workspaceId: id });
        }

        transitionWorkspaceStatus(db, id, 'error', 'Merge conflict');
        return c.json(
          { success: false, conflictFiles: result.conflictFiles, workspaceId: id },
          409
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const currentWorkspace = getWorkspace(db, id);
        if (currentWorkspace?.status === 'merging') {
          transitionWorkspaceStatus(db, id, 'error', `Merge failed: ${msg}`);
        }
        throw err;
      }
    });
  });

  // POST /api/workspaces/:id/discard — Discard workspace changes and remove worktree
  router.post('/:id/discard', async (c) => {
    const id = c.req.param('id');
    return withWorkspaceOperationLock(id, async () => {
      const workspace = getWorkspace(db, id);
      if (!workspace) {
        return c.json(
          { error: 'Workspace not found', code: 'NOT_FOUND' },
          404
        );
      }

      const discardableStatuses: WorkspaceStatus[] = ['ready', 'active'];
      if (!discardableStatuses.includes(workspace.status)) {
        return c.json(
          { error: `Cannot discard workspace in '${workspace.status}' state`, code: 'INVALID_STATE' },
          400
        );
      }

      transitionWorkspaceStatus(db, id, 'discarding');

      try {
        const project = getProject(db, workspace.projectId);

        // Remove worktree (force)
        if (project) {
          try {
            await worktreeService.removeWorktree(
              project.repoPathCanonical,
              workspace.worktreePath,
              true
            );
          } catch {
            // Best-effort — worktree may already be gone
          }

          // Delete branch
          try {
            const branchExists = await worktreeService.branchExists(
              project.repoPathCanonical,
              workspace.branch
            );
            if (branchExists) {
              await worktreeService.deleteBranch(
                project.repoPathCanonical,
                workspace.branch,
                true
              );
            }
          } catch {
            // Best-effort branch deletion
          }
        }

        // Delete workspace from DB
        dbDeleteWorkspace(db, id);
        return c.json({ success: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const currentWorkspace = getWorkspace(db, id);
        if (currentWorkspace?.status === 'discarding') {
          transitionWorkspaceStatus(db, id, 'error', `Discard failed: ${msg}`);
        }
        throw err;
      }
    });
  });

  // ─── Review Cockpit Routes ────────────────────────────────────────────────────

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

/**
 * Auto-commit any uncommitted changes in a worktree before merge.
 */
async function autoCommitWorktree(worktreePath: string): Promise<void> {
  const { gitCommand } = await import('../services/git-command');

  // Stage all changes
  const addResult = await gitCommand.run(['add', '-A'], { cwd: worktreePath });
  if (addResult.exitCode !== 0) {
    // Non-zero from `git add -A` means a real failure (permissions, disk full, etc.)
    throw new Error(`git add failed in worktree ${worktreePath}: ${addResult.stderr}`);
  }

  // Check if there are staged changes
  const statusResult = await gitCommand.run(
    ['diff', '--cached', '--quiet'],
    { cwd: worktreePath }
  );

  // exitCode 0 means no diff (nothing staged), exitCode 1 means there are changes
  if (statusResult.exitCode === 1) {
    const commitResult = await gitCommand.run(
      ['commit', '-m', 'WIP: auto-commit before merge'],
      { cwd: worktreePath }
    );
    if (commitResult.exitCode !== 0) {
      throw new Error(`git commit failed in worktree ${worktreePath}: ${commitResult.stderr}`);
    }
  }
}

async function withWorkspaceOperationLock<T>(
  workspaceId: string,
  operation: () => Promise<T>
): Promise<T> {
  if (workspaceOperationLocks.has(workspaceId)) {
    throw Object.assign(
      new Error(`Workspace '${workspaceId}' is already being operated on`),
      { status: 423, code: 'LOCKED' }
    );
  }

  const pending = operation();
  workspaceOperationLocks.set(workspaceId, pending);

  try {
    return await pending;
  } finally {
    if (workspaceOperationLocks.get(workspaceId) === pending) {
      workspaceOperationLocks.delete(workspaceId);
    }
  }
}
