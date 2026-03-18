import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve, normalize } from 'node:path';
import type { ProjectAdapter } from './project-adapter';

const MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MB cap
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * ProjectAdapter implementation for projects on the local filesystem.
 * All path operations are sandboxed within the project root to prevent
 * path traversal attacks.
 */
export class LocalProjectAdapter implements ProjectAdapter {
  private readonly root: string;

  constructor(rootPath: string) {
    // Normalize once at construction — never trust raw input later.
    this.root = normalize(resolve(rootPath));
  }

  /**
   * Check whether the project directory is accessible on the local filesystem.
   */
  async checkAccess(): Promise<{ accessible: boolean; error?: string }> {
    if (!existsSync(this.root)) {
      return { accessible: false, error: `Directory does not exist: ${this.root}` };
    }
    return { accessible: true };
  }

  /**
   * Resolve a relative path to an absolute path within the project root.
   * Throws if the result would escape the root (path traversal prevention).
   */
  async resolvePath(relativePath: string): Promise<string> {
    const absolute = normalize(resolve(join(this.root, relativePath)));
    if (!this.isSafe(absolute)) {
      throw new Error(
        `Path traversal detected: "${relativePath}" resolves outside the project root`
      );
    }
    return absolute;
  }

  /**
   * Execute a command inside the project directory.
   * Uses Bun.spawn with argument arrays — no shell interpolation.
   */
  async exec(
    command: string,
    args: string[],
    options?: { env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const proc = Bun.spawn([command, ...args], {
      cwd: this.root,
      stdout: 'pipe',
      stderr: 'pipe',
      env: options?.env ? { ...process.env, ...options.env } : undefined,
    });

    const abortController = new AbortController();
    const timer = setTimeout(() => {
      abortController.abort();
      proc.kill();
    }, DEFAULT_TIMEOUT_MS);

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
        return { stdout: '', stderr: 'Command timed out', exitCode: -1 };
      }
      throw err;
    }
  }

  /**
   * List names of entries (files and directories) at the given relative path.
   * Defaults to listing the project root.
   */
  async listDir(relativePath?: string): Promise<string[]> {
    const target = relativePath
      ? await this.resolvePath(relativePath)
      : this.root;
    const entries = await readdir(target);
    return entries;
  }

  /**
   * Read a file at the given relative path and return its UTF-8 content.
   * Throws if the path escapes the project root or the file does not exist.
   */
  async readFile(relativePath: string): Promise<string> {
    const absolute = await this.resolvePath(relativePath);
    // readFileSync throws with a native error if the file doesn't exist — let it propagate.
    return readFileSync(absolute, 'utf-8');
  }

  /**
   * Return true if the given relative path exists (file or directory).
   * Never throws — a path traversal attempt returns false.
   */
  async exists(relativePath: string): Promise<boolean> {
    try {
      const absolute = await this.resolvePath(relativePath);
      return existsSync(absolute);
    } catch {
      return false;
    }
  }

  // --- private helpers ---

  private isSafe(absolutePath: string): boolean {
    return absolutePath === this.root || absolutePath.startsWith(this.root + '/');
  }
}
