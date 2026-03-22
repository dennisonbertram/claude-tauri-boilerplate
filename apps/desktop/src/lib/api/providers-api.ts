import type { WorkspaceProvider, WorkspaceProvisioningRun } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

export async function listWorkspaceProviders(projectId?: string): Promise<WorkspaceProvider[]> {
  const params = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`${API_BASE}/api/workspace-providers${params}`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error((body as any).error || `Failed to list workspace providers: ${res.status}`); }
  return res.json();
}

export async function createWorkspaceProvider(data: { name: string; command: string; projectId?: string | null; args?: string[]; workingDir?: string | null; timeoutMs?: number; enabled?: boolean; }): Promise<WorkspaceProvider> {
  const res = await fetch(`${API_BASE}/api/workspace-providers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error((body as any).error || `Failed to create workspace provider: ${res.status}`); }
  return res.json();
}

export async function updateWorkspaceProvider(id: string, patch: { name?: string; command?: string; args?: string[]; workingDir?: string | null; timeoutMs?: number; enabled?: boolean; }): Promise<WorkspaceProvider> {
  const res = await fetch(`${API_BASE}/api/workspace-providers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error((body as any).error || `Failed to update workspace provider: ${res.status}`); }
  return res.json();
}

export async function deleteWorkspaceProvider(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workspace-providers/${id}`, { method: 'DELETE' });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error((body as any).error || `Failed to delete workspace provider: ${res.status}`); }
}

export async function listProvisioningRuns(workspaceId: string): Promise<WorkspaceProvisioningRun[]> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/provisioning-runs`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error((body as any).error || `Failed to list provisioning runs: ${res.status}`); }
  return res.json();
}

export async function createProvisioningRun(workspaceId: string, providerId: string, requestJson: Record<string, unknown> = {}): Promise<WorkspaceProvisioningRun> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/provisioning-runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId, requestJson }) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error((body as any).error || `Failed to create provisioning run: ${res.status}`); }
  return res.json();
}

export async function getProvisioningRun(workspaceId: string, runId: string): Promise<WorkspaceProvisioningRun> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/provisioning-runs/${runId}`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error((body as any).error || `Failed to get provisioning run: ${res.status}`); }
  return res.json();
}
