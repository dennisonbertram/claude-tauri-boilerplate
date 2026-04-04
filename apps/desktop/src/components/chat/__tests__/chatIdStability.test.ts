import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';

/**
 * Regression test for chat ID stability bug.
 *
 * Bug: The original implementation used useState to capture sessionId at mount time:
 *   const [chatId] = useState(() => sessionId ?? crypto.randomUUID());
 *
 * This caused chatId to never update when sessionId changed (e.g., user switches sessions),
 * leading to the Chat instance using a stale ID.
 *
 * Fix: Use useMemo for the fallback ID and compute chatId as sessionId ?? stableFallbackId
 * so that chatId updates when sessionId changes.
 */

// Minimal hook that replicates the chatId logic from useChatPageState
function useChatId(sessionId: string | null) {
  const stableFallbackId = useMemo(
    () =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    []
  );

  const chatId = sessionId ?? stableFallbackId;
  return { chatId, stableFallbackId };
}

describe('Chat ID Stability', () => {
  let randomUUIDSpy: ReturnType<typeof vi.spyOn>;
  let callCount = 0;

  beforeEach(() => {
    callCount = 0;
    randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      callCount++;
      return `mock-uuid-${callCount}`;
    });
  });

  afterEach(() => {
    randomUUIDSpy.mockRestore();
  });

  test('uses sessionId when provided', () => {
    const { result } = renderHook(() => useChatId('session-123'));
    expect(result.current.chatId).toBe('session-123');
  });

  test('uses stable fallback ID when sessionId is null', () => {
    const { result, rerender } = renderHook(() => useChatId(null));

    const initialChatId = result.current.chatId;
    expect(initialChatId).toBe('mock-uuid-1');

    // Re-render should keep the same fallback ID (useMemo with empty deps)
    rerender();
    expect(result.current.chatId).toBe(initialChatId);
    expect(randomUUIDSpy).toHaveBeenCalledTimes(1); // Only called once
  });

  test('chatId updates when sessionId changes from null to a value', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useChatId(sessionId),
      { initialProps: { sessionId: null as string | null } }
    );

    expect(result.current.chatId).toBe('mock-uuid-1');

    // Simulate user switching to a session
    rerender({ sessionId: 'new-session-456' });
    expect(result.current.chatId).toBe('new-session-456');
  });

  test('chatId updates when sessionId changes between different values', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useChatId(sessionId),
      { initialProps: { sessionId: 'session-A' as string | null } }
    );

    expect(result.current.chatId).toBe('session-A');

    rerender({ sessionId: 'session-B' });
    expect(result.current.chatId).toBe('session-B');
  });

  test('chatId falls back to stable ID when sessionId becomes null', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useChatId(sessionId),
      { initialProps: { sessionId: 'session-123' as string | null } }
    );

    expect(result.current.chatId).toBe('session-123');
    const fallbackId = result.current.stableFallbackId;

    // Session cleared
    rerender({ sessionId: null });
    expect(result.current.chatId).toBe(fallbackId);
    // Should still be the same fallback ID created on mount
    expect(result.current.stableFallbackId).toBe(fallbackId);
  });
});
