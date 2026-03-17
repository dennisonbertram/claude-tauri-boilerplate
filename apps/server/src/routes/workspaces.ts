import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import {
  getProject,
  listWorkspaces,
  getWorkspace,
  transitionWorkspaceStatus,
  deleteWorkspace as dbDeleteWorkspace,
  getSessionForWorkspace,
} from '../db';
import { worktreeOrchestrator } from '../services/worktree-orchestrator';
import { worktreeService } from '../services/worktree';
import type { WorkspaceStatus } from '@claude-tauri/shared';

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  baseBranch: z.string().min(1).max(255).optional(),
  linearIssue: z
    .object({
      id: z.string().min(1, 'issue id is required'),
      title: z.string().min(1, 'issue title is required'),
      summary: z.string().optional(),
      url: z.string().url().optional(),
    })
    .optional(),
});

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

    const body = await c.req.json().catch(() => ({}));
    const parsed = createWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error('Invalid workspace data');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = parsed.error.flatten();
      throw err;
    }

    const workspace = await worktreeOrchestrator.createWorkspace(
      db,
      projectId,
      parsed.data.name,
      parsed.data.baseBranch,
      parsed.data.linearIssue
    );
    return c.json(workspace, 201);
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

  // GET /api/workspaces/:id/diff — Get diff for the workspace
  router.get('/:id/diff', async (c) => {
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

    const diff = await worktreeService.getWorktreeDiff(workspace.worktreePath, workspace.baseBranch);
    return c.json({ diff, workspaceId: id });
  });

  // GET /api/workspaces/:id/changed-files — List changed files
  router.get('/:id/changed-files', async (c) => {
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

    const files = await worktreeService.getChangedFiles(workspace.worktreePath, workspace.baseBranch);
    return c.json({ files, workspaceId: id });
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

  return router;
}

/**
 * Auto-commit any uncommitted changes in a worktree before merge.
 */
async function autoCommitWorktree(worktreePath: string): Promise<void> {
  const { gitCommand } = await import('../services/git-command');

  // Stage all changes
  const addResult = await gitCommand.run(['add', '-A'], { cwd: worktreePath });
  if (addResult.exitCode !== 0) return; // Nothing to add

  // Check if there are staged changes
  const statusResult = await gitCommand.run(
    ['diff', '--cached', '--quiet'],
    { cwd: worktreePath }
  );

  // exitCode 0 means no diff (nothing staged), exitCode 1 means there are changes
  if (statusResult.exitCode === 1) {
    await gitCommand.run(
      ['commit', '-m', 'WIP: auto-commit before merge'],
      { cwd: worktreePath }
    );
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
