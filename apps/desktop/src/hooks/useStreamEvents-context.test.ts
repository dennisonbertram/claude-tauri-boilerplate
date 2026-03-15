import { describe, it, expect } from 'vitest';
import { streamEventsReducer, initialStreamEventsState } from './useStreamEvents';
import type { StreamEvent } from '@claude-tauri/shared';

describe('streamEventsReducer - context tracking', () => {
  describe('cumulative usage from session:result events', () => {
    it('accumulates inputTokens across multiple session:result events', () => {
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'session:result',
          success: true,
          subtype: 'complete',
          costUsd: 0.01,
          durationMs: 1000,
          numTurns: 1,
          usage: {
            inputTokens: 500,
            outputTokens: 200,
            cacheReadTokens: 100,
            cacheCreationTokens: 50,
          },
        } as StreamEvent,
      });

      expect(state.cumulativeUsage.inputTokens).toBe(500);
      expect(state.cumulativeUsage.outputTokens).toBe(200);
      expect(state.cumulativeUsage.cacheReadTokens).toBe(100);
      expect(state.cumulativeUsage.cacheCreationTokens).toBe(50);

      // Second result event
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'session:result',
          success: true,
          subtype: 'complete',
          costUsd: 0.02,
          durationMs: 2000,
          numTurns: 1,
          usage: {
            inputTokens: 1000,
            outputTokens: 400,
            cacheReadTokens: 200,
            cacheCreationTokens: 100,
          },
        } as StreamEvent,
      });

      expect(state.cumulativeUsage.inputTokens).toBe(1500);
      expect(state.cumulativeUsage.outputTokens).toBe(600);
      expect(state.cumulativeUsage.cacheReadTokens).toBe(300);
      expect(state.cumulativeUsage.cacheCreationTokens).toBe(150);
    });

    it('starts with zero cumulative usage', () => {
      expect(initialStreamEventsState.cumulativeUsage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      });
    });
  });

  describe('compaction status tracking', () => {
    it('sets isCompacting to true on status:compacting event', () => {
      const state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'status',
          status: 'compacting',
        } as StreamEvent,
      });

      expect(state.isCompacting).toBe(true);
    });

    it('sets isCompacting to false on status:null event', () => {
      // First set compacting
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'status',
          status: 'compacting',
        } as StreamEvent,
      });
      expect(state.isCompacting).toBe(true);

      // Then clear it
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'status',
          status: null,
        } as StreamEvent,
      });
      expect(state.isCompacting).toBe(false);
    });

    it('sets isCompacting to false on compact-boundary event', () => {
      // First set compacting
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'status',
          status: 'compacting',
        } as StreamEvent,
      });
      expect(state.isCompacting).toBe(true);

      // compact-boundary means compaction is done
      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'compact-boundary',
        } as StreamEvent,
      });
      expect(state.isCompacting).toBe(false);
    });

    it('starts with isCompacting false', () => {
      expect(initialStreamEventsState.isCompacting).toBe(false);
    });
  });

  describe('RESET action resets cumulative usage and compaction', () => {
    it('resets cumulativeUsage and isCompacting on RESET', () => {
      let state = streamEventsReducer(initialStreamEventsState, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'session:result',
          success: true,
          subtype: 'complete',
          costUsd: 0.01,
          durationMs: 1000,
          numTurns: 1,
          usage: {
            inputTokens: 500,
            outputTokens: 200,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
          },
        } as StreamEvent,
      });

      state = streamEventsReducer(state, {
        type: 'PROCESS_EVENT',
        event: {
          type: 'status',
          status: 'compacting',
        } as StreamEvent,
      });

      expect(state.cumulativeUsage.inputTokens).toBe(500);
      expect(state.isCompacting).toBe(true);

      state = streamEventsReducer(state, { type: 'RESET' });

      expect(state.cumulativeUsage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      });
      expect(state.isCompacting).toBe(false);
    });
  });
});
