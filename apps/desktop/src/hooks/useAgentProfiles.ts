import { useState, useEffect, useCallback } from 'react';
import type {
  AgentProfile,
  CreateAgentProfileRequest,
  GenerateAgentProfileRequest,
  UpdateAgentProfileRequest,
} from '@claude-tauri/shared';
import * as api from '@/lib/agent-profile-api';

export function useAgentProfiles() {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await api.fetchAgentProfiles();
      setProfiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 30 seconds
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const addProfile = useCallback(async (data: CreateAgentProfileRequest) => {
    const profile = await api.createAgentProfile(data);
    setProfiles(prev => [profile, ...prev]);
    return profile;
  }, []);

  const updateProfile = useCallback(async (id: string, data: UpdateAgentProfileRequest) => {
    const updated = await api.updateAgentProfile(id, data);
    setProfiles(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }, []);

  const removeProfile = useCallback(async (id: string) => {
    await api.deleteAgentProfile(id);
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  const duplicateProfile = useCallback(async (id: string) => {
    const duplicated = await api.duplicateAgentProfile(id);
    setProfiles(prev => [...prev, duplicated]);
    return duplicated;
  }, []);

  const generateProfile = useCallback(async (data: GenerateAgentProfileRequest) => {
    const generated = await api.generateAgentProfile(data);
    setProfiles(prev => [generated, ...prev]);
    return generated;
  }, []);

  return {
    profiles,
    loading,
    error,
    addProfile,
    updateProfile,
    removeProfile,
    duplicateProfile,
    generateProfile,
    refresh,
  };
}
