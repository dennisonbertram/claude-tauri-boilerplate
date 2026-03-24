import { getApiBase } from '@/lib/api-config';
import type { Document } from '@claude-tauri/shared';

const API_BASE = getApiBase();

export async function uploadDocument(file: File, sessionId?: string): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  if (sessionId) formData.append('sessionId', sessionId);
  const res = await fetch(`${API_BASE}/api/documents/upload`, { method: 'POST', body: formData });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Upload failed: ${res.status}`); }
  const data = await res.json();
  return data.document;
}

export async function fetchDocuments(params?: { status?: string; mimeType?: string; search?: string }): Promise<Document[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.mimeType) query.set('mimeType', params.mimeType);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  const res = await fetch(`${API_BASE}/api/documents${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  return res.json();
}

export async function fetchDocument(id: string): Promise<Document> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch document: ${res.status}`);
  return res.json();
}

export function getDocumentFileUrl(id: string): string {
  return `${API_BASE}/api/documents/${id}/file`;
}

export async function updateDocumentTags(id: string, tags: string[]): Promise<Document> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Update failed: ${res.status}`); }
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete document: ${res.status}`);
}

export async function bulkDeleteDocuments(ids: string[]): Promise<{ deletedCount: number }> {
  const res = await fetch(`${API_BASE}/api/documents/bulk`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Bulk delete failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchDocumentContent(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/documents/${id}/content`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch content: ${res.status}`);
  }
  return res.text();
}

export async function openDocumentOnComputer(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${id}/open`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to open document: ${res.status}`);
  }
}
