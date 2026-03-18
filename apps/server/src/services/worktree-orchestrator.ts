import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import type { Workspace, WorkspaceStatus } from '@claude-tauri/shared';
import {
  createWorkspace as dbCreateWorkspace,
  getWorkspace,
  getProject,
  transitionWorkspaceStatus,
  setWorkspaceError,
  deleteWorkspace as dbDeleteWorkspace,
  updateWorkspace,
  listWorkspaces,
} from '../db';
import {
  getWorkspaceWorktreeDir,
  sanitizeWorkspaceName,
  canonicalizePath,
} from '../utils/paths';
import { WorktreeService, worktreeService } from './worktree';

const SETUP_TIMEOUT_MS = 30_000;

/**
 * Orchestrates multi-step workspace creation and deletion.
 * Coordinates DB state, git worktree operations, and setup commands.
 */
export class WorktreeOrchestrator {
  constructor(private wt: WorktreeService = worktreeService) {}

  /**
   * Create a new workspace for a project.
   *
   * Steps:
   * 1. Validate name, look up project
   * 2. Determine branch name (workspace/<slug>)
   * 3. Check branch doesn't already exist
   * 4. Compute worktree path, ensure parent dir exists
   * 5. Insert DB row with status 'creating'
   * 6. Create git worktree + branch
   * 7. If setup_command exists, run it with timeout
   * 8. Update status to 'ready'
   * 9. On failure: set error status, best-effort cleanup
   */
  async createWorkspace(
    db: Database,
    projectId: string,
    name: string,
    baseBranch?: string,
    branchPrefix?: string,
    linearIssue?: {
      id: string;
      title: string;
      summary?: string;
      url?: string;
    },
    additionalDirectories: string[] = []
  ): Promise<Workspace> {
    // 1. Validate workspace name
    const sanitized = sanitizeWorkspaceName(name);
    if (!sanitized) {
      throw Object.assign(new Error('Invalid workspace name'), {
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    // Look up project
    const project = getProject(db, projectId);
    if (!project) {
      throw Object.assign(new Error('Project not found'), {
        status: 404,
        code: 'NOT_FOUND',
      });
    }

    if (project.isDeleted) {
      throw Object.assign(new Error('Project has been deleted'), {
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    // Verify repo is healthy
    if (!existsSync(project.repoPathCanonical)) {
      throw Object.assign(new Error('Project repository path does not exist'), {
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    // 2. Determine branch name
    const rawPrefix = (branchPrefix || 'workspace').trim() || 'workspace';
    const safePrefix = rawPrefix
      .toLowerCase()
      .replace(/[^a-z0-9_\/\-.]/g, '-')
      .replace(/\/+/, '/')
      .replace(/-+/g, '-')
      .replace(/(^[\/-]|[\/-]$)/g, '');

    const branchName = `${safePrefix}/${sanitized}`;
    const effectiveBaseBranch = baseBranch || project.defaultBranch;

    // 3. Check for duplicate workspace name in project first (friendly error)
    const existingWorkspaces = listWorkspaces(db, projectId);
    const nameConflict = existingWorkspaces.find(
      (ws) => sanitizeWorkspaceName(ws.name) === sanitized
    );
    if (nameConflict) {
      throw Object.assign(
        new Error(`A workspace named '${name}' already exists in this project`),
        { status: 409, code: 'CONFLICT' }
      );
    }

    // Check branch doesn't already exist
    const branchAlreadyExists = await this.wt.branchExists(
      project.repoPathCanonical,
      branchName
    );
    if (branchAlreadyExists) {
      throw Object.assign(
        new Error(`A workspace named '${name}' already exists in this project`),
        { status: 409, code: 'CONFLICT' }
      );
    }

    // 4. Compute worktree path
    const workspaceId = crypto.randomUUID();
    const worktreePath = getWorkspaceWorktreeDir(projectId, workspaceId);

    // Ensure parent directory exists
    const parentDir = getWorkspaceWorktreeDir(projectId, '').replace(/\/$/, '');
    mkdirSync(parentDir, { recursive: true });

    // 5. Insert DB row with status 'creating'
    let worktreePathCanonical: string;
    try {
      // worktreePath doesn't exist yet so we canonicalize the parent and append
      const parentCanonical = await canonicalizePath(parentDir);
      worktreePathCanonical = `${parentCanonical}/${workspaceId}`;
    } catch {
      worktreePathCanonical = worktreePath;
    }

    let workspace: Workspace;
    try {
      workspace = dbCreateWorkspace(
        db,
        workspaceId,
        projectId,
        name,
        branchName,
        worktreePath,
        worktreePathCanonical,
        effectiveBaseBranch,
        linearIssue,
        additionalDirectories
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint')) {
        throw Object.assign(
          new Error(`Workspace name or branch conflicts with an existing workspace`),
          { status: 409, code: 'CONFLICT' }
        );
      }
      throw err;
    }

    // 6. Create git worktree + branch
    try {
      await this.wt.createWorktree(
        project.repoPathCanonical,
        worktreePath,
        branchName,
        effectiveBaseBranch
      );
    } catch (err: unknown) {
      // Cleanup: set error status
      const msg = err instanceof Error ? err.message : String(err);
      setWorkspaceError(db, workspaceId, `Worktree creation failed: ${msg}`);
      throw Object.assign(
        new Error(`Failed to create worktree: ${msg}`),
        { status: 500, code: 'GIT_ERROR' }
      );
    }

    // 7. If setup_command exists, run it
    if (project.setupCommand) {
      transitionWorkspaceStatus(db, workspaceId, 'setup_running');

      try {
        await this.runSetupCommand(project.setupCommand, worktreePath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setWorkspaceError(db, workspaceId, `Setup command failed: ${msg}`);
        // Return the workspace in error state — don't throw, the workspace exists
        return getWorkspace(db, workspaceId)!;
      }
    }

    // 8. Update status to 'ready'
    transitionWorkspaceStatus(db, workspaceId, 'ready');
    return getWorkspace(db, workspaceId)!;
  }

  async renameWorkspace(
    db: Database,
    workspaceId: string,
    updates: {
      name?: string;
      branch?: string;
      additionalDirectories?: string[];
    }
  ): Promise<Workspace> {
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      throw Object.assign(new Error('Workspace not found'), {
        status: 404,
        code: 'NOT_FOUND',
      });
    }

    const project = getProject(db, workspace.projectId);
    if (!project) {
      throw Object.assign(new Error('Project not found'), {
        status: 404,
        code: 'NOT_FOUND',
      });
    }

    if (updates.name !== undefined) {
      const sanitized = sanitizeWorkspaceName(updates.name);
      if (!sanitized) {
        throw Object.assign(new Error('Invalid workspace name'), {
          status: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    if (updates.branch !== undefined) {
      const branch = updates.branch.trim();
      if (!branch) {
        throw Object.assign(new Error('Workspace branch is required'), {
          status: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      if (branch.includes(' ')) {
        throw Object.assign(new Error('Workspace branch cannot contain spaces'), {
          status: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      const exists = await this.wt.branchExists(project.repoPathCanonical, branch);
      if (exists && branch !== workspace.branch) {
        throw Object.assign(new Error('Workspace branch already exists'), {
          status: 409,
          code: 'CONFLICT',
        });
      }

      if (branch !== workspace.branch) {
        try {
          await this.wt.renameBranch(
            project.repoPathCanonical,
            workspace.branch,
            branch
          );
        } catch (err) {
          // Best-effort fallback: if git fails because branch is current and checked out,
          // we can still keep DB unchanged only by bubbling error.
          throw err;
        }
      }

      // keep only when changed
    }

    if (updates.name !== undefined || updates.branch !== undefined || updates.additionalDirectories !== undefined) {
      updateWorkspace(db, workspaceId, {
        name: updates.name,
        branch: updates.branch,
        additionalDirectories: updates.additionalDirectories,
      });
    }

    return getWorkspace(db, workspaceId)!;
  }

  /**
   * Delete a workspace.
   *
   * Steps:
   * 1. Look up workspace, verify it exists
   * 2. Guard against deleting workspaces in certain states (unless force)
   * 3. Update status to 'discarding'
   * 4. Remove worktree (force if workspace was in error state)
   * 5. Optionally delete the branch
   * 6. Delete DB row
   * 7. On failure: set error status
   */
  async deleteWorkspace(
    db: Database,
    workspaceId: string,
    options?: { force?: boolean; deleteBranch?: boolean }
  ): Promise<void> {
    const force = options?.force ?? false;
    const shouldDeleteBranch = options?.deleteBranch ?? true;

    // 1. Look up workspace
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      throw Object.assign(new Error('Workspace not found'), {
        status: 404,
        code: 'NOT_FOUND',
      });
    }

    // 2. Guard against deleting active/merging/discarding workspaces
    const guardedStatuses: WorkspaceStatus[] = ['active', 'merging', 'discarding'];
    if (!force && guardedStatuses.includes(workspace.status)) {
      throw Object.assign(
        new Error(
          `Cannot delete workspace in '${workspace.status}' state. Use force=true to override.`
        ),
        { status: 423, code: 'LOCKED' }
      );
    }

    // 3. Update status to 'discarding'
    if (workspace.status === 'ready' || workspace.status === 'active') {
      transitionWorkspaceStatus(db, workspaceId, 'discarding');
    }

    // Look up the project for repo path
    const project = getProject(db, workspace.projectId);

    // 4. Remove worktree (best-effort)
    if (project && existsSync(workspace.worktreePath)) {
      try {
        const forceRemove = force || workspace.status === 'error';
        await this.wt.removeWorktree(
          project.repoPathCanonical,
          workspace.worktreePath,
          forceRemove
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!force) {
          const currentWorkspace = getWorkspace(db, workspaceId);
          if (currentWorkspace?.status === 'discarding') {
            setWorkspaceError(
              db,
              workspaceId,
              `Failed to remove worktree: ${msg}`
            );
          }
          throw Object.assign(
            new Error(`Failed to remove worktree: ${msg}`),
            { status: 500, code: 'GIT_ERROR' }
          );
        }
        // If force, continue despite error
      }
    }

    // 5. Optionally delete the branch
    if (shouldDeleteBranch && project) {
      try {
        const branchExists = await this.wt.branchExists(
          project.repoPathCanonical,
          workspace.branch
        );
        if (branchExists) {
          await this.wt.deleteBranch(
            project.repoPathCanonical,
            workspace.branch,
            force
          );
        }
      } catch {
        // Best-effort branch deletion — don't fail the delete
      }
    }

    // 6. Delete DB row
    dbDeleteWorkspace(db, workspaceId);
  }

  /**
   * Run a setup command in the worktree directory with timeout.
   */
  private async runSetupCommand(
    command: string,
    cwd: string
  ): Promise<void> {
    const parts = command.split(/\s+/);
    const [cmd, ...args] = parts;

    const proc = Bun.spawn([cmd, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const timer = setTimeout(() => {
      proc.kill();
    }, SETUP_TIMEOUT_MS);

    try {
      const exitCode = await proc.exited;
      clearTimeout(timer);

      if (exitCode !== 0) {
        const stderrBuf = await new Response(proc.stderr).text();
        throw new Error(
          `Setup command exited with code ${exitCode}: ${stderrBuf.slice(0, 500)}`
        );
      }
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }
}

/** Singleton instance */
export const worktreeOrchestrator = new WorktreeOrchestrator();
