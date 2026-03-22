import { useState, useEffect, useCallback } from 'react';
import type { MemoryFile, MemorySearchResult } from '@claude-tauri/shared';
import { consumeMemoryUpdateDraft } from '@/lib/memoryUpdatePrompt';

const API_BASE = 'http://localhost:3131';

export function useMemoryApi() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [memoryDir, setMemoryDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchMemoryFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/memory`);
      if (!res.ok) throw new Error('Failed to fetch memory files');
      const data = (await res.json()) as { files: MemoryFile[]; memoryDir: string };
      setFiles(data.files);
      setMemoryDir(data.memoryDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMemoryFiles(); }, [fetchMemoryFiles]);

  const handleSave = async (filename: string, content: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/memory/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Save failed');
      }
      await fetchMemoryFiles();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (name: string, content: string) => {
    const filename = name.endsWith('.md') ? name : `${name}.md`;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: filename, content }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Create failed');
      }
      await fetchMemoryFiles();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (filename: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/memory/${filename}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Delete failed');
      }
      await fetchMemoryFiles();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      return false;
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/memory/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as { results: MemorySearchResult[] };
      setSearchResults(data.results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const consumeDraft = useCallback(() => {
    if (loading) return null;
    return consumeMemoryUpdateDraft();
  }, [loading]);

  return {
    files, memoryDir, loading, saving, error, setError,
    searchResults, isSearching,
    fetchMemoryFiles, handleSave, handleCreate, handleDelete, handleSearch,
    consumeDraft,
  };
}
