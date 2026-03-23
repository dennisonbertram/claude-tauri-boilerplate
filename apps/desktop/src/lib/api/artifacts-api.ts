import { getApiBase } from '@/lib/api-config';

const API_BASE = getApiBase();

export async function fetchSessionThread(sessionId: string): Promise<import('@claude-tauri/shared').ThreadMessage[]> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/thread`);
  if (!res.ok) throw new Error(`Failed to fetch thread: ${res.status}`);
  return res.json();
}

export async function generateArtifact(projectId: string, params: { prompt: string; title?: string; workspaceId?: string; sessionId?: string; model?: string; }): Promise<{ artifact: import('@claude-tauri/shared').Artifact; revision: import('@claude-tauri/shared').ArtifactRevision }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/artifacts/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to generate artifact: ${res.status}`); }
  return res.json();
}

export async function fetchProjectArtifacts(projectId: string): Promise<import('@claude-tauri/shared').Artifact[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/artifacts`);
  if (!res.ok) throw new Error(`Failed to fetch artifacts: ${res.status}`);
  return res.json();
}

export async function archiveArtifact(artifactId: string): Promise<import('@claude-tauri/shared').Artifact> {
  const res = await fetch(`${API_BASE}/api/artifacts/${artifactId}/archive`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`Failed to archive artifact: ${res.status}`);
  return res.json();
}

export async function renameArtifact(artifactId: string, title: string): Promise<import('@claude-tauri/shared').Artifact> {
  const res = await fetch(`${API_BASE}/api/artifacts/${artifactId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to rename artifact: ${res.status}`); }
  return res.json();
}

export async function regenerateArtifact(artifactId: string, params: { prompt: string; model?: string }): Promise<{ artifact: import('@claude-tauri/shared').Artifact; revision: import('@claude-tauri/shared').ArtifactRevision }> {
  const res = await fetch(`${API_BASE}/api/artifacts/${artifactId}/regenerate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to regenerate artifact: ${res.status}`); }
  return res.json();
}
