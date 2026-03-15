import { realpath } from 'node:fs/promises';
import { resolve, normalize, join } from 'node:path';
import { homedir } from 'node:os';

function resolveWorktreeBaseDir(): string {
  return process.env.CLAUDE_TAURI_WORKTREE_BASE
    || join(homedir(), '.claude-tauri', 'worktrees');
}

/**
 * Resolve symlinks and normalize a filesystem path.
 * Throws if the path does not exist.
 */
export async function canonicalizePath(path: string): Promise<string> {
  return realpath(resolve(path));
}

/**
 * Check whether `target` is safely within `allowedPrefix`.
 * Prevents path traversal attacks (e.g. ../../etc/passwd).
 * Both paths are normalized before comparison.
 */
export function isPathSafe(target: string, allowedPrefix: string): boolean {
  const normalizedTarget = normalize(resolve(target));
  const normalizedPrefix = normalize(resolve(allowedPrefix));
  return (
    normalizedTarget === normalizedPrefix ||
    normalizedTarget.startsWith(normalizedPrefix + '/')
  );
}

/** Base directory for all worktrees: ~/.claude-tauri/worktrees/ */
export function getWorktreeBaseDir(): string {
  return resolveWorktreeBaseDir();
}

/** Directory for a specific project's worktrees */
export function getProjectWorktreeDir(projectId: string): string {
  return join(getWorktreeBaseDir(), projectId);
}

/** Directory for a specific workspace's worktree */
export function getWorkspaceWorktreeDir(projectId: string, workspaceId: string): string {
  return join(getWorktreeBaseDir(), projectId, workspaceId);
}

/**
 * Sanitize a workspace name into a slug-safe string.
 * Lowercases, replaces non-alphanumeric chars with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 * Returns empty string if input is empty or all-special-chars.
 */
export function sanitizeWorkspaceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
