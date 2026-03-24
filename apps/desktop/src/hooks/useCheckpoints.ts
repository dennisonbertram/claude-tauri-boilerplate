import { useState, useCallback, useEffect, useRef } from 'react';
import type { Checkpoint, FileChange, RewindPreview } from '@claude-tauri/shared';
import type { ToolCallState } from './useStreamEvents';
import { apiFetch } from '../lib/api-config';

/** Tool names that indicate file changes */
const FILE_CHANGE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

/**
 * Infer a FileChange from a tool call's input.
 * Parses the JSON input to extract file path and action.
 */
function inferFileChange(toolCall: ToolCallState): FileChange | null {
  if (!FILE_CHANGE_TOOLS.has(toolCall.name)) return null;

  try {
    const input = typeof toolCall.input === 'string' ? JSON.parse(toolCall.input) : toolCall.input;
    const path = input?.file_path ?? input?.path ?? input?.filePath ?? 'unknown';

    let action: FileChange['action'] = 'modified';
    if (toolCall.name === 'Write') {
      action = 'created';
    }

    return { path, action, tool: toolCall.name };
  } catch {
    return { path: 'unknown', action: 'modified', tool: toolCall.name };
  }
}

export interface UseCheckpointsOptions {
  sessionId: string | null;
  toolCalls: Map<string, ToolCallState>;
  /** Current user message text (for prompt preview) */
  lastUserPrompt: string;
  /** Latest user message ID */
  userMessageId: string;
  /** Whether the current turn is still streaming */
  isStreaming: boolean;
}

export interface UseCheckpointsReturn {
  checkpoints: Checkpoint[];
  addCheckpoint: (checkpoint: Omit<Checkpoint, 'id' | 'timestamp'>) => Promise<Checkpoint | null>;
  previewRewind: (checkpointId: string) => Promise<RewindPreview | null>;
  executeRewind: (checkpointId: string, mode: 'code_and_conversation' | 'conversation_only' | 'code_only') => Promise<boolean>;
  reset: () => void;
}

export function useCheckpoints({
  sessionId,
  toolCalls,
  lastUserPrompt,
  userMessageId,
  isStreaming,
}: UseCheckpointsOptions): UseCheckpointsReturn {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const processedTurnsRef = useRef<Set<string>>(new Set());
  const prevSessionIdRef = useRef<string | null>(null);
  const prevIsStreamingRef = useRef<boolean>(false);

  // Fetch existing checkpoints when session changes
  useEffect(() => {
    if (!sessionId) {
      setCheckpoints([]);
      processedTurnsRef.current.clear();
      prevSessionIdRef.current = null;
      prevIsStreamingRef.current = false;
      return;
    }

    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      processedTurnsRef.current.clear();
      prevIsStreamingRef.current = false;
    }

    let cancelled = false;

    async function loadCheckpoints() {
      try {
        const res = await apiFetch(`/api/sessions/${sessionId}/checkpoints`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setCheckpoints(data.checkpoints ?? []);
        }
      } catch {
        // Server not reachable
      }
    }

    loadCheckpoints();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Create exactly one checkpoint when a turn finishes (streaming -> idle),
  // even if there were no file changes.
  useEffect(() => {
    if (!sessionId || !userMessageId) return;

    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;
    if (!wasStreaming || isStreaming) return;

    if (processedTurnsRef.current.has(userMessageId)) return;
    processedTurnsRef.current.add(userMessageId);

    const allChanges: FileChange[] = [];
    for (const [, tc] of toolCalls) {
      if (tc.status === 'complete') {
        const change = inferFileChange(tc);
        if (change) allChanges.push(change);
      }
    }

    void (async () => {
      try {
        const res = await apiFetch(`/api/sessions/${sessionId}/checkpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessageId,
            promptPreview: lastUserPrompt.slice(0, 50),
            filesChanged: allChanges,
          }),
        });

        if (res.ok) {
          const cp: Checkpoint = await res.json();
          setCheckpoints((prev) => [...prev, cp]);
        }
      } catch {
        // Silently fail - checkpoint creation is non-critical
      }
    })();
  }, [sessionId, toolCalls, lastUserPrompt, userMessageId, isStreaming]);

  const addCheckpoint = useCallback(
    async (data: Omit<Checkpoint, 'id' | 'timestamp'>): Promise<Checkpoint | null> => {
      if (!sessionId) return null;

      try {
        const res = await apiFetch(`/api/sessions/${sessionId}/checkpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessageId: data.userMessageId,
            promptPreview: data.promptPreview,
            filesChanged: data.filesChanged,
            turnIndex: data.turnIndex,
          }),
        });

        if (!res.ok) return null;
        const cp: Checkpoint = await res.json();
        setCheckpoints((prev) => [...prev, cp]);
        return cp;
      } catch {
        return null;
      }
    },
    [sessionId]
  );

  const previewRewind = useCallback(
    async (checkpointId: string): Promise<RewindPreview | null> => {
      if (!sessionId) return null;

      try {
        const res = await apiFetch(
          `/api/sessions/${sessionId}/checkpoints/${checkpointId}/preview`
        );
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    [sessionId]
  );

  const executeRewind = useCallback(
    async (
      checkpointId: string,
      mode: 'code_and_conversation' | 'conversation_only' | 'code_only'
    ): Promise<boolean> => {
      if (!sessionId) return false;

      try {
        const res = await apiFetch(
          `/api/sessions/${sessionId}/checkpoints/${checkpointId}/rewind`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode }),
          }
        );

        if (!res.ok) return false;

        // Reload checkpoints after rewind
        const listRes = await apiFetch(`/api/sessions/${sessionId}/checkpoints`);
        if (listRes.ok) {
          const data = await listRes.json();
          setCheckpoints(data.checkpoints ?? []);
        }

        return true;
      } catch {
        return false;
      }
    },
    [sessionId]
  );

  const reset = useCallback(() => {
    setCheckpoints([]);
    processedTurnsRef.current.clear();
    prevIsStreamingRef.current = false;
  }, []);

  return {
    checkpoints,
    addCheckpoint,
    previewRewind,
    executeRewind,
    reset,
  };
}
