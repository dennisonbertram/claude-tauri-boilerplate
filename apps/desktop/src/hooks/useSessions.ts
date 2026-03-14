import { useState, useEffect, useCallback } from 'react';
import type { Session, Message } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch {
      // Server not reachable — leave sessions empty
    }
  }, []);

  const createSession = useCallback(async (title?: string) => {
    const res = await fetch(`${API_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const session = await res.json();
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(session.id);
    return session as Session;
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/api/sessions/${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  }, [activeSessionId]);

  const fetchMessages = useCallback(async (sessionId: string): Promise<Message[]> => {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
    return res.json();
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    fetchMessages,
    fetchSessions,
  };
}
