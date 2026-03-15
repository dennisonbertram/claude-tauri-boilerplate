import { Hono } from 'hono';
import type {
  TeamConfig,
  AgentDefinition,
  TeammateStatus,
  TeamMessage,
  TeamTask,
} from '@claude-tauri/shared';

// --- In-memory stores ---

const teams = new Map<string, TeamConfig>();
const teamAgentStatuses = new Map<string, Map<string, TeammateStatus>>();
const teamMessages = new Map<string, TeamMessage[]>();
const teamTasks = new Map<string, TeamTask[]>();

/** Exported for testing: clear all in-memory state */
export function resetTeamsStore() {
  teams.clear();
  teamAgentStatuses.clear();
  teamMessages.clear();
  teamTasks.clear();
}

export function createTeamsRouter() {
  const router = new Hono();

  // GET / - List all teams
  router.get('/', (c) => {
    const list = Array.from(teams.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json(list);
  });

  // POST / - Create a new team
  router.post('/', async (c) => {
    const body = await c.req.json<{
      name?: string;
      agents?: AgentDefinition[];
      displayMode?: TeamConfig['displayMode'];
    }>();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return c.json({ error: 'Team name is required' }, 400);
    }

    if (!body.agents || !Array.isArray(body.agents) || body.agents.length === 0) {
      return c.json({ error: 'At least one agent is required' }, 400);
    }

    // Validate each agent
    const agentNames = new Set<string>();
    for (const agent of body.agents) {
      if (!agent.name || typeof agent.name !== 'string' || agent.name.trim() === '') {
        return c.json({ error: 'Each agent must have a name' }, 400);
      }
      if (!agent.description || typeof agent.description !== 'string') {
        return c.json({ error: `Agent "${agent.name}" must have a description` }, 400);
      }
      if (agentNames.has(agent.name)) {
        return c.json({ error: `Duplicate agent name: "${agent.name}"` }, 400);
      }
      agentNames.add(agent.name);
    }

    const id = crypto.randomUUID();
    const team: TeamConfig = {
      id,
      name: body.name.trim(),
      agents: body.agents,
      displayMode: body.displayMode ?? 'auto',
      createdAt: new Date().toISOString(),
    };

    teams.set(id, team);

    // Initialize agent statuses
    const statuses = new Map<string, TeammateStatus>();
    for (const agent of body.agents) {
      statuses.set(agent.name, {
        name: agent.name,
        status: 'idle',
        model: agent.model,
        tools: agent.tools,
      });
    }
    teamAgentStatuses.set(id, statuses);
    teamMessages.set(id, []);
    teamTasks.set(id, []);

    return c.json(team, 201);
  });

  // GET /:id - Get team details including agent statuses
  router.get('/:id', (c) => {
    const { id } = c.req.param();
    const team = teams.get(id);
    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const statuses = teamAgentStatuses.get(id);
    const agentStatuses = statuses ? Array.from(statuses.values()) : [];

    return c.json({ ...team, agentStatuses });
  });

  // DELETE /:id - Delete a team
  router.delete('/:id', (c) => {
    const { id } = c.req.param();
    if (!teams.has(id)) {
      return c.json({ error: 'Team not found' }, 404);
    }

    teams.delete(id);
    teamAgentStatuses.delete(id);
    teamMessages.delete(id);
    teamTasks.delete(id);

    return c.json({ success: true });
  });

  // POST /:id/agents - Add an agent to a team
  router.post('/:id/agents', async (c) => {
    const { id } = c.req.param();
    const team = teams.get(id);
    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const body = await c.req.json<AgentDefinition>();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return c.json({ error: 'Agent name is required' }, 400);
    }
    if (!body.description || typeof body.description !== 'string') {
      return c.json({ error: 'Agent description is required' }, 400);
    }

    // Check for duplicate names
    if (team.agents.some((a) => a.name === body.name)) {
      return c.json({ error: `Agent "${body.name}" already exists in this team` }, 400);
    }

    team.agents.push(body);
    teams.set(id, team);

    // Add status entry
    const statuses = teamAgentStatuses.get(id)!;
    statuses.set(body.name, {
      name: body.name,
      status: 'idle',
      model: body.model,
      tools: body.tools,
    });

    return c.json(team, 201);
  });

  // DELETE /:id/agents/:name - Remove an agent from a team
  router.delete('/:id/agents/:name', (c) => {
    const { id, name } = c.req.param();
    const team = teams.get(id);
    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const agentIndex = team.agents.findIndex((a) => a.name === name);
    if (agentIndex === -1) {
      return c.json({ error: `Agent "${name}" not found in this team` }, 404);
    }

    team.agents.splice(agentIndex, 1);
    teams.set(id, team);

    const statuses = teamAgentStatuses.get(id)!;
    statuses.delete(name);

    return c.json(team);
  });

  // GET /:id/messages - Get team message history
  router.get('/:id/messages', (c) => {
    const { id } = c.req.param();
    if (!teams.has(id)) {
      return c.json({ error: 'Team not found' }, 404);
    }

    return c.json(teamMessages.get(id) ?? []);
  });

  // POST /:id/messages - Add a message (for testing/simulation)
  router.post('/:id/messages', async (c) => {
    const { id } = c.req.param();
    if (!teams.has(id)) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const body = await c.req.json<{
      from: string;
      to: string;
      content: string;
      type?: TeamMessage['type'];
    }>();

    if (!body.from || !body.to || !body.content) {
      return c.json({ error: 'from, to, and content are required' }, 400);
    }

    const message: TeamMessage = {
      id: crypto.randomUUID(),
      from: body.from,
      to: body.to,
      content: body.content,
      timestamp: new Date().toISOString(),
      type: body.type ?? 'message',
    };

    const messages = teamMessages.get(id)!;
    messages.push(message);

    return c.json(message, 201);
  });

  // GET /:id/tasks - Get team task list
  router.get('/:id/tasks', (c) => {
    const { id } = c.req.param();
    if (!teams.has(id)) {
      return c.json({ error: 'Team not found' }, 404);
    }

    return c.json(teamTasks.get(id) ?? []);
  });

  // POST /:id/tasks - Add a task
  router.post('/:id/tasks', async (c) => {
    const { id } = c.req.param();
    if (!teams.has(id)) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const body = await c.req.json<{
      subject: string;
      assignee?: string;
      status?: TeamTask['status'];
    }>();

    if (!body.subject || typeof body.subject !== 'string') {
      return c.json({ error: 'Task subject is required' }, 400);
    }

    const task: TeamTask = {
      id: crypto.randomUUID(),
      subject: body.subject,
      status: body.status ?? 'pending',
      assignee: body.assignee,
    };

    const tasks = teamTasks.get(id)!;
    tasks.push(task);

    return c.json(task, 201);
  });

  // POST /:id/shutdown - Shutdown all agents in a team
  router.post('/:id/shutdown', (c) => {
    const { id } = c.req.param();
    const team = teams.get(id);
    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const statuses = teamAgentStatuses.get(id)!;
    for (const [name, status] of statuses) {
      statuses.set(name, { ...status, status: 'stopped' });
    }

    return c.json({ success: true });
  });

  return router;
}
