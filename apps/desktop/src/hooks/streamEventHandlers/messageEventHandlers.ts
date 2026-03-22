import type { StreamEventsState } from '../useStreamEvents';
import type { StreamEvent } from '@claude-tauri/shared';

/**
 * Handles message-level events: block:start (thinking), thinking:delta, error.
 */
export function handleMessageEvent(
  state: StreamEventsState,
  event: StreamEvent
): StreamEventsState | null {
  switch (event.type) {
    case 'block:start': {
      if (event.blockType === 'thinking') {
        const newThinking = new Map(state.thinkingBlocks);
        newThinking.set(`block-${event.blockIndex}`, '');
        return { ...state, thinkingBlocks: newThinking };
      }
      return null; // Not a message event
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

    default:
      return null;
  }
}
