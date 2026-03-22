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

// ---------------------------------------------------------------------------
// GitHub clone security utilities
// ---------------------------------------------------------------------------

/** Pattern for valid GitHub owner or repo names */
const GITHUB_NAME_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Validate a GitHub owner or repo name.
 * Allowed characters: alphanumeric, hyphens, underscores, dots.
 */
export function isValidGitHubName(name: string): boolean {
  if (!name || name.length > 100) return false;
  return GITHUB_NAME_RE.test(name);
}

/**
 * Validate that a URL is a well-formed GitHub HTTPS clone URL.
 * Accepts `https://github.com/owner/repo` with optional `.git` suffix.
 */
export function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== 'github.com') return false;
    // Reject credentials embedded in the URL
    if (parsed.username || parsed.password) return false;
    const segments = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
    if (segments.length !== 2) return false;
    return isValidGitHubName(segments[0]) && isValidGitHubName(segments[1]);
  } catch {
    return false;
  }
}

/**
 * Sanitize and validate a clone destination path.
 *
 * Rules:
 * - `requestedPath` must resolve to a location under `basePath`
 * - Path must not contain `..` segments
 * - Path must not contain null bytes or other suspicious characters
 *
 * Returns the resolved absolute path or throws an error.
 */
export function sanitizeClonePath(basePath: string, requestedPath: string): string {
  if (!requestedPath || typeof requestedPath !== 'string') {
    throw new Error('Clone path is required');
  }

  // Reject null bytes
  if (requestedPath.includes('\0')) {
    throw new Error('Clone path contains invalid characters');
  }

  // Reject explicit traversal segments
  const segments = requestedPath.split(/[/\\]/);
  if (segments.includes('..')) {
    throw new Error('Clone path must not contain ".." segments');
  }

  // Resolve to absolute and verify it falls under the base
  const resolved = resolve(basePath, requestedPath);
  if (!isPathSafe(resolved, basePath)) {
    throw new Error('Clone path must be within the allowed base directory');
  }

  return resolved;
}
