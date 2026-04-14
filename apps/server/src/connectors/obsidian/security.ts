/**
 * Security utilities for the Obsidian connector.
 * Kept in a separate module so tests can import them without triggering
 * the @anthropic-ai/claude-agent-sdk `tool()` calls in tools.ts.
 */

import { readFile, writeFile, realpath } from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Content fencing
// ---------------------------------------------------------------------------

/**
 * Wraps untrusted content (e.g. user-authored notes) in a fence block so that
 * the LLM cannot be prompt-injected by content inside the note.
 */
export function fenceUntrustedContent(content: string): string {
  const fence = '```note';
  const endFence = '```';
  return `${fence}\n${content}\n${endFence}`;
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

/**
 * Validates that `filePath` (relative or absolute) is:
 *  1. Within `vaultDir` after `path.resolve()` (fast reject for `../` etc.)
 *  2. Within `vaultDir` after `realpath()` (symlink resolution)
 *  3. Has a `.md` extension
 *
 * Returns the canonical absolute path on success, throws on violation.
 */
export async function validateObsidianPath(
  filePath: string,
  vaultDir: string
): Promise<string> {
  // Canonicalise vaultDir itself so that comparisons are reliable even when
  // the caller passes a path with symlink components (e.g. /var → /private/var
  // on macOS, or tmp dirs created by mkdtemp).
  let normalVaultDir: string;
  try {
    normalVaultDir = await realpath(path.resolve(vaultDir));
  } catch {
    normalVaultDir = path.resolve(vaultDir);
  }

  // Step 1: resolve without following symlinks.
  const resolved = path.resolve(normalVaultDir, filePath);

  // Fast reject — catches `../` before any disk I/O.
  if (!resolved.startsWith(normalVaultDir + path.sep) && resolved !== normalVaultDir) {
    throw new Error('Path traversal detected');
  }

  // Step 2: resolve symlinks. `realpath` throws ENOENT if the path doesn't
  // exist yet (e.g. new note writes). For writes we skip realpath on the
  // leaf, but for reads the file must exist anyway.
  let canonical: string;
  try {
    canonical = await realpath(resolved);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      // File does not yet exist — resolve the parent directory instead
      // to verify the parent is within the vault and is not a symlink escape.
      const parentResolved = path.dirname(resolved);
      try {
        const canonicalParent = await realpath(parentResolved);
        if (
          !canonicalParent.startsWith(normalVaultDir + path.sep) &&
          canonicalParent !== normalVaultDir
        ) {
          throw new Error('Path traversal via symlink detected');
        }
        // Parent is safe — the new file itself doesn't need symlink checking.
        canonical = resolved;
      } catch (parentErr: any) {
        if (parentErr?.message?.includes('traversal')) throw parentErr;
        // Parent also doesn't exist — safe to use resolved path.
        canonical = resolved;
      }
    } else {
      throw err;
    }
  }

  // Step 3: re-check after symlink resolution.
  if (
    !canonical.startsWith(normalVaultDir + path.sep) &&
    canonical !== normalVaultDir
  ) {
    throw new Error('Path traversal via symlink detected');
  }

  // Step 4: enforce .md extension.
  if (!canonical.endsWith('.md')) {
    throw new Error('Only .md files are supported');
  }

  return canonical;
}

// ---------------------------------------------------------------------------
// Note I/O
// ---------------------------------------------------------------------------

/** Read a note and return its content wrapped in an untrusted-content fence. */
export async function readNote(
  filePath: string,
  vaultDir: string
): Promise<string> {
  const canonical = await validateObsidianPath(filePath, vaultDir);
  const raw = await readFile(canonical, 'utf8');
  return fenceUntrustedContent(raw);
}

/** Write content to a note (must be .md and within the vault). */
export async function writeNote(
  filePath: string,
  content: string,
  vaultDir: string
): Promise<void> {
  const canonical = await validateObsidianPath(filePath, vaultDir);
  await writeFile(canonical, content, 'utf8');
}
