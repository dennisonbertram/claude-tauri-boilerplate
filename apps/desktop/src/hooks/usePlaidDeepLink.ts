import { useEffect, useRef, useCallback } from 'react';
import { isTauri } from '@/lib/platform';
import { finalizeLinkSession } from '@/lib/api/plaid-api';

/**
 * Handles Plaid deep link callbacks (claudetauri://plaid-callback?state=...&public_token=...).
 *
 * - On mount (cold start): checks for any pending deep link via Tauri invoke
 * - While running (warm start): listens for 'plaid-callback' events from the Rust backend
 * - Calls /api/plaid/link/finalize when a valid callback is received
 */
export function usePlaidDeepLink(onFinalized?: () => void) {
  const handledStates = useRef(new Set<string>());

  const handleCallback = useCallback(async (urlString: string) => {
    try {
      const url = new URL(urlString);
      const state = url.searchParams.get('state');
      const publicToken = url.searchParams.get('public_token');

      if (!state) {
        console.warn('Plaid callback missing state parameter');
        return;
      }

      // Deduplicate — don't process the same state twice
      if (handledStates.current.has(state)) return;
      handledStates.current.add(state);

      if (publicToken) {
        await finalizeLinkSession(state, publicToken);
        onFinalized?.();
      } else {
        console.warn('Plaid callback missing public_token — may need manual finalization');
      }
    } catch (err) {
      console.error('Failed to handle Plaid callback:', err);
    }
  }, [onFinalized]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlistenFn: (() => void) | null = null;

    async function setup() {
      try {
        // Check for pending deep link that arrived before React mounted (cold start)
        const { invoke } = await import('@tauri-apps/api/core');
        const pending = await invoke<string | null>('get_pending_deep_link').catch(() => null);
        if (pending) {
          handleCallback(pending);
        }

        // Listen for deep links while app is running (warm start)
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen<string>('plaid-callback', (event) => {
          handleCallback(event.payload);
        });
        unlistenFn = unlisten;
      } catch (err) {
        // Deep link plugin may not be installed yet — that's OK during dev
        console.debug('Plaid deep link setup skipped:', err);
      }
    }

    setup();

    return () => {
      unlistenFn?.();
    };
  }, [handleCallback]);
}
