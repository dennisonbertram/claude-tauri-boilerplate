import { describe, test, expect } from 'bun:test';
import {
  canonicalizePath,
  isPathSafe,
  getWorktreeBaseDir,
  getProjectWorktreeDir,
  getWorkspaceWorktreeDir,
  sanitizeWorkspaceName,
} from './paths';
import { homedir } from 'node:os';
import { join } from 'node:path';

describe('canonicalizePath', () => {
  test('resolves an existing path', async () => {
    const result = await canonicalizePath('/tmp');
    // On macOS /tmp -> /private/tmp
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('throws for a non-existent path', async () => {
    await expect(canonicalizePath('/nonexistent/path/abc123')).rejects.toThrow();
  });
});

describe('isPathSafe', () => {
  test('returns true for a path within the prefix', () => {
    expect(isPathSafe('/home/user/projects/myrepo', '/home/user/projects')).toBe(true);
  });

  test('returns true for exact prefix match', () => {
    expect(isPathSafe('/home/user/projects', '/home/user/projects')).toBe(true);
  });

  test('returns false for path traversal', () => {
    expect(isPathSafe('/home/user/projects/../../../etc/passwd', '/home/user/projects')).toBe(
      false
    );
  });

  test('returns false for a sibling directory', () => {
    expect(isPathSafe('/home/user/other', '/home/user/projects')).toBe(false);
  });

  test('returns false for prefix that is a substring but not a directory boundary', () => {
    // /home/user/projects-evil should NOT match /home/user/projects
    expect(isPathSafe('/home/user/projects-evil/foo', '/home/user/projects')).toBe(false);
  });
});

describe('getWorktreeBaseDir', () => {
  test('returns ~/.claude-tauri/worktrees/', () => {
    expect(getWorktreeBaseDir()).toBe(join(homedir(), '.claude-tauri', 'worktrees'));
  });
});

describe('getProjectWorktreeDir', () => {
  test('returns base dir + project id', () => {
    const result = getProjectWorktreeDir('proj-123');
    expect(result).toBe(join(homedir(), '.claude-tauri', 'worktrees', 'proj-123'));
  });
});

describe('getWorkspaceWorktreeDir', () => {
  test('returns base dir + project id + workspace id', () => {
    const result = getWorkspaceWorktreeDir('proj-123', 'ws-456');
    expect(result).toBe(join(homedir(), '.claude-tauri', 'worktrees', 'proj-123', 'ws-456'));
  });
});

describe('sanitizeWorkspaceName', () => {
  test('lowercases and replaces spaces', () => {
    expect(sanitizeWorkspaceName('My Feature')).toBe('my-feature');
  });

  test('replaces special characters with hyphens', () => {
    expect(sanitizeWorkspaceName('fix/auth_bug!!')).toBe('fix-auth-bug');
  });

  test('collapses multiple hyphens', () => {
    expect(sanitizeWorkspaceName('a---b---c')).toBe('a-b-c');
  });

  test('trims leading and trailing hyphens', () => {
    expect(sanitizeWorkspaceName('--hello--')).toBe('hello');
  });

  test('returns empty string for empty input', () => {
    expect(sanitizeWorkspaceName('')).toBe('');
  });

  test('returns empty string for all-special-char input', () => {
    expect(sanitizeWorkspaceName('!!@@##')).toBe('');
  });

  test('handles already-clean slugs', () => {
    expect(sanitizeWorkspaceName('my-clean-slug')).toBe('my-clean-slug');
  });
});
