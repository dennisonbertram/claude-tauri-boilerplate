const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB cap on stdout/stderr

export interface GitRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GitRunOptions {
  cwd?: string;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Centralized git CLI runner.
 * Uses Bun.spawn() with argument arrays — no shell interpolation.
 */
export class GitCommandRunner {
  /**
   * Run a git command with the given arguments.
   * Returns { stdout, stderr, exitCode }.
   */
  async run(args: string[], options?: GitRunOptions): Promise<GitRunResult> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;

    const proc = Bun.spawn(['git', ...args], {
      cwd: options?.cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Set up timeout + external abort
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeout);

    if (options?.signal) {
      options.signal.addEventListener('abort', () => abortController.abort(), { once: true });
    }

    abortController.signal.addEventListener(
      'abort',
      () => {
        proc.kill();
      },
      { once: true }
    );

    try {
      const [stdoutBuf, stderrBuf] = await Promise.all([
        new Response(proc.stdout).arrayBuffer(),
        new Response(proc.stderr).arrayBuffer(),
      ]);

      const exitCode = await proc.exited;
      clearTimeout(timer);

      const stdout = new TextDecoder().decode(stdoutBuf.slice(0, MAX_OUTPUT_BYTES));
      const stderr = new TextDecoder().decode(stderrBuf.slice(0, MAX_OUTPUT_BYTES));

      return { stdout, stderr, exitCode };
    } catch (err) {
      clearTimeout(timer);
      if (abortController.signal.aborted) {
        return {
          stdout: '',
          stderr: 'Command timed out or was cancelled',
          exitCode: -1,
        };
      }
      throw err;
    }
  }

  /**
   * Run git safely — returns a result even if the spawn itself fails
   * (e.g. cwd doesn't exist). Returns exitCode -1 for spawn failures.
   */
  async runSafe(args: string[], options?: GitRunOptions): Promise<GitRunResult> {
    try {
      return await this.run(args, options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { stdout: '', stderr: message, exitCode: -1 };
    }
  }

  /** Check if a directory is a git repository */
  async isGitRepo(path: string): Promise<boolean> {
    const result = await this.runSafe(['rev-parse', '--is-inside-work-tree'], { cwd: path });
    return result.exitCode === 0 && result.stdout.trim() === 'true';
  }

  /** Get the default branch for a repository (main, master, etc.) */
  async getDefaultBranch(repoPath: string): Promise<string> {
    // Try symbolic-ref of origin/HEAD first
    const remoteResult = await this.run(
      ['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'],
      { cwd: repoPath }
    );
    if (remoteResult.exitCode === 0) {
      const branch = remoteResult.stdout.trim().replace('origin/', '');
      if (branch) return branch;
    }

    // Fallback: current HEAD symbolic ref (works for unborn repos too)
    const headRefResult = await this.run(['symbolic-ref', '--short', 'HEAD'], {
      cwd: repoPath,
    });
    if (headRefResult.exitCode === 0 && headRefResult.stdout.trim()) {
      return headRefResult.stdout.trim();
    }

    // Fallback: check if 'main' branch exists
    const mainResult = await this.run(['rev-parse', '--verify', 'refs/heads/main'], {
      cwd: repoPath,
    });
    if (mainResult.exitCode === 0) return 'main';

    // Fallback: check if 'master' branch exists
    const masterResult = await this.run(['rev-parse', '--verify', 'refs/heads/master'], {
      cwd: repoPath,
    });
    if (masterResult.exitCode === 0) return 'master';

    // Last resort: current branch
    const currentResult = await this.run(['branch', '--show-current'], { cwd: repoPath });
    if (currentResult.exitCode === 0 && currentResult.stdout.trim()) {
      return currentResult.stdout.trim();
    }

    return 'main';
  }
}

/** Singleton instance for convenience */
export const gitCommand = new GitCommandRunner();
