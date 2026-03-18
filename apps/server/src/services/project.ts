import { Database } from 'bun:sqlite';
import { existsSync, rmSync } from 'node:fs';
import type { Project, ProjectHealth, ProjectLocation } from '@claude-tauri/shared';
import { canonicalizePath } from '../utils/paths';
import { gitCommand } from './git-command';
import { createProjectAdapter } from './project-adapter';
import {
  createProject,
  deleteProject as dbDeleteProject,
  getProject,
  listWorkspaces,
  listProjects,
  getProjectByPath,
} from '../db';
import { basename } from 'node:path';
import { WorktreeService, worktreeService } from './worktree';
import { loadWorkspaceConfig } from './workspace-config';

/**
 * Validate that a path exists on disk and is a git repository.
 * Returns the canonicalized (realpath) version of the path.
 * Throws a descriptive error if validation fails.
 */
export async function validateRepoPath(path: string): Promise<string> {
  if (!path || !path.trim()) {
    throw Object.assign(new Error('Repository path is required'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (!existsSync(path)) {
    throw Object.assign(new Error('Path does not exist'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  let canonical: string;
  try {
    canonical = await canonicalizePath(path);
  } catch {
    throw Object.assign(new Error('Failed to resolve path'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const isRepo = await gitCommand.isGitRepo(canonical);
  if (!isRepo) {
    throw Object.assign(new Error('Path is not a git repository'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return canonical;
}

/**
 * Check the health of a project's repository.
 * Uses the ProjectAdapter when a location is present; falls back to direct
 * local filesystem checks for backward compatibility with projects that have
 * no location field (all existing data).
 */
export async function getProjectHealth(project: Project): Promise<ProjectHealth> {
  // Use adapter if a location is explicitly set on the project.
  if (project.location) {
    const adapter = createProjectAdapter(project.location);
    const access = await adapter.checkAccess();
    if (!access.accessible) return 'missing_repo';
    // For local projects the canonical path is still used for git checks;
    // for SSH the git check is deferred until the SSH adapter is implemented.
    if (project.location.type === 'local') {
      const isRepo = await gitCommand.isGitRepo(project.repoPathCanonical);
      return isRepo ? 'ok' : 'invalid_repo';
    }
    // SSH: access check passed, git validation is not yet implemented.
    return 'ok';
  }

  // Backward-compatible path: no location field → assume local.
  if (!existsSync(project.repoPathCanonical)) {
    return 'missing_repo';
  }
  const isRepo = await gitCommand.isGitRepo(project.repoPathCanonical);
  return isRepo ? 'ok' : 'invalid_repo';
}

/**
 * Add a new project by validating and registering a git repo path.
 * Returns the created project.
 * Throws 400 if not a valid git repo, 409 if duplicate.
 */
export async function addProject(db: Database, repoPath: string) {
  const canonical = await validateRepoPath(repoPath);

  // Check for duplicate
  const existing = getProjectByPath(db, canonical);
  if (existing) {
    throw Object.assign(new Error('A project with this repository path already exists'), {
      status: 409,
      code: 'CONFLICT',
    });
  }

  // Detect project name from directory basename
  const name = basename(canonical);

  // Detect default branch
  const defaultBranch = await gitCommand.getDefaultBranch(canonical);

  const id = crypto.randomUUID();
  return createProject(db, id, name, repoPath, canonical, defaultBranch);
}

/**
 * List all projects enriched with health status, workspace count, and repo config.
 */
export async function listProjectsWithHealth(db: Database) {
  const projects = listProjects(db);

  const enriched = await Promise.all(
    projects.map(async (project) => {
      const health = await getProjectHealth(project);

      // Count workspaces for this project
      const row = db
        .prepare(`SELECT COUNT(*) as count FROM workspaces WHERE project_id = ?`)
        .get(project.id) as { count: number };

      const repoConfig = await loadWorkspaceConfig(project.repoPathCanonical).catch(() => null);

      return {
        ...project,
        health,
        workspaceCount: row.count,
        repoConfig: repoConfig ?? undefined,
      };
    })
  );

  return enriched;
}

/**
 * Remove a project by ID.
 * Best-effort cleanup removes workspace directories before deleting the DB row.
 * Returns true if deleted, false if not found.
 */
export async function removeProject(
  db: Database,
  id: string,
  wt: WorktreeService = worktreeService
): Promise<boolean> {
  const project = getProject(db, id);
  if (!project) return false;

  const workspaces = listWorkspaces(db, id);
  for (const workspace of workspaces) {
    try {
      await wt.removeWorktree(
        project.repoPathCanonical,
        workspace.worktreePath,
        true
      );
    } catch {
      // Best-effort cleanup continues even if git metadata is already out of sync.
    }

    if (existsSync(workspace.worktreePath)) {
      try {
        rmSync(workspace.worktreePath, { recursive: true, force: true });
      } catch {
        // Best-effort directory cleanup.
      }
    }

    // Delete the git branch too (best-effort).
    try {
      const branchExists = await wt.branchExists(
        project.repoPathCanonical,
        workspace.branch
      );
      if (branchExists) {
        await wt.deleteBranch(project.repoPathCanonical, workspace.branch, true);
      }
    } catch {
      // Best-effort branch deletion.
    }
  }

  const result = dbDeleteProject(db, id);
  return result.changes > 0;
}
