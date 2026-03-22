import type { WorkspaceDeployment } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

export async function getWorkspaceDeployment(workspaceId: string): Promise<{ deployment: WorkspaceDeployment | null; isConfigured: boolean }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to get workspace deployment: ${res.status}`); }
  return res.json();
}

export async function linkWorkspaceDeployment(workspaceId: string, railwayProjectId: string, railwayServiceId: string, railwayEnvironmentId: string): Promise<WorkspaceDeployment> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ railwayProjectId, railwayServiceId, railwayEnvironmentId }) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to link workspace deployment: ${res.status}`); }
  const data = await res.json();
  return data.deployment;
}

export async function refreshWorkspaceDeploymentStatus(workspaceId: string): Promise<{ deployment: WorkspaceDeployment }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment/refresh`, { method: 'POST' });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to refresh deployment status: ${res.status}`); }
  return res.json();
}

export async function getWorkspaceDeploymentLogs(workspaceId: string, limit?: number): Promise<{ logs: Array<{ timestamp: string; level: string; message: string }>; deploymentId: string | null; total: number }> {
  const params = limit ? `?limit=${limit}` : '';
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment/logs${params}`);
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to fetch deployment logs: ${res.status}`); }
  return res.json();
}

export async function unlinkWorkspaceDeployment(workspaceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/deployment`, { method: 'DELETE' });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to unlink workspace deployment: ${res.status}`); }
}

export async function setDeploymentToken(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/deployment-settings/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || `Failed to set deployment token: ${res.status}`); }
}
