import type { PermissionDecisionAction, RiskLevel } from '@claude-tauri/shared';

/**
 * In-memory store for pending permission requests.
 *
 * When the SDK emits a permission request, the backend registers it here
 * and awaits a decision from the frontend. The frontend calls the
 * /api/chat/permission endpoint which resolves the pending promise.
 */
export class PermissionStore {
  /** Maps requestId -> resolve callback for pending permissions */
  private pending = new Map<string, (decision: PermissionDecisionAction) => void>();

  /** Maps sessionId -> Set of tool names that are always allowed for that session */
  private sessionAllowed = new Map<string, Set<string>>();

  /** High-risk tools that modify files or run commands */
  private static readonly HIGH_RISK_TOOLS = new Set([
    'Bash',
    'Write',
    'Edit',
    'NotebookEdit',
  ]);

  /** Low-risk read-only tools */
  private static readonly LOW_RISK_TOOLS = new Set([
    'Read',
    'Grep',
    'Glob',
    'WebFetch',
    'WebSearch',
  ]);

  /**
   * Register a pending permission request and return a promise that
   * resolves when the frontend sends a decision.
   */
  waitForDecision(requestId: string): Promise<PermissionDecisionAction> {
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
    });
  }

  /**
   * Resolve a pending permission request with a decision.
   * Returns true if the request was found and resolved, false otherwise.
   */
  resolveDecision(requestId: string, decision: PermissionDecisionAction): boolean {
    const resolve = this.pending.get(requestId);
    if (!resolve) return false;
    resolve(decision);
    this.pending.delete(requestId);
    return true;
  }

  /**
   * Check if a request is currently pending.
   */
  isPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  /**
   * Add a tool to the session-level always-allowed list.
   */
  addSessionAllowedTool(sessionId: string, toolName: string): void {
    if (!this.sessionAllowed.has(sessionId)) {
      this.sessionAllowed.set(sessionId, new Set());
    }
    this.sessionAllowed.get(sessionId)!.add(toolName);
  }

  /**
   * Check if a tool is allowed for a given session.
   */
  isToolAllowedForSession(sessionId: string, toolName: string): boolean {
    return this.sessionAllowed.get(sessionId)?.has(toolName) ?? false;
  }

  /**
   * Clear all session-level permissions.
   */
  clearSession(sessionId: string): void {
    this.sessionAllowed.delete(sessionId);
  }

  /**
   * Determine the risk level for a tool.
   */
  getRiskLevel(toolName: string): RiskLevel {
    if (PermissionStore.HIGH_RISK_TOOLS.has(toolName)) return 'high';
    if (PermissionStore.LOW_RISK_TOOLS.has(toolName)) return 'low';
    return 'medium';
  }
}

/** Singleton instance shared across the application */
export const permissionStore = new PermissionStore();
