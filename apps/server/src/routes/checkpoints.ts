import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from 'bun:sqlite';
import type { Checkpoint, FileChange, RewindPreview } from '@claude-tauri/shared';
import {
  getSession,
  getWorkspace,
  listSessionCheckpoints,
  createCheckpoint as createCheckpointRecord,
  getSessionCheckpoint,
  getSessionMessageCount,
  deleteSessionCheckpointsAfter,
  trimSessionMessagesToCount,
} from '../db';
import { gitCommand } from '../services/git-command';

const fileChangeSchema = z.object({
  path: z.string().min(1),
  action: z.enum(['created', 'modified', 'deleted']),
  tool: z.string().min(1),
});

const createCheckpointSchema = z.object({
  userMessageId: z.string().min(1),
  promptPreview: z.string().max(200),
  filesChanged: z.array(fileChangeSchema).optional().default([]),
  turnIndex: z.number().int().min(0).optional(),
});

const rewindSchema = z.object({
  mode: z.enum(['code_and_conversation', 'conversation_only', 'code_only']),
});

async function createGitCheckpoint(worktreePath: string): Promise<string | null> {
  const isRepoResult = await gitCommand.runSafe(['rev-parse', '--is-inside-work-tree'], {
    cwd: worktreePath,
  });
  if (isRepoResult.exitCode !== 0) return null;

  const addResult = await gitCommand.run(['add', '-A'], { cwd: worktreePath });
  if (addResult.exitCode !== 0) return null;

  const commitResult = await gitCommand.run(
    [
      '-c',
      'user.name=checkpoint-bot',
      '-c',
      'user.email=checkpoint@local.dev',
      'commit',
      '--allow-empty',
      '-m',
      `checkpoint-${new Date().toISOString()}`,
    ],
    { cwd: worktreePath }
  );
  if (commitResult.exitCode !== 0) return null;

  const hashResult = await gitCommand.run(['rev-parse', 'HEAD'], { cwd: worktreePath });
  if (hashResult.exitCode !== 0) return null;

  return hashResult.stdout.trim();
}

async function restoreGitCommit(worktreePath: string, commit: string): Promise<boolean> {
  const resetResult = await gitCommand.run(['reset', '--hard', commit], { cwd: worktreePath });
  if (resetResult.exitCode !== 0) return false;

  const cleanResult = await gitCommand.run(['clean', '-fd'], { cwd: worktreePath });
  if (cleanResult.exitCode !== 0) return false;

  return true;
}

export function createCheckpointsRouter(db: Database) {
  const router = new Hono();

  // GET /api/sessions/:sessionId/checkpoints - List checkpoints
  router.get('/', (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ error: 'Session ID required', code: 'VALIDATION_ERROR' }, 400);
    }

    const session = getSession(db, sessionId);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }

    const checkpoints = listSessionCheckpoints(db, sessionId);
    return c.json({ checkpoints });
  });

  // POST /api/sessions/:sessionId/checkpoints - Create a checkpoint
  router.post('/', async (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ error: 'Session ID required', code: 'VALIDATION_ERROR' }, 400);
    }

    const session = getSession(db, sessionId);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = createCheckpointSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid checkpoint data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        400
      );
    }

    const checkpoints = listSessionCheckpoints(db, sessionId);
    const turnIndex = parsed.data.turnIndex ?? checkpoints.length;
    const messageCount = getSessionMessageCount(db, sessionId);

    let gitCommit: string | null = null;
    if (session.workspaceId) {
      const workspace = getWorkspace(db, session.workspaceId);
      if (!workspace) {
        return c.json(
          { error: 'Session workspace not found', code: 'NOT_FOUND' },
          404
        );
      }
      gitCommit = await createGitCheckpoint(workspace.worktreePath);
      if (!gitCommit) {
        return c.json(
          { error: 'Failed to create checkpoint commit', code: 'GIT_ERROR' },
          500
        );
      }
    }

    const checkpoint: Checkpoint = createCheckpointRecord(db, {
      sessionId,
      userMessageId: parsed.data.userMessageId,
      promptPreview: parsed.data.promptPreview.slice(0, 50),
      filesChanged: parsed.data.filesChanged,
      turnIndex,
      gitCommit,
      messageCount,
    });

    return c.json(checkpoint, 201);
  });

  // GET /api/sessions/:sessionId/checkpoints/:id/preview - Preview a rewind
  router.get('/:id/preview', (c) => {
    const sessionId = c.req.param('sessionId');
    const checkpointId = c.req.param('id');
    const checkpoint = getSessionCheckpoint(db, sessionId, checkpointId);
    if (!checkpoint) {
      return c.json({ error: 'Checkpoint not found', code: 'NOT_FOUND' }, 404);
    }

    const checkpoints = listSessionCheckpoints(db, sessionId);
    const checkpointIndex = checkpoints.findIndex((cp) => cp.id === checkpoint.id);
    if (checkpointIndex === -1) {
      return c.json({ error: 'Checkpoint not found', code: 'NOT_FOUND' }, 404);
    }

    // Collect files changed from this checkpoint forward.
    const laterCheckpoints = checkpoints.slice(checkpointIndex);
    const filesAffected = [
      ...new Set(laterCheckpoints.flatMap((cp) => cp.filesChanged.map((fc) => fc.path))),
    ];

    const latestMessageCount = getSessionMessageCount(db, sessionId);
    const baseMessageCount = checkpoint.messageCount ?? 0;
    const messagesRemoved = Math.max(0, latestMessageCount - baseMessageCount);

    const preview: RewindPreview = {
      checkpointId,
      filesAffected,
      messagesRemoved,
    };

    return c.json(preview);
  });

  // POST /api/sessions/:sessionId/checkpoints/:id/rewind - Execute a rewind
  router.post('/:id/rewind', async (c) => {
    const sessionId = c.req.param('sessionId');
    const checkpointId = c.req.param('id');

    const session = getSession(db, sessionId);
    if (!session) {
      return c.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        404
      );
    }

    const checkpoint = getSessionCheckpoint(db, sessionId, checkpointId);
    if (!checkpoint) {
      return c.json({ error: 'Checkpoint not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = rewindSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid rewind mode',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        400
      );
    }

    const shouldRestoreCode = parsed.data.mode !== 'conversation_only';
    const shouldRestoreConversation = parsed.data.mode !== 'code_only';
    let restoredWorktreePath: string | null = null;

    if (shouldRestoreCode) {
      if (!checkpoint.gitCommit) {
        return c.json(
          { error: 'Checkpoint has no commit for code rollback', code: 'NO_GIT_COMMIT' },
          409
        );
      }

      if (!session.workspaceId) {
        return c.json(
          { error: 'Session has no workspace for code rollback', code: 'INVALID_STATE' },
          409
        );
      }

      const workspace = getWorkspace(db, session.workspaceId);
      if (!workspace) {
        return c.json(
          { error: 'Session workspace not found', code: 'NOT_FOUND' },
          404
        );
      }

      const restored = await restoreGitCommit(workspace.worktreePath, checkpoint.gitCommit);
      if (!restored) {
        return c.json(
          { error: 'Failed to restore checkpoint files', code: 'GIT_ERROR' },
          500
        );
      }
      restoredWorktreePath = workspace.worktreePath;
    }

    if (shouldRestoreConversation) {
      trimSessionMessagesToCount(db, sessionId, checkpoint.messageCount ?? 0);
    }

    // Remove checkpoints after selected checkpoint (inclusive behavior keeps selected).
    deleteSessionCheckpointsAfter(db, sessionId, checkpoint.id);

    const modeLabels: Record<string, string> = {
      code_and_conversation: 'Rewound code and conversation',
      conversation_only: 'Rewound conversation only',
      code_only: 'Rewound code only',
    };

    return c.json({
      success: true,
      message: `${modeLabels[parsed.data.mode]} to turn ${checkpoint.turnIndex}`,
      restoredWorktreePath,
    });
  });

  return router;
}
