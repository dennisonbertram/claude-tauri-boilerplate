import { useState, useEffect, useCallback } from 'react';
import type {
  TeamConfig,
  AgentDefinition,
  TeammateStatus,
  TeamMessage,
  TeamTask,
} from '@claude-tauri/shared';
import { apiFetch } from '../lib/api-config';

export interface TeamDetail extends TeamConfig {
  agentStatuses: TeammateStatus[];
}

export function useTeams() {
  const [teams, setTeams] = useState<TeamConfig[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<TeamDetail | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all teams
  const fetchTeams = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/teams`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch {
      // Silently ignore fetch errors
    }
  }, []);

  // Fetch team detail
  const fetchTeamDetail = useCallback(async (teamId: string) => {
    try {
      const [teamRes, msgRes, taskRes] = await Promise.all([
        apiFetch(`/api/teams/${teamId}`),
        apiFetch(`/api/teams/${teamId}/messages`),
        apiFetch(`/api/teams/${teamId}/tasks`),
      ]);

      if (teamRes.ok) {
        setActiveTeam(await teamRes.json());
      }
      if (msgRes.ok) {
        setMessages(await msgRes.json());
      }
      if (taskRes.ok) {
        setTasks(await taskRes.json());
      }
    } catch {
      // Silently ignore
    }
  }, []);

  // Create a team
  const createTeam = useCallback(
    async (name: string, agents: AgentDefinition[], displayMode: TeamConfig['displayMode'] = 'auto') => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/teams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, agents, displayMode }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? 'Failed to create team');
          return null;
        }
        await fetchTeams();
        setActiveTeamId(body.id);
        return body as TeamConfig;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fetchTeams]
  );

  // Delete a team
  const deleteTeam = useCallback(
    async (teamId: string) => {
      try {
        await apiFetch(`/api/teams/${teamId}`, { method: 'DELETE' });
        if (activeTeamId === teamId) {
          setActiveTeamId(null);
          setActiveTeam(null);
          setMessages([]);
          setTasks([]);
        }
        await fetchTeams();
      } catch {
        // Silently ignore
      }
    },
    [activeTeamId, fetchTeams]
  );

  // Shutdown team
  const shutdownTeam = useCallback(
    async (teamId: string) => {
      try {
        await apiFetch(`/api/teams/${teamId}/shutdown`, { method: 'POST' });
        await fetchTeamDetail(teamId);
      } catch {
        // Silently ignore
      }
    },
    [fetchTeamDetail]
  );

  // Load teams on mount
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Fetch details when active team changes
  useEffect(() => {
    if (activeTeamId) {
      fetchTeamDetail(activeTeamId);
    }
  }, [activeTeamId, fetchTeamDetail]);

  return {
    teams,
    activeTeamId,
    setActiveTeamId,
    activeTeam,
    messages,
    tasks,
    loading,
    error,
    createTeam,
    deleteTeam,
    shutdownTeam,
    refreshTeam: fetchTeamDetail,
  };
}
