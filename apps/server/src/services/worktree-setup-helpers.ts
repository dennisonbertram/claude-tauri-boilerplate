import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const SETUP_TIMEOUT_MS = 30_000;

/**
 * Create .context directory and empty notes file in the worktree,
 * and exclude .context from git tracking via repo's .git/info/exclude.
 */
export async function initContextDirectory(
  worktreePath: string,
  repoPathCanonical: string
): Promise<void> {
  try {
    const contextDir = join(worktreePath, '.context');
    mkdirSync(contextDir, { recursive: true });
    const notesPath = join(contextDir, 'notes.md');
    writeFileSync(notesPath, '');

    // Add .context to the repo's git info/exclude so it never appears
    // in diffs/status across all worktrees
    const gitInfoDir = join(repoPathCanonical, '.git', 'info');
    const excludePath = join(gitInfoDir, 'exclude');
    try {
      mkdirSync(gitInfoDir, { recursive: true });
      const existing = await Bun.file(excludePath).text().catch(() => '');
      if (!existing.includes('.context')) {
        writeFileSync(excludePath, `${existing.trimEnd()}\n.context\n`.trimStart());
      }
    } catch {
      // Best-effort exclude setup
    }
  } catch {
    // Best-effort — don't fail workspace creation if .context setup fails
  }
}

/**
 * Copy preserve_files from the main repo into the new worktree.
 */
export function copyPreserveFiles(
  repoPathCanonical: string,
  worktreePath: string,
  files: string[]
): void {
  for (const relPath of files) {
    const srcFile = join(repoPathCanonical, relPath);
    const destFile = join(worktreePath, relPath);
    if (existsSync(srcFile)) {
      try {
        mkdirSync(dirname(destFile), { recursive: true });
        copyFileSync(srcFile, destFile);
      } catch {
        // Best-effort — don't fail workspace creation for a missing preserve file
      }
    }
  }
}

/**
 * Run a setup command in the worktree directory with timeout.
 * Optional envOverlay merges additional env vars into the process environment.
 */
export async function runSetupCommand(
  command: string,
  cwd: string,
  envOverlay: Record<string, string> = {}
): Promise<void> {
  const parts = command.split(/\s+/);
  const [cmd, ...args] = parts;

  const proc = Bun.spawn([cmd, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...envOverlay },
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
