import { useState, useCallback, useEffect } from 'react';
import type { Document } from '@claude-tauri/shared';
import { fetchDocuments, uploadDocument, deleteDocument, bulkDeleteDocuments, updateDocumentTags } from '@/lib/api/documents-api';

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const upload = useCallback(async (files: File[]) => {
    const uploaded: Document[] = [];
    for (const file of files) {
      try {
        const doc = await uploadDocument(file);
        uploaded.push(doc);
      } catch (err) {
        console.error('Failed to upload:', file.name, err);
      }
    }
    if (uploaded.length > 0) {
      setDocuments(prev => [...uploaded, ...prev]);
    }
    return uploaded;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteDocument(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
  }, []);

  const removeMany = useCallback(async (ids: string[]) => {
    await bulkDeleteDocuments(ids);
    const idSet = new Set(ids);
    setDocuments(prev => prev.filter(d => !idSet.has(d.id)));
  }, []);

  const updateTags = useCallback(async (id: string, tags: string[]) => {
    const updated = await updateDocumentTags(id, tags);
    setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    return updated;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { documents, isLoading, refresh, upload, remove, removeMany, updateTags };
}
