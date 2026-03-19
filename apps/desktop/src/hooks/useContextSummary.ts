import { useState, useEffect, useRef } from 'react';
import type { UIMessage } from '@ai-sdk/react';

const API_BASE = 'http://localhost:3131';

const DEBOUNCE_MS = 2000;

export interface UseContextSummaryResult {
  summary: string | null;
  isLoading: boolean;
}

/**
 * Fetches a Haiku-generated one-line summary of the current session.
 *
 * - Only fetches when sessionId exists and messages.length >= 2
 * - Debounces 2000ms after messages change to avoid hammering during streaming
 * - Does not fetch while isStreaming is true
 */
export function useContextSummary(
  sessionId: string | null | undefined,
  messages: UIMessage[],
  isStreaming = false
): UseContextSummaryResult {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Track the message count we last fetched for so we can avoid redundant calls
  const lastFetchedCountRef = useRef<number>(0);
  const lastFetchedSessionRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messageCount = messages.length;

  useEffect(() => {
    // Reset summary when session changes
    if (sessionId !== lastFetchedSessionRef.current) {
      setSummary(null);
      lastFetchedCountRef.current = 0;
      lastFetchedSessionRef.current = sessionId ?? null;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    // Nothing to do if we don't have a session or enough messages
    if (!sessionId || messageCount < 2) return;

    // Don't schedule a new fetch during active streaming
    if (isStreaming) return;

    // Clear any pending timer before scheduling a new one
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;

      // Double-check streaming state at the time the timer fires
      // (isStreaming may have changed; we rely on the closure value here,
      // but since we only schedule when !isStreaming, this is fine for the
      // initial schedule. A new message arriving will re-trigger the effect.)
      if (!sessionId || messageCount < 2) return;

      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/summary`);
        if (!res.ok) return;
        const data = await res.json() as { summary: string | null };
        setSummary(data.summary ?? null);
        lastFetchedCountRef.current = messageCount;
      } catch {
        // Best-effort — network errors silently ignored
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sessionId, messageCount, isStreaming]);

  return { summary, isLoading };
}
