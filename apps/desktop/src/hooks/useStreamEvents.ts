import { useReducer, useCallback } from 'react';
import type { StreamEvent } from '@claude-tauri/shared';
import {
  handleToolEvent,
  handleMessageEvent,
  handleSystemEvent,
  handlePermissionPlanEvent,
} from './streamEventHandlers';

// --- State Types ---

export interface ToolCallState {
  toolUseId: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  input: string;
  result?: unknown;
  elapsedSeconds?: number;
  summary?: string;
  ciFailures?: {
    summary: string;
    checks: string[];
    rawOutput: string;
  };
}

export interface PendingPermission {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface DeniedPermission {
  requestId: string;
  toolName: string;
}

export interface ErrorState {
  errorType: string;
  message: string;
}

export interface UsageState {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
}

export type PlanStatus = 'idle' | 'planning' | 'review' | 'approved' | 'rejected';

export interface PlanState {
  planId: string;
  status: PlanStatus;
  content: string;
  feedback?: string;
}

export interface CumulativeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface StreamEventsState {
  toolCalls: Map<string, ToolCallState>;
  thinkingBlocks: Map<string, string>;
  errors: ErrorState[];
  usage: UsageState | null;
  sessionInfo: {
    sessionId: string;
    model: string;
    tools: string[];
    mcpServers: Array<{ name: string; status: string }>;
    claudeCodeVersion: string;
    slashCommands: string[];
  } | null;
  blockIndexToToolId: Map<number, string>;
  pendingPermissions: Map<string, PendingPermission>;
  deniedPermissions: DeniedPermission[];
  plan: PlanState | null;
  cumulativeUsage: CumulativeUsage;
  isCompacting: boolean;
}

// --- Actions ---

type StreamEventsAction =
  | { type: 'PROCESS_EVENT'; event: StreamEvent }
  | { type: 'RESOLVE_PERMISSION'; requestId: string }
  | { type: 'APPROVE_PLAN'; planId: string }
  | { type: 'REJECT_PLAN'; planId: string; feedback?: string }
  | { type: 'RESET' };

// --- Initial State ---

export const initialStreamEventsState: StreamEventsState = {
  toolCalls: new Map(),
  thinkingBlocks: new Map(),
  errors: [],
  usage: null,
  sessionInfo: null,
  blockIndexToToolId: new Map(),
  pendingPermissions: new Map(),
  deniedPermissions: [],
  plan: null,
  cumulativeUsage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  },
  isCompacting: false,
};

// --- Reducer ---

export function streamEventsReducer(
  state: StreamEventsState,
  action: StreamEventsAction
): StreamEventsState {
  if (action.type === 'RESET') {
    return { ...initialStreamEventsState, toolCalls: new Map(), thinkingBlocks: new Map(), blockIndexToToolId: new Map(), pendingPermissions: new Map(), deniedPermissions: [], errors: [], cumulativeUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 } };
  }

  if (action.type === 'RESOLVE_PERMISSION') {
    const newPending = new Map(state.pendingPermissions);
    newPending.delete(action.requestId);
    return { ...state, pendingPermissions: newPending };
  }

  if (action.type === 'APPROVE_PLAN') {
    if (!state.plan) return state;
    return { ...state, plan: { ...state.plan, status: 'approved' } };
  }

  if (action.type === 'REJECT_PLAN') {
    if (!state.plan) return state;
    return { ...state, plan: { ...state.plan, status: 'rejected', feedback: action.feedback } };
  }

  // Delegate to specialized handlers; first non-null result wins
  const event = action.event;
  return (
    handleToolEvent(state, event) ??
    handleMessageEvent(state, event) ??
    handleSystemEvent(state, event) ??
    handlePermissionPlanEvent(state, event) ??
    state
  );
}

// --- Hook ---

export function useStreamEvents() {
  const [state, dispatch] = useReducer(streamEventsReducer, initialStreamEventsState);

  const processEvent = useCallback((event: StreamEvent) => {
    dispatch({ type: 'PROCESS_EVENT', event });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const resolvePermission = useCallback((requestId: string) => {
    dispatch({ type: 'RESOLVE_PERMISSION', requestId });
  }, []);

  const approvePlan = useCallback((planId: string) => {
    dispatch({ type: 'APPROVE_PLAN', planId });
  }, []);

  const rejectPlan = useCallback((planId: string, feedback?: string) => {
    dispatch({ type: 'REJECT_PLAN', planId, feedback });
  }, []);

  const onData = useCallback(
    (data: unknown[]) => {
      for (const item of data) {
        try {
          const event =
            typeof item === 'string'
              ? (JSON.parse(item) as StreamEvent)
              : (item as StreamEvent);
          if (event && typeof event === 'object' && 'type' in event) {
            processEvent(event);
          }
        } catch {
          // Silently skip unparseable data items
        }
      }
    },
    [processEvent]
  );

  return {
    ...state,
    processEvent,
    reset,
    resolvePermission,
    approvePlan,
    rejectPlan,
    onData,
  };
}
