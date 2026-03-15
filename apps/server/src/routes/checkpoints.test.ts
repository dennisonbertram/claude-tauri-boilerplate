import { describe, test, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { createCheckpointsRouter, clearCheckpointStore } from './checkpoints';

describe('Checkpoints Routes', () => {
  let app: Hono;

  const sessionId = 'test-session-1';

  beforeEach(() => {
    clearCheckpointStore();
    const checkpointsRouter = createCheckpointsRouter();
    app = new Hono();
    app.route(`/api/sessions/:sessionId/checkpoints`, checkpointsRouter);
  });

  describe('GET /api/sessions/:sessionId/checkpoints', () => {
    test('returns empty checkpoints list initially', async () => {
      const res = await app.request(`/api/sessions/${sessionId}/checkpoints`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.checkpoints).toEqual([]);
    });

    test('returns checkpoints after creating some', async () => {
      // Create two checkpoints
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
      // Create two checkpoints
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

      await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-2',
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
  });

  describe('POST /api/sessions/:sessionId/checkpoints/:id/rewind', () => {
    test('returns success for code_and_conversation mode', async () => {
      const createRes = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'First',
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
          body: JSON.stringify({ mode: 'code_and_conversation' }),
        }
      );

      expect(rewindRes.status).toBe(200);
      const body = await rewindRes.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('code and conversation');
    });

    test('returns success for conversation_only mode', async () => {
      const createRes = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'First',
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
          body: JSON.stringify({ mode: 'conversation_only' }),
        }
      );

      expect(rewindRes.status).toBe(200);
      const body = await rewindRes.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('conversation only');
    });

    test('returns success for code_only mode', async () => {
      const createRes = await app.request(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId: 'msg-1',
          promptPreview: 'First',
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

      expect(rewindRes.status).toBe(200);
      const body = await rewindRes.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('code only');
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

      // Get first checkpoint
      const listRes = await app.request(`/api/sessions/${sessionId}/checkpoints`);
      const { checkpoints } = await listRes.json();
      expect(checkpoints).toHaveLength(3);

      // Rewind to the second checkpoint (index 1)
      await app.request(
        `/api/sessions/${sessionId}/checkpoints/${checkpoints[1].id}/rewind`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'code_and_conversation' }),
        }
      );

      // Verify only 2 checkpoints remain
      const listRes2 = await app.request(`/api/sessions/${sessionId}/checkpoints`);
      const body2 = await listRes2.json();
      expect(body2.checkpoints).toHaveLength(2);
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
