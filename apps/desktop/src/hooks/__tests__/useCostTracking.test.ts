import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCostTracking } from '../useCostTracking';

describe('useCostTracking', () => {
  describe('initial state', () => {
    it('starts with empty message costs array', () => {
      const { result } = renderHook(() => useCostTracking());
      expect(result.current.messageCosts).toEqual([]);
    });

    it('starts with zero session total', () => {
      const { result } = renderHook(() => useCostTracking());
      expect(result.current.sessionTotalCost).toBe(0);
    });
  });

  describe('addMessageCost', () => {
    it('adds a single message cost entry', () => {
      const { result } = renderHook(() => useCostTracking());

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-1',
          model: 'claude-opus-4',
          inputTokens: 5000,
          outputTokens: 1000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.15,
          durationMs: 2000,
        });
      });

      expect(result.current.messageCosts).toHaveLength(1);
      expect(result.current.messageCosts[0].messageId).toBe('msg-1');
      expect(result.current.messageCosts[0].costUsd).toBe(0.15);
    });

    it('accumulates multiple message costs', () => {
      const { result } = renderHook(() => useCostTracking());

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-1',
          model: 'claude-opus-4',
          inputTokens: 5000,
          outputTokens: 1000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.15,
          durationMs: 2000,
        });
      });

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-2',
          model: 'claude-sonnet-4',
          inputTokens: 3000,
          outputTokens: 500,
          cacheReadTokens: 1000,
          cacheCreationTokens: 0,
          costUsd: 0.03,
          durationMs: 1500,
        });
      });

      expect(result.current.messageCosts).toHaveLength(2);
    });

    it('updates session total when adding costs', () => {
      const { result } = renderHook(() => useCostTracking());

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-1',
          model: 'claude-opus-4',
          inputTokens: 5000,
          outputTokens: 1000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.15,
          durationMs: 2000,
        });
      });

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-2',
          model: 'claude-sonnet-4',
          inputTokens: 3000,
          outputTokens: 500,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.03,
          durationMs: 1500,
        });
      });

      expect(result.current.sessionTotalCost).toBeCloseTo(0.18, 4);
    });

    it('preserves message order (most recent last)', () => {
      const { result } = renderHook(() => useCostTracking());

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-1',
          model: 'claude-opus-4',
          inputTokens: 5000,
          outputTokens: 1000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.15,
          durationMs: 2000,
        });
      });

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-2',
          model: 'claude-sonnet-4',
          inputTokens: 3000,
          outputTokens: 500,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.03,
          durationMs: 1500,
        });
      });

      expect(result.current.messageCosts[0].messageId).toBe('msg-1');
      expect(result.current.messageCosts[1].messageId).toBe('msg-2');
    });

    it('stores all token breakdown fields', () => {
      const { result } = renderHook(() => useCostTracking());

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-1',
          model: 'claude-opus-4',
          inputTokens: 5000,
          outputTokens: 1000,
          cacheReadTokens: 2000,
          cacheCreationTokens: 500,
          costUsd: 0.20,
          durationMs: 3000,
        });
      });

      const cost = result.current.messageCosts[0];
      expect(cost.inputTokens).toBe(5000);
      expect(cost.outputTokens).toBe(1000);
      expect(cost.cacheReadTokens).toBe(2000);
      expect(cost.cacheCreationTokens).toBe(500);
      expect(cost.model).toBe('claude-opus-4');
      expect(cost.durationMs).toBe(3000);
    });
  });

  describe('reset', () => {
    it('clears all message costs', () => {
      const { result } = renderHook(() => useCostTracking());

      act(() => {
        result.current.addMessageCost({
          messageId: 'msg-1',
          model: 'claude-opus-4',
          inputTokens: 5000,
          outputTokens: 1000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.15,
          durationMs: 2000,
        });
      });

      expect(result.current.messageCosts).toHaveLength(1);

      act(() => {
        result.current.reset();
      });

      expect(result.current.messageCosts).toEqual([]);
      expect(result.current.sessionTotalCost).toBe(0);
    });
  });

  describe('session total aggregation', () => {
    it('correctly sums costs across many messages', () => {
      const { result } = renderHook(() => useCostTracking());

      const costs = [0.05, 0.12, 0.03, 0.08, 0.25];
      costs.forEach((costUsd, i) => {
        act(() => {
          result.current.addMessageCost({
            messageId: `msg-${i}`,
            model: 'claude-sonnet-4',
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            costUsd,
            durationMs: 1000,
          });
        });
      });

      const expectedTotal = costs.reduce((sum, c) => sum + c, 0);
      expect(result.current.sessionTotalCost).toBeCloseTo(expectedTotal, 4);
    });

    it('handles floating point precision for many small amounts', () => {
      const { result } = renderHook(() => useCostTracking());

      // Add 10 messages each costing $0.001
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.addMessageCost({
            messageId: `msg-${i}`,
            model: 'claude-haiku-3',
            inputTokens: 100,
            outputTokens: 50,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            costUsd: 0.001,
            durationMs: 500,
          });
        });
      }

      expect(result.current.sessionTotalCost).toBeCloseTo(0.01, 4);
    });
  });
});
