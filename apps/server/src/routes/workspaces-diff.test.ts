import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createProject, getWorkspace, updateWorkspaceStatus } from '../db';
import { createWorkspaceRouter, createFlatWorkspaceRouter } from './workspaces';
import { errorHandler } from '../middleware/error-handler';
import { worktreeService } from '../services/worktree';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir: string;
let repoPath: string;
let db: Database;
let app: Hono;
let projectId: string;
let defaultBranch: string;

beforeAll(async () => {
  // Create a real temp git repo
  tempDir = join(tmpdir(), `workspace-diff-test-${Date.now()}`);
  repoPath = join(tempDir, 'repo');
  process.env.CLAUDE_TAURI_WORKTREE_BASE = join(tempDir, 'worktrees');
  mkdirSync(repoPath, { recursive: true });

  // Initialize git repo with an initial commit
  const gitInit = Bun.spawnSync(['git', 'init'], { cwd: repoPath });
  if (gitInit.exitCode !== 0) throw new Error('git init failed');

  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: repoPath });
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoPath });

  const initFile = join(repoPath, 'README.md');
  await Bun.write(initFile, '# Test');
  Bun.spawnSync(['git', 'add', '.'], { cwd: repoPath });
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: repoPath });

  const branchResult = Bun.spawnSync(['git', 'symbolic-ref', '--short', 'HEAD'], {
    cwd: repoPath,
  });
  defaultBranch = branchResult.stdout.toString().trim() || 'main';
});

afterAll(() => {
  if (db) db.close();
  delete process.env.CLAUDE_TAURI_WORKTREE_BASE;
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  if (db) db.close();
  db = createDb(':memory:');

  const realpath = Bun.spawnSync(['realpath', repoPath]).stdout.toString().trim();
  const project = createProject(
    db,
    crypto.randomUUID(),
    'test-project',
    repoPath,
    realpath || repoPath,
    defaultBranch
  );
  projectId = project.id;

  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/projects', createWorkspaceRouter(db));
  app.route('/api/workspaces', createFlatWorkspaceRouter(db));
});

/** Helper: create a workspace and return its JSON body */
async function createWorkspace(name: string) {
  const res = await app.request(
    `/api/projects/${projectId}/workspaces`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }
  );
  expect(res.status).toBe(201);
  return res.json();
}

describe('Workspace Diff & Changed Files', () => {
  describe('GET /api/workspaces/:id/diff', () => {
    test('returns empty diff for workspace with no changes', async () => {
      const ws = await createWorkspace('no-changes');

      const res = await app.request(`/api/workspaces/${ws.id}/diff`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.workspaceId).toBe(ws.id);
      expect(body.diff).toBe('');
    });

    test('returns non-empty diff after making changes', async () => {
      const ws = await createWorkspace('with-changes');

      // Make a change in the worktree
      writeFileSync(join(ws.worktreePath, 'new-file.txt'), 'hello world');

      const res = await app.request(`/api/workspaces/${ws.id}/diff`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.workspaceId).toBe(ws.id);
      // The diff won't include untracked files (only git diff HEAD picks up tracked changes).
      // But if we modify an existing tracked file it will show.
      // Let's modify README.md instead:
      writeFileSync(join(ws.worktreePath, 'README.md'), '# Modified');

      const res2 = await app.request(`/api/workspaces/${ws.id}/diff`);
      const body2 = await res2.json();
      expect(body2.diff).toContain('Modified');
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-id/diff');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('returns 400 for workspace in wrong state', async () => {
      const ws = await createWorkspace('wrong-state-diff');

      // Manually set workspace to 'merging' (not a usable state for diff)
      updateWorkspaceStatus(db, ws.id, 'merging');

      const res = await app.request(`/api/workspaces/${ws.id}/diff`);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.code).toBe('INVALID_STATE');
    });
  });

  describe('GET /api/workspaces/:id/changed-files', () => {
    test('returns empty file list for workspace with no changes', async () => {
      const ws = await createWorkspace('no-changes-files');

      const res = await app.request(`/api/workspaces/${ws.id}/changed-files`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.workspaceId).toBe(ws.id);
      expect(body.files).toEqual([]);
    });

    test('returns changed files after modifications', async () => {
      const ws = await createWorkspace('changed-files');

      // Create a new untracked file
      writeFileSync(join(ws.worktreePath, 'new-file.txt'), 'hello');
      // Modify an existing tracked file
      writeFileSync(join(ws.worktreePath, 'README.md'), '# Changed');

      const res = await app.request(`/api/workspaces/${ws.id}/changed-files`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'new-file.txt', status: 'untracked' }),
          expect.objectContaining({ path: 'README.md', status: 'modified' }),
        ])
      );
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-id/changed-files');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/workspaces/:id/diff?fromRef&toRef', () => {
    test('returns range-based diff and changed files for historical review', async () => {
      const ws = await createWorkspace('historical-diff');

      writeFileSync(join(ws.worktreePath, 'history.txt'), 'first');
      Bun.spawnSync(['git', 'add', 'history.txt'], { cwd: ws.worktreePath });
      Bun.spawnSync(['git', 'commit', '-m', 'add history'], { cwd: ws.worktreePath });

      const fromRef = Bun.spawnSync(['git', 'rev-parse', 'HEAD~1'], { cwd: ws.worktreePath })
        .stdout.toString()
        .trim();
      const toRef = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: ws.worktreePath })
        .stdout.toString()
        .trim();

      const diffRes = await app.request(
        `/api/workspaces/${ws.id}/diff?fromRef=${fromRef}&toRef=${toRef}`
      );
      expect(diffRes.status).toBe(200);

      const diffBody = await diffRes.json();
      expect(diffBody.diff).toContain('history.txt');

      const filesRes = await app.request(
        `/api/workspaces/${ws.id}/changed-files?fromRef=${fromRef}&toRef=${toRef}`
      );
      expect(filesRes.status).toBe(200);

      const filesBody = await filesRes.json();
      expect(filesBody.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'history.txt', status: 'added' }),
        ])
      );
    });

    test('requires fromRef and toRef together for historical range', async () => {
      const ws = await createWorkspace('range-validation');

      const res = await app.request(`/api/workspaces/${ws.id}/diff?fromRef=main`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('requires fromRef and toRef together for changed-files historical range', async () => {
      const ws = await createWorkspace('changed-files-range-validation');

      const res = await app.request(`/api/workspaces/${ws.id}/changed-files?toRef=main`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toContain('fromRef and toRef');
    });

    test('returns error for invalid historical refs', async () => {
      const ws = await createWorkspace('range-invalid-refs');

      const changedRes = await app.request(
        `/api/workspaces/${ws.id}/changed-files?fromRef=not-a-ref&toRef=also-not-a-ref`
      );
      expect(changedRes.status).toBe(500);
      const changedBody = await changedRes.json();
      expect(changedBody.code).toBe('GIT_ERROR');

      const diffRes = await app.request(
        `/api/workspaces/${ws.id}/diff?fromRef=not-a-ref&toRef=also-not-a-ref`
      );
      expect(diffRes.status).toBe(500);
      const diffBody = await diffRes.json();
      expect(diffBody.code).toBe('GIT_ERROR');
    });
  });

  describe('GET /api/workspaces/:id/revisions', () => {
    test('returns workspace revision history', async () => {
      const ws = await createWorkspace('revisions-history');

      writeFileSync(join(ws.worktreePath, 'rev1.txt'), 'v1');
      Bun.spawnSync(['git', 'add', 'rev1.txt'], { cwd: ws.worktreePath });
      Bun.spawnSync(['git', 'commit', '-m', 'rev1'], { cwd: ws.worktreePath });

      writeFileSync(join(ws.worktreePath, 'rev2.txt'), 'v2');
      Bun.spawnSync(['git', 'add', 'rev2.txt'], { cwd: ws.worktreePath });
      Bun.spawnSync(['git', 'commit', '-m', 'rev2'], { cwd: ws.worktreePath });

      const res = await app.request(`/api/workspaces/${ws.id}/revisions`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.workspaceId).toBe(ws.id);
      expect(body.revisions).toHaveLength(3);
      expect(body.revisions[0].message).toBe('rev2');
      expect(body.revisions[1].message).toBe('rev1');
      expect(body.revisions[0].shortId).toHaveLength(7);
    });
  });
});

describe('Workspace Merge', () => {
  describe('POST /api/workspaces/:id/merge', () => {
    test('merges branch successfully when there are committed changes', async () => {
      const ws = await createWorkspace('merge-test');

      // Make and commit a change in the worktree
      writeFileSync(join(ws.worktreePath, 'feature.txt'), 'new feature');
      Bun.spawnSync(['git', 'add', '.'], { cwd: ws.worktreePath });
      Bun.spawnSync(['git', 'commit', '-m', 'add feature'], { cwd: ws.worktreePath });

      const res = await app.request(`/api/workspaces/${ws.id}/merge`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.workspaceId).toBe(ws.id);

      // Verify workspace status is 'merged'
      const updated = getWorkspace(db, ws.id);
      expect(updated!.status).toBe('merged');
    });

    test('auto-commits uncommitted changes before merge', async () => {
      const ws = await createWorkspace('auto-commit-merge');

      // Make a change but don't commit it
      writeFileSync(join(ws.worktreePath, 'uncommitted.txt'), 'uncommitted data');

      const res = await app.request(`/api/workspaces/${ws.id}/merge`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify the file was merged into main
      const mainHasFile = existsSync(join(repoPath, 'uncommitted.txt'));
      // Note: after merge, main should have the file
      // We need to checkout main to verify
      Bun.spawnSync(['git', 'checkout', 'main'], { cwd: repoPath });
      const fileExists = existsSync(join(repoPath, 'uncommitted.txt'));
      expect(fileExists).toBe(true);
    });

    test('returns 400 for workspace in wrong state', async () => {
      const ws = await createWorkspace('wrong-state-merge');

      // Set workspace to 'merged' (already merged)
      updateWorkspaceStatus(db, ws.id, 'merging');
      updateWorkspaceStatus(db, ws.id, 'merged');

      const res = await app.request(`/api/workspaces/${ws.id}/merge`, {
        method: 'POST',
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_STATE');
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-id/merge', {
        method: 'POST',
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('returns 423 when a merge is already in progress', async () => {
      const ws = await createWorkspace('merge-locked');
      const originalMerge = worktreeService.mergeWorktreeBranch.bind(worktreeService);

      let releaseMerge!: (value: { success: boolean; conflictFiles?: string[] }) => void;
      const mergeStarted = new Promise<void>((resolve) => {
        worktreeService.mergeWorktreeBranch = (async () => {
          resolve();
          return await new Promise<{ success: boolean; conflictFiles?: string[] }>((res) => {
            releaseMerge = res;
          });
        }) as typeof worktreeService.mergeWorktreeBranch;
      });

      try {
        const firstRequest = app.request(`/api/workspaces/${ws.id}/merge`, {
          method: 'POST',
        });

        await mergeStarted;

        const secondRequest = await app.request(`/api/workspaces/${ws.id}/merge`, {
          method: 'POST',
        });
        expect(secondRequest.status).toBe(423);

        const secondBody = await secondRequest.json();
        expect(secondBody.code).toBe('LOCKED');

        releaseMerge({ success: true });
        const firstResponse = await firstRequest;
        expect(firstResponse.status).toBe(200);
      } finally {
        worktreeService.mergeWorktreeBranch = originalMerge;
      }
    });
  });
});

describe('Workspace Discard', () => {
  describe('POST /api/workspaces/:id/discard', () => {
    test('discards workspace and removes worktree from disk', async () => {
      const ws = await createWorkspace('discard-test');
      expect(existsSync(ws.worktreePath)).toBe(true);

      const res = await app.request(`/api/workspaces/${ws.id}/discard`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify worktree removed from disk
      expect(existsSync(ws.worktreePath)).toBe(false);

      // Verify workspace deleted from DB
      const getRes = await app.request(`/api/workspaces/${ws.id}`);
      expect(getRes.status).toBe(404);
    });

    test('returns 404 for non-existent workspace', async () => {
      const res = await app.request('/api/workspaces/no-such-id/discard', {
        method: 'POST',
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('discards workspace with uncommitted changes', async () => {
      const ws = await createWorkspace('discard-uncommitted');

      // Make changes without committing
      writeFileSync(join(ws.worktreePath, 'temp.txt'), 'temporary');

      const res = await app.request(`/api/workspaces/${ws.id}/discard`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify cleanup
      expect(existsSync(ws.worktreePath)).toBe(false);
    });

    test('returns 423 when a discard is already in progress', async () => {
      const ws = await createWorkspace('discard-locked');
      const originalRemoveWorktree = worktreeService.removeWorktree.bind(worktreeService);

      let releaseDiscard!: () => void;
      const discardStarted = new Promise<void>((resolve) => {
        worktreeService.removeWorktree = (async () => {
          resolve();
          await new Promise<void>((res) => {
            releaseDiscard = res;
          });
        }) as typeof worktreeService.removeWorktree;
      });

      try {
        const firstRequest = app.request(`/api/workspaces/${ws.id}/discard`, {
          method: 'POST',
        });

        await discardStarted;

        const secondRequest = await app.request(`/api/workspaces/${ws.id}/discard`, {
          method: 'POST',
        });
        expect(secondRequest.status).toBe(423);

        const secondBody = await secondRequest.json();
        expect(secondBody.code).toBe('LOCKED');

        releaseDiscard();
        const firstResponse = await firstRequest;
        expect(firstResponse.status).toBe(200);
      } finally {
        worktreeService.removeWorktree = originalRemoveWorktree;
        if (existsSync(ws.worktreePath)) {
          await originalRemoveWorktree(repoPath, ws.worktreePath, true);
        }
      }
    });
  });
});
