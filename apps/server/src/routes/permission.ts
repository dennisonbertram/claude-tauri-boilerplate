import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import type { PermissionResponse, PermissionDecisionAction } from '@claude-tauri/shared';
import { permissionStore } from '../services/permission-store';

const VALID_DECISIONS: PermissionDecisionAction[] = ['allow_once', 'allow_always', 'deny'];

export function createPermissionRouter(_db: Database) {
  const router = new Hono();

  /**
   * POST /
   * Receives a permission decision from the frontend and resolves
   * the pending permission request in the permission store.
   */
  router.post('/', async (c) => {
    const body = (await c.req.json()) as Partial<PermissionResponse>;

    // Validate required fields
    if (!body.sessionId) {
      return c.json({ error: 'sessionId is required' }, 400);
    }
    if (!body.requestId) {
      return c.json({ error: 'requestId is required' }, 400);
    }
    if (!body.decision) {
      return c.json({ error: 'decision is required' }, 400);
    }
    if (!VALID_DECISIONS.includes(body.decision as PermissionDecisionAction)) {
      return c.json(
        { error: `decision must be one of: ${VALID_DECISIONS.join(', ')}` },
        400
      );
    }

    const { sessionId, requestId, decision, scope } = body as PermissionResponse;

    // If "always allow", register the tool in session-level allowed list
    if (decision === 'allow_always' && scope === 'session') {
      // We don't have the toolName here directly, but the store can be
      // updated by the caller. For now, just resolve the decision.
    }

    // Resolve the pending permission request (if it exists).
    // Even if it doesn't exist (e.g., no SDK session is waiting),
    // we still return success -- the decision is recorded.
    permissionStore.resolveDecision(requestId, decision);

    return c.json({
      ok: true,
      requestId,
      decision,
      scope: scope ?? undefined,
    });
  });

  return router;
}
