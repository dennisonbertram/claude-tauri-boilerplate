import type {
  AgentProfile,
  CreateAgentProfileRequest,
  GenerateAgentProfileRequest,
  UpdateAgentProfileRequest,
} from '@claude-tauri/shared';
import { apiFetch } from './api-config';

export async function fetchAgentProfiles(): Promise<AgentProfile[]> {
  const res = await apiFetch(`/api/agent-profiles`);
  if (!res.ok) throw new Error(`Failed to fetch agent profiles: ${res.status}`);
  return res.json();
}

export async function createAgentProfile(data: CreateAgentProfileRequest): Promise<AgentProfile> {
  const res = await apiFetch(`/api/agent-profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to create agent profile: ${res.status}`);
  }
  return res.json();
}

export async function getAgentProfile(id: string): Promise<AgentProfile> {
  const res = await apiFetch(`/api/agent-profiles/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch agent profile: ${res.status}`);
  return res.json();
}

export async function updateAgentProfile(id: string, data: UpdateAgentProfileRequest): Promise<AgentProfile> {
  const res = await apiFetch(`/api/agent-profiles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to update agent profile: ${res.status}`);
  }
  return res.json();
}

export async function deleteAgentProfile(id: string): Promise<void> {
  const res = await apiFetch(`/api/agent-profiles/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete agent profile: ${res.status}`);
}

export async function duplicateAgentProfile(id: string): Promise<AgentProfile> {
  const res = await apiFetch(`/api/agent-profiles/${id}/duplicate`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to duplicate agent profile: ${res.status}`);
  }
  return res.json();
}

export async function generateAgentProfile(
  data: GenerateAgentProfileRequest
): Promise<AgentProfile> {
  const res = await apiFetch(`/api/agent-profiles/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to generate agent profile: ${res.status}`);
  }
  return res.json();
}
