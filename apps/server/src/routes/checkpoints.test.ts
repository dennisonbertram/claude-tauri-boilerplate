import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Database } from 'bun:sqlite';
import { createCheckpointsRouter } from './checkpoints';
import { 
  createDb,
  createSession,
  createProject,
  createWorkspace,
  linkSessionToWorkspace,
  addMessage,
  getMessages,
} from '../db';

function setupGitWorkspace(db: Database, sessionId: string) {
  const repoPath = mkdtempSync(join(tmpdir(), 'checkpoint-git-'));
  mkdirSync(repoPath, { recursive: true });
  const initResult = Bun.spawnSync(['git', 'init'], { cwd: repoPath });
  if (initResult.exitCode !== 0) {
    throw new Error(`Failed to initialize git repo: ${initResult.stderr.toString()}`);
  }
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoPath });
  Bun.spawnSync(['git', 'config', 'user.email', 'test@example.com'], { cwd: repoPath });
  writeFileSync(join(repoPath, 'README.md'), 'start\n');
  Bun.spawnSync(['git', 'add', 'README.md'], { cwd: repoPath });
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: repoPath });

  const projectId = `proj-${crypto.randomUUID().slice(0, 8)}`;
  createProject(db, projectId, 'Checkpoint Project', repoPath, repoPath, 'main');

  const workspaceId = `ws-${crypto.randomUUID().slice(0, 8)}`;
  createWorkspace(
    db,
    workspaceId,
    projectId,
    'checkpoint-workspace',
    'checkpoint/test',
    repoPath,
    repoPath,
    'main'
  );
  linkSessionToWorkspace(db, sessionId, workspaceId);

  return { repoPath, workspaceId };
}

describe('Checkpoints Routes', () => {
  let app: Hono;
  let db: Database;
  let cleanupPaths: string[] = [];
  const sessionId = 'test-session-1';

  beforeEach(() => {
    cleanupPaths = [];
    db = createDb(':memory:');
    createSession(db, sessionId);
    const checkpointsRouter = createCheckpointsRouter(db);
    app = new Hono();
    app.route(`/api/sessions/:sessionId/checkpoints`, checkpointsRouter);
  });

  afterEach(() => {
    db.close();
    for (const path of cleanupPaths) {
      rmSync(path, { recursive: true, force: true });
    }
  });

  describe('GET /api/sessions/:sessionId/checkpoints', () => {
    test('returns empty checkpoints list initially', async () => {
      const res = await app.request(`/api/sessions/${sessionId}/checkpoints`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.checkpoints).toEqual([]);
    });

    test('returns checkpoints after creating some', async () => {
      await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'Fix the login bug in auth.ts',
          filesChanged: [{ path: 'src/auth.ts', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });
      await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-2',
          promptPreview: 'Add unit tests for auth module',
          filesChanged: [
            { path: 'src/__tests__/auth.test.ts', action: 'created', tool: 'Write' },
          ],
          turnIndex: 1,
        }),
      });

      const res = await app.request(`/api/sessions/${sessionId}/checkpoints`);
      const body = await res.json();
      expect(body.checkpoints).toHaveLength(2);
      expect(body.checkpoints[0].promptPreview).toBe('Fix the login bug in auth.ts');
      expect(body.checkpoints[1].promptPreview).toBe('Add unit tests for auth module');
    });
  });

  describe('POST /api/sessions/:sessionId/checkpoints', () => {
    test('creates a checkpoint and returns it with 201', async () => {
      const res = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'Fix the login bug',
          filesChanged: [{ path: 'src/auth.ts', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.userMessageId).toBe('msg-1');
      expect(body.promptPreview).toBe('Fix the login bug');
      expect(body.timestamp).toBeDefined();
      expect(body.filesChanged).toHaveLength(1);
      expect(body.turnIndex).toBe(0);
      expect(body.messageCount).toBe(0);
    });

    test('captures git commit for workspace-backed sessions', async () => {
      const { repoPath } = setupGitWorkspace(db, sessionId);
      cleanupPaths.push(repoPath);

      const res = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'Workspace checkpoint',
          filesChanged: [{ path: 'src/file.ts', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.gitCommit).toMatch(/^[0-9a-f]{40}$/);
    });

    test('truncates promptPreview to 50 chars', async () => {
      const longPrompt = 'A'.repeat(100);
      const res = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: longPrompt,
          filesChanged: [{ path: 'src/file.ts', action: 'created', tool: 'Write' }],
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.promptPreview).toHaveLength(50);
    });

    test('rejects checkpoint with empty filesChanged', async () => {
      const res = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'No files',
          filesChanged: [],
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects checkpoint with missing userMessageId', async () => {
      const res = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptPreview: 'Fix it',
          filesChanged: [{ path: 'src/x.ts', action: 'modified', tool: 'Edit' }],
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/sessions/:sessionId/checkpoints/:id/preview', () => {
    test('returns preview for existing checkpoint', async () => {
      addMessage(db, 'msg-0', sessionId, 'user', 'Hello');
      const res1 = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'First change',
          filesChanged: [{ path: 'src/a.ts', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });
      const cp1 = await res1.json();

      addMessage(db, 'msg-2', sessionId, 'user', 'Second');
      await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-3',
          promptPreview: 'Second change',
          filesChanged: [
            { path: 'src/b.ts', action: 'created', tool: 'Write' },
            { path: 'src/a.ts', action: 'modified', tool: 'Edit' },
          ],
          turnIndex: 1,
        }),
      });

      const previewRes = await app.request(
        `/api/sessions/${sessionId}/checkpoints/${cp1.id}/preview`
      );
      expect(previewRes.status).toBe(200);

      const preview = await previewRes.json();
      expect(preview.checkpointId).toBe(cp1.id);
      expect(preview.filesAffected).toContain('src/a.ts');
      expect(preview.filesAffected).toContain('src/b.ts');
      expect(preview.messagesRemoved).toBe(1);
    });

    test('returns 404 for non-existent checkpoint', async () => {
      const res = await app.request(
        `/api/sessions/${sessionId}/checkpoints/no-such-id/preview`
      );
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('uses checkpoint messageCount against current message count', async () => {
      addMessage(db, 'msg-0', sessionId, 'user', 'Turn zero');
      const res1 = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'Tracked state',
          filesChanged: [{ path: 'src/a.ts', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });
      const cp1 = await res1.json();
      addMessage(db, 'msg-2', sessionId, 'assistant', 'Turn one');
      addMessage(db, 'msg-3', sessionId, 'user', 'Turn two');

      const previewRes = await app.request(
        `/api/sessions/${sessionId}/checkpoints/${cp1.id}/preview`
      );
      const preview = await previewRes.json();

      expect(preview.messagesRemoved).toBe(2);
    });
  });

  describe('POST /api/sessions/:sessionId/checkpoints/:id/rewind', () => {
    test('returns success for code_and_conversation mode with file restore and message truncation', async () => {
      const { repoPath } = setupGitWorkspace(db, sessionId);
      cleanupPaths.push(repoPath);

      writeFileSync(join(repoPath, 'workspace.txt'), 'before');
      addMessage(db, 'msg-0', sessionId, 'user', 'Turn 0');
      const createRes = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'First',
          filesChanged: [{ path: 'workspace.txt', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });
      const cp = await createRes.json();

      writeFileSync(join(repoPath, 'workspace.txt'), 'after rewind');
      addMessage(db, 'msg-2', sessionId, 'assistant', 'Turn 1');

      const rewindRes = await app.request(
        `/api/sessions/${sessionId}/checkpoints/${cp.id}/rewind`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'code_and_conversation' }),
        }
      );

      expect(rewindRes.status).toBe(200);
      const body = await rewindRes.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('code and conversation');
      expect(body.restoredWorktreePath).toBe(repoPath);

      expect(readFileSync(join(repoPath, 'workspace.txt'), 'utf8')).toBe('before');
      expect(getMessages(db, sessionId)).toHaveLength(1);
    });

    test('returns success for conversation_only mode without touching files', async () => {
      const { repoPath } = setupGitWorkspace(db, sessionId);
      cleanupPaths.push(repoPath);

      writeFileSync(join(repoPath, 'workspace.txt'), 'before');
      addMessage(db, 'msg-0', sessionId, 'user', 'Turn 0');

      const createRes = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'First',
          filesChanged: [{ path: 'workspace.txt', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });
      const cp = await createRes.json();

      writeFileSync(join(repoPath, 'workspace.txt'), 'after');
      addMessage(db, 'msg-2', sessionId, 'assistant', 'Turn 1');

      const rewindRes = await app.request(
        `/api/sessions/${sessionId}/checkpoints/${cp.id}/rewind`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'conversation_only' }),
        }
      );

      expect(rewindRes.status).toBe(200);
      const body = await rewindRes.json();
      expect(body.success).toBe(true);
      expect(body.restoredWorktreePath).toBeNull();
      expect(readFileSync(join(repoPath, 'workspace.txt'), 'utf8')).toBe('after');
      expect(getMessages(db, sessionId)).toHaveLength(1);
    });

    test('returns success for code_only mode without touching messages', async () => {
      const { repoPath } = setupGitWorkspace(db, sessionId);
      cleanupPaths.push(repoPath);

      writeFileSync(join(repoPath, 'workspace.txt'), 'before');
      addMessage(db, 'msg-0', sessionId, 'user', 'Turn 0');

      const createRes = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'First',
          filesChanged: [{ path: 'workspace.txt', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });
      const cp = await createRes.json();

      writeFileSync(join(repoPath, 'workspace.txt'), 'after');
      addMessage(db, 'msg-2', sessionId, 'assistant', 'Turn 1');

      const rewindRes = await app.request(
        `/api/sessions/${sessionId}/checkpoints/${cp.id}/rewind`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'code_only' }),
        }
      );

      expect(rewindRes.status).toBe(200);
      const body = await rewindRes.json();
      expect(body.success).toBe(true);
      expect(body.restoredWorktreePath).toBe(repoPath);
      expect(readFileSync(join(repoPath, 'workspace.txt'), 'utf8')).toBe('before');
      expect(getMessages(db, sessionId)).toHaveLength(2);
    });

    test('returns 409 for code modes when checkpoint has no commit', async () => {
      const createRes = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'No commit',
          filesChanged: [{ path: 'src/a.ts', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });
      const cp = await createRes.json();

      const rewindRes = await app.request(
        `/api/sessions/${sessionId}/checkpoints/${cp.id}/rewind`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'code_only' }),
        }
      );

      expect(rewindRes.status).toBe(409);
      const body = await rewindRes.json();
      expect(body.code).toBe('NO_GIT_COMMIT');
    });

    test('truncates checkpoints after rewind', async () => {
      // Create 3 checkpoints
      for (let i = 0; i < 3; i++) {
        await app.request(`/api/sessions/${sessionId}/checkpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessageId: `msg-${i}`,
            promptPreview: `Turn ${i}`,
            filesChanged: [{ path: `src/file${i}.ts`, action: 'modified', tool: 'Edit' }],
            turnIndex: i,
          }),
        });
      }

      const listRes = await app.request(`/api/sessions/${sessionId}/checkpoints`);
      const { checkpoints } = await listRes.json();
      expect(checkpoints).toHaveLength(3);

      const rewindRes = await app.request(
        `/api/sessions/${sessionId}/checkpoints/${checkpoints[1].id}/rewind`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'conversation_only' }),
        }
      );

      expect(rewindRes.status).toBe(200);

      const listRes2 = await app.request(`/api/sessions/${sessionId}/checkpoints`);
      const body2 = await listRes2.json();
      expect(body2.checkpoints).toHaveLength(2);
      expect(body2.checkpoints[0].id).toBe(checkpoints[0].id);
      expect(body2.checkpoints[1].id).toBe(checkpoints[1].id);
    });

    test('returns 404 for non-existent checkpoint', async () => {
      const res = await app.request(
        `/api/sessions/${sessionId}/checkpoints/no-such-id/rewind`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'code_and_conversation' }),
        }
      );
      expect(res.status).toBe(404);
    });

    test('rejects invalid rewind mode', async () => {
      const createRes = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'Test',
          filesChanged: [{ path: 'src/a.ts', action: 'modified', tool: 'Edit' }],
          turnIndex: 0,
        }),
      });
      const cp = await createRes.json();

      const res = await app.request(
        `/api/sessions/${sessionId}/checkpoints/${cp.id}/rewind`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'invalid_mode' }),
        }
      );
      expect(res.status).toBe(400);
    });
  });
});
