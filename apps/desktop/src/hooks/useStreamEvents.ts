import { useReducer, useCallback } from 'react';
import type { StreamEvent } from '@claude-tauri/shared';

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
  /** Maps blockIndex -> toolUseId for correlating deltas to tool calls */
  blockIndexToToolId: Map<number, string>;
  /** Pending permission requests awaiting user decision */
  pendingPermissions: Map<string, PendingPermission>;
  /** Denied permission records for display in chat */
  deniedPermissions: DeniedPermission[];
  /** Current plan state */
  plan: PlanState | null;
  /** Cumulative token usage across the entire session */
  cumulativeUsage: CumulativeUsage;
  /** Whether the SDK is currently compacting context */
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
    return {
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
  }

  if (action.type === 'RESOLVE_PERMISSION') {
    const newPending = new Map(state.pendingPermissions);
    newPending.delete(action.requestId);
    return { ...state, pendingPermissions: newPending };
  }

  if (action.type === 'APPROVE_PLAN') {
    if (!state.plan) return state;
    return {
      ...state,
      plan: { ...state.plan, status: 'approved' },
    };
  }

  if (action.type === 'REJECT_PLAN') {
    if (!state.plan) return state;
    return {
      ...state,
      plan: {
        ...state.plan,
        status: 'rejected',
        feedback: action.feedback,
      },
    };
  }

  const event = action.event;

  switch (event.type) {
    case 'session:init': {
      return {
        ...state,
        sessionInfo: {
          sessionId: event.sessionId,
          model: event.model,
          tools: event.tools ?? [],
          mcpServers: event.mcpServers ?? [],
          claudeCodeVersion: event.claudeCodeVersion ?? '',
          slashCommands: event.slashCommands ?? [],
        },
      };
    }

    case 'block:start': {
      if (event.blockType === 'tool_use' && event.toolUseId && event.toolName) {
        const newToolCalls = new Map(state.toolCalls);
        newToolCalls.set(event.toolUseId, {
          toolUseId: event.toolUseId,
          name: event.toolName,
          status: 'running',
          input: '',
        });
        const newBlockIndex = new Map(state.blockIndexToToolId);
        newBlockIndex.set(event.blockIndex, event.toolUseId);
        return {
          ...state,
          toolCalls: newToolCalls,
          blockIndexToToolId: newBlockIndex,
        };
      }
      if (event.blockType === 'thinking') {
        const newThinking = new Map(state.thinkingBlocks);
        newThinking.set(`block-${event.blockIndex}`, '');
        return { ...state, thinkingBlocks: newThinking };
      }
      return state;
    }

    case 'tool-input:delta': {
      const toolId = state.blockIndexToToolId.get(event.blockIndex);
      if (!toolId) return state;
      const existing = state.toolCalls.get(toolId);
      if (!existing) return state;
      const newToolCalls = new Map(state.toolCalls);
      newToolCalls.set(toolId, {
        ...existing,
        input: existing.input + event.partialJson,
      });
      return { ...state, toolCalls: newToolCalls };
    }

    case 'tool:result': {
      const existing = state.toolCalls.get(event.toolUseId);
      if (!existing) return state;
      const ciFailures =
        existing.name === 'Bash'
          ? extractCiFailuresFromToolResult(event.result)
          : undefined;
      const newToolCalls = new Map(state.toolCalls);
      newToolCalls.set(event.toolUseId, {
        ...existing,
        status: 'complete',
        result: event.result,
        ciFailures: ciFailures ?? existing.ciFailures,
      });
      return { ...state, toolCalls: newToolCalls };
    }

    case 'tool:progress': {
      const existing = state.toolCalls.get(event.toolUseId);
      if (!existing) return state;
      const newToolCalls = new Map(state.toolCalls);
      newToolCalls.set(event.toolUseId, {
        ...existing,
        elapsedSeconds: event.elapsedSeconds,
      });
      return { ...state, toolCalls: newToolCalls };
    }

    case 'tool:summary': {
      const existing = state.toolCalls.get(event.toolUseId);
      if (!existing) return state;
      const newToolCalls = new Map(state.toolCalls);
      newToolCalls.set(event.toolUseId, {
        ...existing,
        summary: event.summary,
      });
      return { ...state, toolCalls: newToolCalls };
    }

    case 'thinking:delta': {
      const key = `block-${event.blockIndex}`;
      const existing = state.thinkingBlocks.get(key);
      if (existing === undefined) return state;
      const newThinking = new Map(state.thinkingBlocks);
      newThinking.set(key, existing + event.thinking);
      return { ...state, thinkingBlocks: newThinking };
    }

    case 'error': {
      return {
        ...state,
        errors: [
          ...state.errors,
          { errorType: event.errorType, message: event.message },
        ],
      };
    }

    case 'session:result': {
      return {
        ...state,
        usage: {
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
          cacheReadTokens: event.usage.cacheReadTokens,
          cacheCreationTokens: event.usage.cacheCreationTokens,
          costUsd: event.costUsd,
          durationMs: event.durationMs,
        },
        cumulativeUsage: {
          inputTokens: state.cumulativeUsage.inputTokens + event.usage.inputTokens,
          outputTokens: state.cumulativeUsage.outputTokens + event.usage.outputTokens,
          cacheReadTokens: state.cumulativeUsage.cacheReadTokens + event.usage.cacheReadTokens,
          cacheCreationTokens: state.cumulativeUsage.cacheCreationTokens + event.usage.cacheCreationTokens,
        },
      };
    }

    case 'status': {
      return {
        ...state,
        isCompacting: event.status === 'compacting',
      };
    }

    case 'compact-boundary': {
      return {
        ...state,
        isCompacting: false,
      };
    }

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
      return state;
  }
}

function extractCiFailuresFromToolResult(result: unknown): {
  summary: string;
  checks: string[];
  rawOutput: string;
} | null {
  const rawOutput = stringifyToolResult(result);
  if (!rawOutput || rawOutput.length < 8) return null;

  const normalizedOutput = rawOutput.replace(/\u001b\[[0-9;]*m/g, '');
  const hasFailureSignal =
    /\b(fail(?:ed|ing)?|timed out|exit code|errored|error|❌|✗)\b/i.test(
      normalizedOutput
    );
  if (!hasFailureSignal) return null;

  const checks = normalizedOutput
    .split('\n')
    .map((line) => line.trim())
    .map((line) =>
      line
        .replace(/^[\-*+•]\s*/, '')
        .replace(/^\*+\s*/, '')
        .trim()
    )
    .filter((line) => {
      if (!line) return false;
      const failed = /\b(fail(?:ed|ing)?|timed out|exit code|errored|error)\b/i.test(
        line
      );
      const failedSymbol = /[❌✗]\s/.test(line) || /\s[❌✗]$/.test(line);
      const hasCiContext =
        /\b(check|checks|workflow|workflows|action|actions|job|jobs|pipeline|pipelines|test|lint|build|deploy|publish|pull request)\b/i.test(
          line
        ) || /\bCI\b/.test(line);
      const isProcessResult = /process completed with exit code/i.test(line);
      return failed || failedSymbol || isProcessResult ? failedSymbol || hasCiContext || isProcessResult : false;
    });

  if (checks.length === 0) return null;

  return {
    summary: `${checks.length} failing CI checks detected`,
    checks,
    rawOutput,
  };
}

function stringifyToolResult(result: unknown): string {
  if (typeof result === 'string') return result;
  if (typeof result === 'number' || typeof result === 'boolean') {
    return String(result);
  }
  if (result == null) return '';

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

// --- Hook ---

export function useStreamEvents() {
  const [state, dispatch] = useReducer(
    streamEventsReducer,
    initialStreamEventsState
  );

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

  /**
   * onData callback compatible with useChat's data channel.
   * Parses incoming data items and dispatches them as stream events.
   */
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
