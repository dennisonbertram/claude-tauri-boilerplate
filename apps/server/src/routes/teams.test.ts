import { describe, test, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { createTeamsRouter, resetTeamsStore } from './teams';

describe('Teams Routes', () => {
  let app: Hono;

  beforeEach(() => {
    resetTeamsStore();
    const teamsRouter = createTeamsRouter();
    app = new Hono();
    app.route('/api/teams', teamsRouter);
  });

  // --- Helper ---
  async function createTeam(body: Record<string, unknown> = {}) {
    const defaults = {
      name: 'test-team',
      agents: [
        { name: 'researcher', description: 'Researches topics' },
        { name: 'coder', description: 'Writes code' },
      ],
    };
    return app.request('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...defaults, ...body }),
    });
  }

  // --- GET /api/teams ---

  describe('GET /api/teams', () => {
    test('returns empty array initially', async () => {
      const res = await app.request('/api/teams');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    test('returns teams after creating some', async () => {
      await createTeam({ name: 'team-1' });
      await createTeam({ name: 'team-2' });

      const res = await app.request('/api/teams');
      const body = await res.json();
      expect(body).toHaveLength(2);
    });
  });

  // --- POST /api/teams ---

  describe('POST /api/teams', () => {
    test('creates a team successfully', async () => {
      const res = await createTeam();
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.name).toBe('test-team');
      expect(body.id).toBeDefined();
      expect(body.agents).toHaveLength(2);
      expect(body.displayMode).toBe('auto');
      expect(body.createdAt).toBeDefined();
    });

    test('rejects empty name', async () => {
      const res = await createTeam({ name: '' });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('name');
    });

    test('rejects missing agents', async () => {
      const res = await createTeam({ agents: [] });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('agent');
    });

    test('rejects duplicate agent names', async () => {
      const res = await createTeam({
        agents: [
          { name: 'agent-a', description: 'First' },
          { name: 'agent-a', description: 'Second' },
        ],
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Duplicate');
    });

    test('rejects agent without description', async () => {
      const res = await createTeam({
        agents: [{ name: 'agent-a' }],
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('description');
    });

    test('accepts custom displayMode', async () => {
      const res = await createTeam({ displayMode: 'tmux' });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.displayMode).toBe('tmux');
    });
  });

  // --- GET /api/teams/:id ---

  describe('GET /api/teams/:id', () => {
    test('returns team with agent statuses', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe('test-team');
      expect(body.agentStatuses).toHaveLength(2);
      expect(body.agentStatuses[0].status).toBe('idle');
    });

    test('returns 404 for non-existent team', async () => {
      const res = await app.request('/api/teams/non-existent-id');
      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/teams/:id ---

  describe('DELETE /api/teams/:id', () => {
    test('deletes a team', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}`, { method: 'DELETE' });
      expect(res.status).toBe(200);

      const listRes = await app.request('/api/teams');
      const list = await listRes.json();
      expect(list).toHaveLength(0);
    });

    test('returns 404 for non-existent team', async () => {
      const res = await app.request('/api/teams/bad-id', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  // --- POST /api/teams/:id/agents ---

  describe('POST /api/teams/:id/agents', () => {
    test('adds agent to team', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'tester', description: 'Runs tests' }),
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.agents).toHaveLength(3);
    });

    test('rejects duplicate agent name', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'researcher', description: 'Dup' }),
      });
      expect(res.status).toBe(400);
    });

    test('returns 404 for non-existent team', async () => {
      const res = await app.request('/api/teams/bad-id/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x', description: 'y' }),
      });
      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/teams/:id/agents/:name ---

  describe('DELETE /api/teams/:id/agents/:name', () => {
    test('removes agent from team', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}/agents/researcher`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.agents).toHaveLength(1);
      expect(body.agents[0].name).toBe('coder');
    });

    test('returns 404 for non-existent agent', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}/agents/ghost`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });

  // --- Messages ---

  describe('Messages', () => {
    test('GET /api/teams/:id/messages returns empty initially', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}/messages`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    test('POST then GET returns messages', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const postRes = await app.request(`/api/teams/${team.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'researcher',
          to: 'coder',
          content: 'Found the issue',
          type: 'message',
        }),
      });
      expect(postRes.status).toBe(201);

      const msg = await postRes.json();
      expect(msg.from).toBe('researcher');
      expect(msg.type).toBe('message');

      const getRes = await app.request(`/api/teams/${team.id}/messages`);
      const messages = await getRes.json();
      expect(messages).toHaveLength(1);
    });

    test('returns 404 for non-existent team', async () => {
      const res = await app.request('/api/teams/bad-id/messages');
      expect(res.status).toBe(404);
    });
  });

  // --- Tasks ---

  describe('Tasks', () => {
    test('GET /api/teams/:id/tasks returns empty initially', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}/tasks`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    test('POST then GET returns tasks', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const postRes = await app.request(`/api/teams/${team.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Fix the auth bug',
          assignee: 'coder',
        }),
      });
      expect(postRes.status).toBe(201);

      const task = await postRes.json();
      expect(task.subject).toBe('Fix the auth bug');
      expect(task.status).toBe('pending');
      expect(task.assignee).toBe('coder');

      const getRes = await app.request(`/api/teams/${team.id}/tasks`);
      const tasks = await getRes.json();
      expect(tasks).toHaveLength(1);
    });
  });

  // --- Shutdown ---

  describe('POST /api/teams/:id/shutdown', () => {
    test('sets all agents to stopped', async () => {
      const createRes = await createTeam();
      const team = await createRes.json();

      const res = await app.request(`/api/teams/${team.id}/shutdown`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);

      const detailRes = await app.request(`/api/teams/${team.id}`);
      const detail = await detailRes.json();
      for (const agent of detail.agentStatuses) {
        expect(agent.status).toBe('stopped');
      }
    });

    test('returns 404 for non-existent team', async () => {
      const res = await app.request('/api/teams/bad-id/shutdown', {
        method: 'POST',
      });
      expect(res.status).toBe(404);
    });
  });
});
