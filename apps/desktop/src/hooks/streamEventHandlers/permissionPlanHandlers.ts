import type { StreamEventsState } from '../useStreamEvents';
import type { StreamEvent } from '@claude-tauri/shared';

/**
 * Handles permission and plan events: permission:request, permission:denied,
 * plan:start, plan:content, plan:complete, plan:approved, plan:rejected.
 */
export function handlePermissionPlanEvent(
  state: StreamEventsState,
  event: StreamEvent
): StreamEventsState | null {
  switch (event.type) {
    case 'permission:request': {
      const newPending = new Map(state.pendingPermissions);
      newPending.set(event.requestId, {
        requestId: event.requestId,
        toolName: event.toolName,
        toolInput: event.toolInput,
        riskLevel: event.riskLevel,
      });
      return { ...state, pendingPermissions: newPending };
    }

    case 'permission:denied': {
      const newPending = new Map(state.pendingPermissions);
      newPending.delete(event.requestId);
      return {
        ...state,
        pendingPermissions: newPending,
        deniedPermissions: [
          ...state.deniedPermissions,
          { requestId: event.requestId, toolName: event.toolName },
        ],
      };
    }

    case 'plan:start': {
      return {
        ...state,
        plan: {
          planId: event.planId,
          status: 'planning',
          content: '',
        },
      };
    }

    case 'plan:content': {
      if (!state.plan) return state;
      return {
        ...state,
        plan: {
          ...state.plan,
          content: state.plan.content + event.text,
        },
      };
    }

    case 'plan:complete': {
      if (!state.plan) return state;
      return {
        ...state,
        plan: {
          ...state.plan,
          status: 'review',
        },
      };
    }

    case 'plan:approved': {
      if (!state.plan) return state;
      return {
        ...state,
        plan: {
          ...state.plan,
          status: 'approved',
        },
      };
    }

    case 'plan:rejected': {
      if (!state.plan) return state;
      return {
        ...state,
        plan: {
          ...state.plan,
          status: 'rejected',
          feedback: event.feedback,
        },
      };
    }

    default:
      return null;
  }
}
