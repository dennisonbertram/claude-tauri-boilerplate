import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import type { Workspace } from '@claude-tauri/shared';
import {
  getProject,
  getWorkspace,
  listWorkspaces,
} from '../db';
import { sanitizeWorkspaceName } from '../utils/paths';
import type { WorktreeService } from './worktree';

/**
 * Validate and look up the project for workspace creation.
 * Returns the validated project record.
 */
export function validateProjectForWorkspace(
  db: Database,
  projectId: string
): ReturnType<typeof getProject> & {} {
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

  if (!existsSync(project.repoPathCanonical)) {
    throw Object.assign(new Error('Project repository path does not exist'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return project;
}

/**
 * Sanitize the workspace name and throw if invalid.
 */
export function validateWorkspaceName(name: string): string {
  const sanitized = sanitizeWorkspaceName(name);
  if (!sanitized) {
    throw Object.assign(new Error('Invalid workspace name'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  return sanitized;
}

/**
 * Derive a safe branch name from prefix and sanitized name.
 */
export function deriveBranchName(branchPrefix: string | undefined, sanitized: string): string {
  const rawPrefix = (branchPrefix || 'workspace').trim() || 'workspace';
  const safePrefix = rawPrefix
    .toLowerCase()
    .replace(/[^a-z0-9_\/\-.]/g, '-')
    .replace(/\/+/, '/')
    .replace(/-+/g, '-')
    .replace(/(^[\/-]|[\/-]$)/g, '');

  return `${safePrefix}/${sanitized}`;
}

/**
 * Check that no workspace with the same sanitized name already exists in the project.
 */
export function checkNameConflict(
  db: Database,
  projectId: string,
  name: string,
  sanitized: string
): void {
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
}

/**
 * Check that the branch doesn't already exist.
 */
export async function checkBranchConflict(
  wt: WorktreeService,
  repoPath: string,
  branchName: string,
  name: string
): Promise<void> {
  const branchAlreadyExists = await wt.branchExists(repoPath, branchName);
  if (branchAlreadyExists) {
    throw Object.assign(
      new Error(`A workspace named '${name}' already exists in this project`),
      { status: 409, code: 'CONFLICT' }
    );
  }
}

/**
 * Validate source branch exists if specified.
 */
export async function validateSourceBranch(
  wt: WorktreeService,
  repoPath: string,
  sourceBranch: string
): Promise<void> {
  const sourceExists = await wt.branchExists(repoPath, sourceBranch);
  if (!sourceExists) {
    throw Object.assign(
      new Error(`Source branch '${sourceBranch}' does not exist`),
      { status: 400, code: 'VALIDATION_ERROR' }
    );
  }
}

/**
 * Validate rename/update fields for a workspace.
 */
export async function validateRenameFields(
  wt: WorktreeService,
  workspace: Workspace,
  project: NonNullable<ReturnType<typeof getProject>>,
  updates: { name?: string; branch?: string }
): Promise<void> {
  if (updates.name !== undefined) {
    validateWorkspaceName(updates.name);
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

    const exists = await wt.branchExists(project.repoPathCanonical, branch);
    if (exists && branch !== workspace.branch) {
      throw Object.assign(new Error('Workspace branch already exists'), {
        status: 409,
        code: 'CONFLICT',
      });
    }

    if (branch !== workspace.branch) {
      await wt.renameBranch(
        project.repoPathCanonical,
        workspace.branch,
        branch
      );
    }
  }
}
