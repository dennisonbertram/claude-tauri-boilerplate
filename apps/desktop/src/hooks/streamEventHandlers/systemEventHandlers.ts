import type { StreamEventsState } from '../useStreamEvents';
import type { StreamEvent } from '@claude-tauri/shared';

/**
 * Handles system/session events: session:init, session:result, status, compact-boundary.
 */
export function handleSystemEvent(
  state: StreamEventsState,
  event: StreamEvent
): StreamEventsState | null {
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

    default:
      return null;
  }
}
