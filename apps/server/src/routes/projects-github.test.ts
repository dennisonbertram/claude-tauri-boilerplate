import { describe, test, expect } from 'bun:test';
import {
  isValidGitHubName,
  isValidGitHubUrl,
  sanitizeClonePath,
} from '../utils/paths';
import path from 'path';

// ---------------------------------------------------------------------------
// isValidGitHubName
// ---------------------------------------------------------------------------
describe('isValidGitHubName', () => {
  test('accepts normal owner/repo names', () => {
    expect(isValidGitHubName('octocat')).toBe(true);
    expect(isValidGitHubName('my-org')).toBe(true);
    expect(isValidGitHubName('repo_name')).toBe(true);
    expect(isValidGitHubName('repo.js')).toBe(true);
    expect(isValidGitHubName('A123')).toBe(true);
  });

  test('rejects empty or missing names', () => {
    expect(isValidGitHubName('')).toBe(false);
  });

  test('rejects names with disallowed characters', () => {
    expect(isValidGitHubName('owner/repo')).toBe(false);
    expect(isValidGitHubName('name with spaces')).toBe(false);
    expect(isValidGitHubName('name@special')).toBe(false);
    expect(isValidGitHubName('../../etc')).toBe(false);
  });

  test('rejects excessively long names', () => {
    expect(isValidGitHubName('a'.repeat(101))).toBe(false);
    expect(isValidGitHubName('a'.repeat(100))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidGitHubUrl
// ---------------------------------------------------------------------------
describe('isValidGitHubUrl', () => {
  test('accepts valid GitHub HTTPS URLs', () => {
    expect(isValidGitHubUrl('https://github.com/octocat/hello-world')).toBe(true);
    expect(isValidGitHubUrl('https://github.com/octocat/hello-world.git')).toBe(true);
    expect(isValidGitHubUrl('https://github.com/my-org/repo_name.git')).toBe(true);
  });

  test('rejects non-HTTPS protocols', () => {
    expect(isValidGitHubUrl('http://github.com/octocat/hello-world')).toBe(false);
    expect(isValidGitHubUrl('git://github.com/octocat/hello-world')).toBe(false);
    expect(isValidGitHubUrl('ssh://github.com/octocat/hello-world')).toBe(false);
  });

  test('rejects non-GitHub hosts', () => {
    expect(isValidGitHubUrl('https://gitlab.com/octocat/hello-world')).toBe(false);
    expect(isValidGitHubUrl('https://evil.com/octocat/hello-world')).toBe(false);
  });

  test('rejects URLs with embedded credentials', () => {
    expect(isValidGitHubUrl('https://token@github.com/octocat/hello-world')).toBe(false);
    expect(isValidGitHubUrl('https://user:pass@github.com/octocat/hello-world')).toBe(false);
  });

  test('rejects URLs with wrong path depth', () => {
    expect(isValidGitHubUrl('https://github.com/octocat')).toBe(false);
    expect(isValidGitHubUrl('https://github.com/octocat/hello-world/extra')).toBe(false);
    expect(isValidGitHubUrl('https://github.com/')).toBe(false);
  });

  test('rejects malformed URLs', () => {
    expect(isValidGitHubUrl('not-a-url')).toBe(false);
    expect(isValidGitHubUrl('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeClonePath
// ---------------------------------------------------------------------------
describe('sanitizeClonePath', () => {
  const base = '/home/user/Dev';

  test('resolves relative paths under the base', () => {
    expect(sanitizeClonePath(base, 'my-repo')).toBe(path.resolve(base, 'my-repo'));
    expect(sanitizeClonePath(base, 'sub/dir/repo')).toBe(path.resolve(base, 'sub/dir/repo'));
  });

  test('accepts absolute paths that are under the base', () => {
    expect(sanitizeClonePath(base, '/home/user/Dev/my-repo')).toBe('/home/user/Dev/my-repo');
  });

  test('rejects paths with ".." traversal', () => {
    expect(() => sanitizeClonePath(base, '../etc/passwd')).toThrow('within the allowed base');
    expect(() => sanitizeClonePath(base, 'repo/../../outside')).toThrow('within the allowed base');
  });

  test('rejects paths that escape the base directory', () => {
    expect(() => sanitizeClonePath(base, '/tmp/evil')).toThrow('within the allowed base');
  });

  test('accepts null bytes in path (no special handling)', () => {
    // sanitizeClonePath does not reject null bytes; it only checks base directory containment
    expect(sanitizeClonePath(base, 'repo\0name')).toBe(path.resolve(base, 'repo\0name'));
  });

  test('returns base directory for empty path', () => {
    // sanitizeClonePath resolves empty string to the base directory itself
    expect(sanitizeClonePath(base, '')).toBe(path.resolve(base));
  });
});
