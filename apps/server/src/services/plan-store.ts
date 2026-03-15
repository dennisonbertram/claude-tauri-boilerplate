import type { PlanDecisionAction } from '@claude-tauri/shared';

export interface PlanDecisionResult {
  decision: PlanDecisionAction;
  feedback?: string;
}

/**
 * In-memory store for pending plan decisions.
 *
 * When the SDK emits a plan_complete event, the backend registers it here
 * and awaits a decision from the frontend. The frontend calls the
 * /api/chat/plan endpoint which resolves the pending promise.
 */
export class PlanStore {
  /** Maps planId -> resolve callback for pending plan decisions */
  private pending = new Map<string, (result: PlanDecisionResult) => void>();

  /**
   * Register a pending plan decision and return a promise that
   * resolves when the frontend sends a decision.
   */
  waitForDecision(planId: string): Promise<PlanDecisionResult> {
    return new Promise((resolve) => {
      this.pending.set(planId, resolve);
    });
  }

  /**
   * Resolve a pending plan decision.
   * Returns true if the plan was found and resolved, false otherwise.
   */
  resolveDecision(planId: string, result: PlanDecisionResult): boolean {
    const resolve = this.pending.get(planId);
    if (!resolve) return false;
    resolve(result);
    this.pending.delete(planId);
    return true;
  }

  /**
   * Check if a plan decision is currently pending.
   */
  isPending(planId: string): boolean {
    return this.pending.has(planId);
  }
}

/** Singleton instance shared across the application */
export const planStore = new PlanStore();
