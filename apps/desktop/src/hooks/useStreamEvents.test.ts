import { describe, it, expect } from 'vitest';
import { streamEventsReducer, initialStreamEventsState } from './useStreamEvents';
import type { StreamEvent } from '@claude-tauri/shared';

describe('streamEventsReducer', () => {
  it('returns initial state for unknown action type', () => {
    const state = streamEventsReducer(initialStreamEventsState, {
      type: 'PROCESS_EVENT',
      event: { type: 'compact-boundary' } as StreamEvent,
    });
    // compact-boundary is a no-op, state should be unchanged
    expect(state).toEqual(initialStreamEventsState);
  });

  describe('session:init', () => {
    it('sets sessionInfo from session:init event', () => {
      const event: StreamEvent = {
        type: 'session:init',
        sessionId: 'sess-123',
        model: 'claude-opus-4',
        tools: ['Read', 'Write', 'Bash'],
        mcpServers: [],
        claudeCodeVersion: '1.0.0',
      };
      const state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event,
      });
      expect(state.sessionInfo).toEqual({
        sessionId: 'sess-123',
        model: 'claude-opus-4',
      });
    });
  });

  describe('block:start with tool_use', () => {
    it('adds a tool call with status running when block type is tool_use', () => {
      const event: StreamEvent = {
        type: 'block:start',
        blockIndex: 1,
        blockType: 'tool_use',
        toolUseId: 'tool-1',
        toolName: 'Read',
      };
      const state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event,
      });
      expect(state.toolCalls.size).toBe(1);
      const toolCall = state.toolCalls.get('tool-1');
      expect(toolCall).toBeDefined();
      expect(toolCall!.status).toBe('running');
      expect(toolCall!.name).toBe('Read');
      expect(toolCall!.input).toBe('');
    });

    it('starts a thinking block when block type is thinking', () => {
      const event: StreamEvent = {
        type: 'block:start',
        blockIndex: 0,
        blockType: 'thinking',
      };
      const state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event,
      });
      expect(state.thinkingBlocks.size).toBe(1);
      expect(state.thinkingBlocks.get('block-0')).toBe('');
    });
  });

  describe('tool-input:delta', () => {
    it('appends partial JSON to the tool call input', () => {
      // First start the tool
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'block:start',
          blockIndex: 1,
          blockType: 'tool_use',
          toolUseId: 'tool-1',
          toolName: 'Bash',
        },
      });
      // Then send input delta
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'tool-input:delta',
          partialJson: '{"command":',
          blockIndex: 1,
        },
      });
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'tool-input:delta',
          partialJson: '"ls -la"}',
          blockIndex: 1,
        },
      });
      const toolCall = state.toolCalls.get('tool-1');
      expect(toolCall!.input).toBe('{"command":"ls -la"}');
    });
  });

  describe('tool:result', () => {
    it('updates tool call with result and sets status to complete', () => {
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'block:start',
          blockIndex: 1,
          blockType: 'tool_use',
          toolUseId: 'tool-1',
          toolName: 'Read',
        },
      });
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'tool:result',
          toolUseId: 'tool-1',
          result: 'file contents here',
        },
      });
      const toolCall = state.toolCalls.get('tool-1');
      expect(toolCall!.status).toBe('complete');
      expect(toolCall!.result).toBe('file contents here');
    });
  });

  describe('thinking:delta', () => {
    it('appends text to the thinking block', () => {
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'block:start',
          blockIndex: 0,
          blockType: 'thinking',
        },
      });
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'thinking:delta',
          thinking: 'Let me think about ',
          blockIndex: 0,
        },
      });
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'thinking:delta',
          thinking: 'this problem...',
          blockIndex: 0,
        },
      });
      expect(state.thinkingBlocks.get('block-0')).toBe(
        'Let me think about this problem...'
      );
    });
  });

  describe('error', () => {
    it('adds errors to the errors array', () => {
      const state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'error',
          errorType: 'api_error',
          message: 'Rate limit exceeded',
        },
      });
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0]).toEqual({
        errorType: 'api_error',
        message: 'Rate limit exceeded',
      });
    });

    it('accumulates multiple errors', () => {
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'error',
          errorType: 'api_error',
          message: 'Error 1',
        },
      });
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'error',
          errorType: 'timeout',
          message: 'Error 2',
        },
      });
      expect(state.errors).toHaveLength(2);
    });
  });

  describe('session:result (usage)', () => {
    it('sets usage from session:result event', () => {
      const state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'session:result',
          success: true,
          subtype: 'complete',
          costUsd: 0.05,
          durationMs: 3000,
          numTurns: 1,
          usage: {
            inputTokens: 500,
            outputTokens: 200,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
          },
        },
      });
      expect(state.usage).toEqual({
        inputTokens: 500,
        outputTokens: 200,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.05,
        durationMs: 3000,
      });
    });
  });

  describe('RESET action', () => {
    it('resets state to initial', () => {
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'error',
          errorType: 'test',
          message: 'test error',
        },
      });
      expect(state.errors).toHaveLength(1);

      state = streamEventsReducer(state, { type: 'RESET' });
      expect(state).toEqual(initialStreamEventsState);
    });
  });

  describe('tool:progress', () => {
    it('updates elapsed time on a running tool call', () => {
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'block:start',
          blockIndex: 1,
          blockType: 'tool_use',
          toolUseId: 'tool-1',
          toolName: 'Bash',
        },
      });
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'tool:progress',
          toolUseId: 'tool-1',
          toolName: 'Bash',
          elapsedSeconds: 5,
        },
      });
      const toolCall = state.toolCalls.get('tool-1');
      expect(toolCall!.elapsedSeconds).toBe(5);
    });
  });

  describe('tool:summary', () => {
    it('adds summary to a tool call', () => {
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'block:start',
          blockIndex: 1,
          blockType: 'tool_use',
          toolUseId: 'tool-1',
          toolName: 'Read',
        },
      });
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'tool:summary',
          toolUseId: 'tool-1',
          toolName: 'Read',
          summary: 'Read file /src/index.ts (42 lines)',
        },
      });
      const toolCall = state.toolCalls.get('tool-1');
      expect(toolCall!.summary).toBe('Read file /src/index.ts (42 lines)');
    });
  });

  describe('blockIndex-based tool lookup', () => {
    it('handles tool-input:delta by looking up tool via blockIndex mapping', () => {
      // Start tool at blockIndex 2
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'block:start',
          blockIndex: 2,
          blockType: 'tool_use',
          toolUseId: 'tool-abc',
          toolName: 'Edit',
        },
      });
      // Input delta references blockIndex 2
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'tool-input:delta',
          partialJson: '{"file":"test.ts"}',
          blockIndex: 2,
        },
      });
      expect(state.toolCalls.get('tool-abc')!.input).toBe('{"file":"test.ts"}');
    });
  });
});
