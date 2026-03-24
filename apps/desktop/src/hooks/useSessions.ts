import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { Session, Message } from '@claude-tauri/shared';
import { useSettings } from './useSettings';
import { apiFetch } from '../lib/api-config';

export function useSessions(initialSearchQuery: string = '') {
  const { settings } = useSettings();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const fetchSessions = useCallback(async (searchQuery = '') => {
    const trimmedQuery = searchQuery.trim();
    const query = trimmedQuery
      ? `?q=${encodeURIComponent(trimmedQuery)}`
      : '';
    const url = `/api/sessions${query}`;

    try {
      const res = await apiFetch(url);
      const data = await res.json();
      setSessions(data);
    } catch {
      // Server not reachable — leave sessions empty
    }
  }, []);

  const createSession = useCallback(async (title?: string) => {
    const res = await apiFetch(`/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, model: settings.model }),
    });
    const session = await res.json();
    setSessions(prev => [{ ...session, messageCount: 0 }, ...prev]);
    setActiveSessionId(session.id);
    return session as Session;
  }, [settings.model]);

  const deleteSession = useCallback(async (id: string) => {
    const session = sessions.find(s => s.id === id);
    const sessionTitle = session?.title || 'Untitled session';
    await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
    toast.success('Session deleted', { description: sessionTitle });
  }, [activeSessionId, sessions]);

  const renameSession = useCallback(async (id: string, title: string) => {
    const res = await apiFetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, title: updated.title, updatedAt: updated.updatedAt } : s))
    );
  }, []);

  const forkSession = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/sessions/${id}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const forked = await res.json();
    setSessions(prev => [forked, ...prev]);
    setActiveSessionId(forked.id);
  }, []);

  const exportSession = useCallback(async (id: string, format: 'json' | 'md') => {
    try {
      const res = await apiFetch(`/api/sessions/${id}/export?format=${format}`);
      if (!res.ok) {
        toast.error('Export failed', { description: `Server returned ${res.status}` });
        return;
      }

      // Get filename from Content-Disposition header or generate one
      const disposition = res.headers.get('content-disposition');
      let filename = `session-export.${format === 'md' ? 'md' : 'json'}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Create blob and trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Session exported', { description: filename });
    } catch {
      toast.error('Export failed', { description: 'Could not reach the server' });
    }
  }, []);

  const fetchMessages = useCallback(async (sessionId: string): Promise<Message[]> => {
    const res = await apiFetch(`/api/sessions/${sessionId}/messages`);
    return res.json();
  }, []);

  const autoNameSession = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${id}/auto-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.prReviewModel, privacyMode: settings.privacyMode }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.title) {
        setSessions(prev =>
          prev.map(s => (s.id === id ? { ...s, title: data.title } : s))
        );
      }
    } catch (err) {
      console.error('[autoNameSession] Failed to auto-name session:', id, err);
    }
  }, [settings.prReviewModel, settings.privacyMode]);

  useEffect(() => {
    void fetchSessions(initialSearchQuery);
  }, [fetchSessions, initialSearchQuery]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    renameSession,
    forkSession,
    exportSession,
    fetchMessages,
    fetchSessions,
    autoNameSession,
  };
}
