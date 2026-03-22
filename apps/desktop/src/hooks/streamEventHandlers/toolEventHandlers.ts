import type { StreamEventsState } from '../useStreamEvents';
import type { StreamEvent } from '@claude-tauri/shared';

/**
 * Handles tool-related stream events: block:start (tool_use), tool-input:delta,
 * tool:result, tool:progress, tool:summary.
 */
export function handleToolEvent(
  state: StreamEventsState,
  event: StreamEvent
): StreamEventsState | null {
  switch (event.type) {
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
      return null; // Not a tool event
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

    default:
      return null; // Not handled by this module
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
      const failed = /\b(fail(?:ed|ing)?|timed out|exit code|errored|error)\b/i.test(line);
      const failedSymbol = /[❌✗]\s/.test(line) || /\s[❌✗]$/.test(line);
      const hasCiContext =
        /\b(check|checks|workflow|workflows|action|actions|job|jobs|pipeline|pipelines|test|lint|build|deploy|publish|pull request)\b/i.test(line) ||
        /\bCI\b/.test(line);
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
  if (typeof result === 'number' || typeof result === 'boolean') return String(result);
  if (result == null) return '';
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}
