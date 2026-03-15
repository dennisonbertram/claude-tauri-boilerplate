import { Hono } from 'hono';
import { z } from 'zod';
import type { Checkpoint, FileChange, RewindPreview } from '@claude-tauri/shared';

// In-memory checkpoint storage keyed by sessionId
const checkpointStore = new Map<string, Checkpoint[]>();

const fileChangeSchema = z.object({
  path: z.string().min(1),
  action: z.enum(['created', 'modified', 'deleted']),
  tool: z.string().min(1),
});

const createCheckpointSchema = z.object({
  userMessageId: z.string().min(1),
  promptPreview: z.string().max(200),
  filesChanged: z.array(fileChangeSchema).min(1),
  turnIndex: z.number().int().min(0).optional(),
});

const rewindSchema = z.object({
  mode: z.enum(['code_and_conversation', 'conversation_only', 'code_only']),
});

/**
 * Helper to get or initialize checkpoint list for a session.
 */
function getSessionCheckpoints(sessionId: string): Checkpoint[] {
  if (!checkpointStore.has(sessionId)) {
    checkpointStore.set(sessionId, []);
  }
  return checkpointStore.get(sessionId)!;
}

/**
 * Export for testing: clear all in-memory checkpoints.
 */
export function clearCheckpointStore(): void {
  checkpointStore.clear();
}

export function createCheckpointsRouter() {
  const router = new Hono();

  // GET /api/sessions/:sessionId/checkpoints - List checkpoints
  router.get('/', (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ error: 'Session ID required', code: 'VALIDATION_ERROR' }, 400);
    }

    const checkpoints = getSessionCheckpoints(sessionId);
    return c.json({ checkpoints });
  });

  // POST /api/sessions/:sessionId/checkpoints - Create a checkpoint
  router.post('/', async (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ error: 'Session ID required', code: 'VALIDATION_ERROR' }, 400);
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

    const checkpoints = getSessionCheckpoints(sessionId);
    const turnIndex = parsed.data.turnIndex ?? checkpoints.length;

    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      userMessageId: parsed.data.userMessageId,
      promptPreview: parsed.data.promptPreview.slice(0, 50),
      timestamp: new Date().toISOString(),
      filesChanged: parsed.data.filesChanged,
      turnIndex,
    };

    checkpoints.push(checkpoint);
    return c.json(checkpoint, 201);
  });

  // GET /api/sessions/:sessionId/checkpoints/:id/preview - Preview a rewind
  router.get('/:id/preview', (c) => {
    const sessionId = c.req.param('sessionId');
    const checkpointId = c.req.param('id');

    const checkpoints = getSessionCheckpoints(sessionId);
    const checkpointIndex = checkpoints.findIndex((cp) => cp.id === checkpointId);
    if (checkpointIndex === -1) {
      return c.json({ error: 'Checkpoint not found', code: 'NOT_FOUND' }, 404);
    }

    const checkpoint = checkpoints[checkpointIndex];

    // Collect all files affected from this checkpoint forward
    const laterCheckpoints = checkpoints.slice(checkpointIndex);
    const filesAffected = [
      ...new Set(laterCheckpoints.flatMap((cp) => cp.filesChanged.map((fc) => fc.path))),
    ];

    // Messages removed = number of checkpoints after this one (each represents a turn)
    const messagesRemoved = checkpoints.length - checkpointIndex - 1;

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

    const checkpoints = getSessionCheckpoints(sessionId);
    const checkpointIndex = checkpoints.findIndex((cp) => cp.id === checkpointId);
    if (checkpointIndex === -1) {
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

    // MVP: truncate checkpoints to the selected one (inclusive)
    // Actual SDK rewindFiles() integration will come later
    const remaining = checkpoints.slice(0, checkpointIndex + 1);
    checkpointStore.set(sessionId, remaining);

    const modeLabels: Record<string, string> = {
      code_and_conversation: 'Rewound code and conversation',
      conversation_only: 'Rewound conversation only',
      code_only: 'Rewound code only',
    };

    return c.json({
      success: true,
      message: `${modeLabels[parsed.data.mode]} to turn ${checkpoints[checkpointIndex].turnIndex}`,
    });
  });

  return router;
}
