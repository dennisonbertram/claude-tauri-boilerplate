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
  recordWorkspaceEvent,
} from '../db';
import {
  getWorkspaceWorktreeDir,
  canonicalizePath,
} from '../utils/paths';
import { WorktreeService, worktreeService } from './worktree';
import { loadWorkspaceConfig } from './workspace-config';
import { initContextDirectory, copyPreserveFiles, runSetupCommand } from './worktree-setup-helpers';
import {
  validateProjectForWorkspace,
  validateWorkspaceName,
  deriveBranchName,
  checkNameConflict,
  checkBranchConflict,
  validateSourceBranch,
  validateRenameFields,
} from './worktree-validation';

/**
 * Orchestrates multi-step workspace creation and deletion.
 * Coordinates DB state, git worktree operations, and setup commands.
 */
export class WorktreeOrchestrator {
  constructor(private wt: WorktreeService = worktreeService) {}

  async createWorkspace(
    db: Database,
    projectId: string,
    name: string,
    baseBranch?: string,
    sourceBranch?: string,
    branchPrefix?: string,
    linearIssue?: { id: string; title: string; summary?: string; url?: string },
    additionalDirectories: string[] = [],
    githubIssue?: { number: number; title: string; url?: string; repo?: string }
  ): Promise<Workspace> {
    // 1. Validate inputs
    const sanitized = validateWorkspaceName(name);
    const project = validateProjectForWorkspace(db, projectId);

    // 2. Determine branch name and validate
    const branchName = deriveBranchName(branchPrefix, sanitized);
    const effectiveBaseBranch = sourceBranch || baseBranch || project.defaultBranch;

    if (sourceBranch) {
      await validateSourceBranch(this.wt, project.repoPathCanonical, sourceBranch);
    }

    // 3. Check for conflicts
    checkNameConflict(db, projectId, name, sanitized);
    await checkBranchConflict(this.wt, project.repoPathCanonical, branchName, name);

    // 4. Compute worktree path
    const workspaceId = crypto.randomUUID();
    const worktreePath = getWorkspaceWorktreeDir(projectId, workspaceId);
    const parentDir = getWorkspaceWorktreeDir(projectId, '').replace(/\/$/, '');
    mkdirSync(parentDir, { recursive: true });

    // 5. Insert DB row with status 'creating'
    let worktreePathCanonical: string;
    try {
      const parentCanonical = await canonicalizePath(parentDir);
      worktreePathCanonical = `${parentCanonical}/${workspaceId}`;
    } catch {
      worktreePathCanonical = worktreePath;
    }

    let workspace: Workspace;
    try {
      workspace = dbCreateWorkspace(
        db, workspaceId, projectId, name, branchName, worktreePath,
        worktreePathCanonical, effectiveBaseBranch, linearIssue,
        additionalDirectories, githubIssue
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint')) {
        throw Object.assign(
          new Error('Workspace name or branch conflicts with an existing workspace'),
          { status: 409, code: 'CONFLICT' }
        );
      }
      throw err;
    }

    recordWorkspaceEvent(db, workspaceId, 'created', {
      sourceBranch: sourceBranch ?? undefined,
      baseBranch: effectiveBaseBranch,
      branch: branchName,
    });

    // 6. Create git worktree + branch
    try {
      await this.wt.createWorktree(
        project.repoPathCanonical, worktreePath, branchName, effectiveBaseBranch
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setWorkspaceError(db, workspaceId, `Worktree creation failed: ${msg}`);
      recordWorkspaceEvent(db, workspaceId, 'error', { message: `Worktree creation failed: ${msg}` });
      throw Object.assign(new Error(`Failed to create worktree: ${msg}`), { status: 500, code: 'GIT_ERROR' });
    }

    // 6b. Create .context directory
    await initContextDirectory(worktreePath, project.repoPathCanonical);

    // 7. Load repo config and apply it
    const repoConfig = await loadWorkspaceConfig(project.repoPathCanonical).catch(() => null);

    if (repoConfig?.preserve?.files?.length) {
      copyPreserveFiles(project.repoPathCanonical, worktreePath, repoConfig.preserve.files);
    }

    // 7b. Run setup command if configured
    const effectiveSetupCommand = project.setupCommand ?? repoConfig?.lifecycle?.setup ?? null;

    if (effectiveSetupCommand) {
      transitionWorkspaceStatus(db, workspaceId, 'setup_running');
      recordWorkspaceEvent(db, workspaceId, 'setup_started', { command: effectiveSetupCommand });
      const envOverlay = repoConfig?.env ?? {};

      try {
        await runSetupCommand(effectiveSetupCommand, worktreePath, envOverlay);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setWorkspaceError(db, workspaceId, `Setup command failed: ${msg}`);
        recordWorkspaceEvent(db, workspaceId, 'error', { message: `Setup command failed: ${msg}` });
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
    updates: { name?: string; branch?: string; additionalDirectories?: string[] }
  ): Promise<Workspace> {
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      throw Object.assign(new Error('Workspace not found'), { status: 404, code: 'NOT_FOUND' });
    }

    const project = getProject(db, workspace.projectId);
    if (!project) {
      throw Object.assign(new Error('Project not found'), { status: 404, code: 'NOT_FOUND' });
    }

    await validateRenameFields(this.wt, workspace, project, updates);

    if (updates.name !== undefined || updates.branch !== undefined || updates.additionalDirectories !== undefined) {
      updateWorkspace(db, workspaceId, {
        name: updates.name,
        branch: updates.branch,
        additionalDirectories: updates.additionalDirectories,
      });
    }

    return getWorkspace(db, workspaceId)!;
  }

  async deleteWorkspace(
    db: Database,
    workspaceId: string,
    options?: { force?: boolean; deleteBranch?: boolean }
  ): Promise<void> {
    const force = options?.force ?? false;
    const shouldDeleteBranch = options?.deleteBranch ?? true;

    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      throw Object.assign(new Error('Workspace not found'), { status: 404, code: 'NOT_FOUND' });
    }

    // Guard against deleting active/merging/discarding workspaces
    const guardedStatuses: WorkspaceStatus[] = ['active', 'merging', 'discarding'];
    if (!force && guardedStatuses.includes(workspace.status)) {
      throw Object.assign(
        new Error(`Cannot delete workspace in '${workspace.status}' state. Use force=true to override.`),
        { status: 423, code: 'LOCKED' }
      );
    }

    if (workspace.status === 'ready' || workspace.status === 'active') {
      transitionWorkspaceStatus(db, workspaceId, 'discarding');
    }

    const project = getProject(db, workspace.projectId);

    // Remove worktree (best-effort)
    if (project && existsSync(workspace.worktreePath)) {
      try {
        const forceRemove = force || workspace.status === 'error';
        await this.wt.removeWorktree(project.repoPathCanonical, workspace.worktreePath, forceRemove);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!force) {
          const currentWorkspace = getWorkspace(db, workspaceId);
          if (currentWorkspace?.status === 'discarding') {
            setWorkspaceError(db, workspaceId, `Failed to remove worktree: ${msg}`);
          }
          throw Object.assign(new Error(`Failed to remove worktree: ${msg}`), { status: 500, code: 'GIT_ERROR' });
        }
      }
    }

    // Optionally delete the branch
    if (shouldDeleteBranch && project) {
      try {
        const branchExists = await this.wt.branchExists(project.repoPathCanonical, workspace.branch);
        if (branchExists) {
          await this.wt.deleteBranch(project.repoPathCanonical, workspace.branch, force);
        }
      } catch {
        // Best-effort branch deletion
      }
    }

    dbDeleteWorkspace(db, workspaceId);
  }
}

/** Singleton instance */
export const worktreeOrchestrator = new WorktreeOrchestrator();
