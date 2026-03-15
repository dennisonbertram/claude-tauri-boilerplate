import { useReducer, useCallback } from 'react';
import type { StreamEvent } from '@claude-tauri/shared';

// --- Public Types ---

export type SubagentStatus = 'running' | 'completed' | 'failed' | 'stopped';

export interface SubagentNode {
  taskId: string;
  description: string;
  taskType?: string;
  status: SubagentStatus;
  startTime: number;
  progress?: string;
  summary?: string;
  usage?: { totalTokens: number; toolUses: number; durationMs: number };
  children: SubagentNode[];
}

export interface SubagentsState {
  /** Flat map of all agents by taskId for fast lookup */
  agentMap: Map<string, SubagentNode>;
  /** Top-level agent IDs (not nested under a parent) */
  rootIds: string[];
  /** Whether the panel is visible */
  isVisible: boolean;
}

// --- Actions ---

type SubagentsAction =
  | { type: 'TASK_STARTED'; taskId: string; description: string; taskType?: string }
  | { type: 'TASK_PROGRESS'; taskId: string; progress: string }
  | {
      type: 'TASK_NOTIFICATION';
      taskId: string;
      status: 'completed' | 'failed' | 'stopped';
      summary: string;
      usage?: { totalTokens: number; toolUses: number; durationMs: number };
    }
  | { type: 'TOGGLE_VISIBILITY' }
  | { type: 'RESET' };

// --- Initial State ---

const initialState: SubagentsState = {
  agentMap: new Map(),
  rootIds: [],
  isVisible: false,
};

// --- Helpers ---

/**
 * Derive parent task ID from a dot-separated ID convention.
 * E.g., "task-1.1" -> "task-1", "task-1.2.3" -> "task-1.2"
 * Returns null if there's no dot (top-level agent).
 */
function getParentId(taskId: string): string | null {
  const lastDotIdx = taskId.lastIndexOf('.');
  if (lastDotIdx === -1) return null;
  return taskId.substring(0, lastDotIdx);
}

/**
 * Convert unknown progress value to a string.
 */
function progressToString(progress: unknown): string {
  if (typeof progress === 'string') return progress;
  if (progress === null || progress === undefined) return '';
  return JSON.stringify(progress);
}

// --- Reducer ---

function subagentsReducer(state: SubagentsState, action: SubagentsAction): SubagentsState {
  switch (action.type) {
    case 'TASK_STARTED': {
      const newMap = new Map(state.agentMap);
      const node: SubagentNode = {
        taskId: action.taskId,
        description: action.description,
        taskType: action.taskType,
        status: 'running',
        startTime: Date.now(),
        children: [],
      };

      newMap.set(action.taskId, node);

      // Determine if this is a child of an existing agent
      const parentId = getParentId(action.taskId);
      let newRootIds = [...state.rootIds];

      if (parentId && newMap.has(parentId)) {
        // Add as child of parent
        const parent = newMap.get(parentId)!;
        const updatedParent: SubagentNode = {
          ...parent,
          children: [...parent.children, node],
        };
        newMap.set(parentId, updatedParent);
      } else {
        // Top-level agent
        newRootIds.push(action.taskId);
      }

      return {
        ...state,
        agentMap: newMap,
        rootIds: newRootIds,
        isVisible: true, // Auto-show on first agent
      };
    }

    case 'TASK_PROGRESS': {
      if (!state.agentMap.has(action.taskId)) return state;

      const newMap = new Map(state.agentMap);
      const existing = newMap.get(action.taskId)!;
      const updated: SubagentNode = {
        ...existing,
        progress: action.progress,
      };
      newMap.set(action.taskId, updated);

      // Also update the child reference in parent if applicable
      const parentId = getParentId(action.taskId);
      if (parentId && newMap.has(parentId)) {
        const parent = newMap.get(parentId)!;
        newMap.set(parentId, {
          ...parent,
          children: parent.children.map((c) =>
            c.taskId === action.taskId ? updated : c
          ),
        });
      }

      return { ...state, agentMap: newMap };
    }

    case 'TASK_NOTIFICATION': {
      if (!state.agentMap.has(action.taskId)) return state;

      const newMap = new Map(state.agentMap);
      const existing = newMap.get(action.taskId)!;
      const updated: SubagentNode = {
        ...existing,
        status: action.status,
        summary: action.summary,
        usage: action.usage,
      };
      newMap.set(action.taskId, updated);

      // Also update the child reference in parent if applicable
      const parentId = getParentId(action.taskId);
      if (parentId && newMap.has(parentId)) {
        const parent = newMap.get(parentId)!;
        newMap.set(parentId, {
          ...parent,
          children: parent.children.map((c) =>
            c.taskId === action.taskId ? updated : c
          ),
        });
      }

      return { ...state, agentMap: newMap };
    }

    case 'TOGGLE_VISIBILITY':
      return { ...state, isVisible: !state.isVisible };

    case 'RESET':
      return {
        agentMap: new Map(),
        rootIds: [],
        isVisible: false,
      };

    default:
      return state;
  }
}

// --- Hook ---

export function useSubagents() {
  const [state, dispatch] = useReducer(subagentsReducer, initialState);

  const processEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'task:started':
        dispatch({
          type: 'TASK_STARTED',
          taskId: event.taskId,
          description: event.description,
          taskType: event.taskType,
        });
        break;

      case 'task:progress':
        dispatch({
          type: 'TASK_PROGRESS',
          taskId: event.taskId,
          progress: progressToString(event.progress),
        });
        break;

      case 'task:notification':
        dispatch({
          type: 'TASK_NOTIFICATION',
          taskId: event.taskId,
          status: event.status,
          summary: event.summary,
          usage: event.usage,
        });
        break;

      default:
        // Ignore non-task events
        break;
    }
  }, []);

  const toggleVisibility = useCallback(() => {
    dispatch({ type: 'TOGGLE_VISIBILITY' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Derive the tree of top-level agents with their children
  const agents: SubagentNode[] = state.rootIds
    .map((id) => state.agentMap.get(id))
    .filter((a): a is SubagentNode => a !== undefined);

  // Count active (running) agents
  let activeCount = 0;
  for (const agent of state.agentMap.values()) {
    if (agent.status === 'running') activeCount++;
  }

  return {
    agents,
    activeCount,
    isVisible: state.isVisible,
    processEvent,
    toggleVisibility,
    reset,
  };
}
