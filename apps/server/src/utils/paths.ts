import { realpath } from 'node:fs/promises';
import { isAbsolute, resolve, normalize, join } from 'node:path';
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

export function isPathWithinAnyRoot(target: string, allowedRoots: string[]): boolean {
  return allowedRoots.some((allowedRoot) => isPathSafe(target, allowedRoot));
}

export async function canonicalizeRoots(roots: string[]): Promise<string[]> {
  const canonicalRoots = await Promise.all(
    [...new Set(roots.map((root) => resolve(root)))].map((root) => canonicalizePath(root))
  );

  return [...new Set(canonicalRoots)];
}

export interface PathAccessPolicy {
  allowedRoots: string[];
  errorMessage: string;
}

/**
 * Shared workspace file-access policy:
 * - `additionalDirectories` may stay within the project repo root and, once a
 *   workspace exists, that workspace worktree root.
 * - Attachment references must stay inside the active workspace root.
 */
export function buildAdditionalDirectoryPathPolicy(
  projectRepoRoot: string,
  workspaceRoot?: string
): PathAccessPolicy {
  if (workspaceRoot) {
    return {
      allowedRoots: [projectRepoRoot, workspaceRoot],
      errorMessage:
        'additionalDirectories must stay within the project repository or workspace worktree',
    };
  }

  return {
    allowedRoots: [projectRepoRoot],
    errorMessage: 'additionalDirectories must stay within the project repository',
  };
}

export function buildWorkspaceAttachmentPathPolicy(
  workspaceRoot: string
): PathAccessPolicy {
  return {
    allowedRoots: [workspaceRoot],
    errorMessage:
      'Attachment references must stay within the workspace worktree and point to existing files',
  };
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

/**
 * Normalize an array of directory paths relative to a workspace root,
 * resolving each to a canonical (realpath) form and verifying every entry
 * falls within one of the allowed roots.
 */
/**
 * Validate a GitHub owner or repo name.
 * Must be 1-100 chars, alphanumeric plus hyphens, no leading/trailing hyphens.
 */
export function isValidGitHubName(name: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,98}[a-zA-Z0-9])?$/.test(name);
}

/**
 * Validate a GitHub HTTPS clone URL.
 * Must be https://github.com/{owner}/{repo} or {owner}/{repo}.git with no credentials.
 */
export function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== 'github.com') return false;
    if (parsed.username || parsed.password) return false;
    const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
    return parts.length === 2 && parts.every(p => isValidGitHubName(p));
  } catch {
    return false;
  }
}

/**
 * Sanitize a clone destination path, ensuring it stays under the allowed base directory.
 */
export function sanitizeClonePath(baseDir: string, localPath: string): string {
  const resolved = isAbsolute(localPath) ? localPath : resolve(baseDir, localPath);
  const normalized = resolve(resolved);
  if (!normalized.startsWith(resolve(baseDir))) {
    throw new Error('Clone path must be within the allowed base directory');
  }
  return normalized;
}

export async function normalizeAdditionalDirectories(
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
