import type { ProjectLocation } from '@claude-tauri/shared';
import { LocalProjectAdapter } from './local-project-adapter';
import { SshProjectAdapter } from './ssh-project-adapter';

/**
 * Abstraction over a project's filesystem location.
 * Supports both local and remote (SSH) projects.
 * All path arguments are relative to the project root unless stated otherwise.
 */
export interface ProjectAdapter {
  /** Check whether the project location is currently accessible. */
  checkAccess(): Promise<{ accessible: boolean; error?: string }>;

  /**
   * Resolve a relative path to an absolute path within the project root.
   * Throws if the resolved path would escape the project root (path traversal).
   */
  resolvePath(relativePath: string): Promise<string>;

  /**
   * Execute a command inside the project directory.
   * Uses argument arrays — never shell-interpolated strings.
   */
  exec(
    command: string,
    args: string[],
    options?: { env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;

  /** List entries (files and directories) at the given relative path (default: root). */
  listDir(relativePath?: string): Promise<string[]>;

  /** Read a file at the given relative path and return its UTF-8 content. */
  readFile(relativePath: string): Promise<string>;

  /** Return true if the given relative path exists (file or directory). */
  exists(relativePath: string): Promise<boolean>;
}

/**
 * Factory: create the right adapter for a given project location.
 */
export function createProjectAdapter(location: ProjectLocation): ProjectAdapter {
  if (location.type === 'local') return new LocalProjectAdapter(location.path);
  if (location.type === 'ssh') return new SshProjectAdapter(location);
  // TypeScript exhaustive check
  throw new Error(`Unknown location type: ${(location as { type: string }).type}`);
}
