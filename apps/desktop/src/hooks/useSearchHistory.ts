import { useState, useCallback, useEffect } from 'react';

const MAX_HISTORY = 10;

function getStorageKey(namespace: string): string {
  return `issue-search-history:${namespace}`;
}

function loadHistory(namespace: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(namespace));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function saveHistory(namespace: string, items: string[]): void {
  try {
    localStorage.setItem(getStorageKey(namespace), JSON.stringify(items));
  } catch {
    // localStorage may be full or unavailable
  }
}

/**
 * Hook to manage recent issue search history in localStorage.
 * @param namespace - Key prefix to separate GitHub vs Linear history
 */
export function useSearchHistory(namespace: string) {
  const [history, setHistory] = useState<string[]>(() => loadHistory(namespace));

  // Sync if namespace changes
  useEffect(() => {
    setHistory(loadHistory(namespace));
  }, [namespace]);

  const addSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      // Deduplicate case-insensitive
      const filtered = prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(namespace, next);
      return next;
    });
  }, [namespace]);

  const removeSearch = useCallback((query: string) => {
    setHistory((prev) => {
      const next = prev.filter((s) => s.toLowerCase() !== query.toLowerCase());
      saveHistory(namespace, next);
      return next;
    });
  }, [namespace]);

  const clearAll = useCallback(() => {
    setHistory([]);
    saveHistory(namespace, []);
  }, [namespace]);

  return { history, addSearch, removeSearch, clearAll };
}
