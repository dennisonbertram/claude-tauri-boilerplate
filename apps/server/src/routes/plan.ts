import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import type { PlanDecisionRequest, PlanDecisionAction } from '@claude-tauri/shared';
import { planStore } from '../services/plan-store';

const VALID_DECISIONS: PlanDecisionAction[] = ['approve', 'reject'];

export function createPlanRouter(_db: Database) {
  const router = new Hono();

  /**
   * POST /
   * Receives a plan decision from the frontend and resolves
   * the pending plan request in the plan store.
   */
  router.post('/', async (c) => {
    const body = (await c.req.json()) as Partial<PlanDecisionRequest>;

    // Validate required fields
    if (!body.sessionId) {
      return c.json({ error: 'sessionId is required' }, 400);
    }
    if (!body.planId) {
      return c.json({ error: 'planId is required' }, 400);
    }
    if (!body.decision) {
      return c.json({ error: 'decision is required' }, 400);
    }
    if (!VALID_DECISIONS.includes(body.decision as PlanDecisionAction)) {
      return c.json(
        { error: `decision must be one of: ${VALID_DECISIONS.join(', ')}` },
        400
      );
    }

    const { planId, decision, feedback } = body as PlanDecisionRequest;

    // Resolve the pending plan decision (if it exists).
    planStore.resolveDecision(planId, {
      decision,
      feedback: feedback ?? undefined,
    });

    return c.json({
      ok: true,
      planId,
      decision,
      feedback: feedback ?? undefined,
    });
  });

  return router;
}
