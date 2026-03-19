import { useState, useEffect, useCallback } from 'react';
import type {
  AgentProfile,
  CreateAgentProfileRequest,
  UpdateAgentProfileRequest,
} from '@claude-tauri/shared';
import * as api from '@/lib/agent-profile-api';

interface UseAgentProfilesReturn {
  profiles: AgentProfile[];
  loading: boolean;
  error: string | null;
  addProfile: (data: CreateAgentProfileRequest) => Promise<AgentProfile>;
  updateProfile: (id: string, data: UpdateAgentProfileRequest) => Promise<AgentProfile>;
  removeProfile: (id: string) => Promise<void>;
  duplicateProfile: (id: string) => Promise<AgentProfile>;
  refresh: () => Promise<void>;
}

export function useAgentProfiles(): UseAgentProfilesReturn {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.fetchAgentProfiles();
      setProfiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addProfile = useCallback(async (data: CreateAgentProfileRequest): Promise<AgentProfile> => {
    const profile = await api.createAgentProfile(data);
    setProfiles((prev) => [...prev, profile]);
    return profile;
  }, []);

  const updateProfile = useCallback(
    async (id: string, data: UpdateAgentProfileRequest): Promise<AgentProfile> => {
      const updated = await api.updateAgentProfile(id, data);
      setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    },
    []
  );

  const removeProfile = useCallback(async (id: string): Promise<void> => {
    await api.deleteAgentProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const duplicateProfile = useCallback(async (id: string): Promise<AgentProfile> => {
    const dup = await api.duplicateAgentProfile(id);
    setProfiles((prev) => [...prev, dup]);
    return dup;
  }, []);

  return {
    profiles,
    loading,
    error,
    addProfile,
    updateProfile,
    removeProfile,
    duplicateProfile,
    refresh,
  };
}
