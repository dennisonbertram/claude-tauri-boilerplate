import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { GitStatus, GitDiff } from '@claude-tauri/shared';

// Mock Bun.spawn before importing the module
const mockSpawn = mock(() => ({
  stdout: new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('main\n'));
      controller.close();
    },
  }),
  exited: Promise.resolve(0),
}));

// We need to mock at the module level for the git service
// Since the git service uses Bun.spawn, we'll test through the route handler

const { createGitRouter } = await import('./git');
const { Hono } = await import('hono');

describe('Git Routes', () => {
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    testApp = new Hono();
    testApp.route('/api/git', createGitRouter());
  });

  describe('GET /api/git/status', () => {
    test('returns 200 with git status JSON', async () => {
      const res = await testApp.request('/api/git/status');
      expect(res.status).toBe(200);

      const body: GitStatus = await res.json();
      // Should have the expected shape
      expect(body).toHaveProperty('branch');
      expect(body).toHaveProperty('isClean');
      expect(body).toHaveProperty('modifiedFiles');
      expect(body).toHaveProperty('stagedFiles');
      expect(body).toHaveProperty('pullRebase');
      expect(typeof body.branch).toBe('string');
      expect(typeof body.isClean).toBe('boolean');
      expect(Array.isArray(body.modifiedFiles)).toBe(true);
      expect(Array.isArray(body.stagedFiles)).toBe(true);
      expect(
        body.pullRebase === null || typeof body.pullRebase === 'boolean'
      ).toBe(true);
    });

    test('returns a valid branch name (not empty)', async () => {
      const res = await testApp.request('/api/git/status');
      const body: GitStatus = await res.json();

      // We're running in a git repo, so branch should be non-empty
      expect(body.branch.length).toBeGreaterThan(0);
    });

    test('modified files have valid status values', async () => {
      const res = await testApp.request('/api/git/status');
      const body: GitStatus = await res.json();

      const validStatuses = ['modified', 'added', 'deleted', 'renamed', 'untracked'];
      for (const file of body.modifiedFiles) {
        expect(validStatuses).toContain(file.status);
        expect(typeof file.path).toBe('string');
      }
      for (const file of body.stagedFiles) {
        expect(validStatuses).toContain(file.status);
        expect(typeof file.path).toBe('string');
      }
    });

    test('isClean is consistent with file lists', async () => {
      const res = await testApp.request('/api/git/status');
      const body: GitStatus = await res.json();

      if (body.isClean) {
        expect(body.modifiedFiles.length).toBe(0);
        expect(body.stagedFiles.length).toBe(0);
      }
      // Note: dirty doesn't necessarily mean both lists are non-empty
    });

    test('handles custom cwd parameter', async () => {
      const res = await testApp.request('/api/git/status?cwd=/tmp');
      // /tmp is not a git repo, should return error
      const body: GitStatus = await res.json();
      expect(body).toHaveProperty('error');
    });
  });

  describe('GET /api/git/diff', () => {
    test('returns 200 with diff output', async () => {
      const res = await testApp.request('/api/git/diff');
      expect(res.status).toBe(200);

      const body: GitDiff = await res.json();
      expect(body).toHaveProperty('diff');
      expect(typeof body.diff).toBe('string');
    });

    test('handles custom cwd parameter for non-git directory', async () => {
      const res = await testApp.request('/api/git/diff?cwd=/tmp');
      const body: GitDiff = await res.json();
      expect(body).toHaveProperty('error');
    });
  });
});
