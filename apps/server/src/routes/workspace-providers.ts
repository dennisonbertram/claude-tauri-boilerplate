import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  createWorkspaceProvider,
  listWorkspaceProviders,
  getWorkspaceProvider,
  updateWorkspaceProvider,
  deleteWorkspaceProvider,
} from '../db';

export function createWorkspaceProvidersRouter(db: Database) {
  const router = new Hono();

  // GET /api/workspace-providers — List providers (optional ?projectId= filter)
  router.get('/', (c) => {
    const projectId = c.req.query('projectId');
    const providers = listWorkspaceProviders(db, projectId);
    return c.json(providers);
  });

  // POST /api/workspace-providers — Create a provider
  router.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { name, command, projectId, args, workingDir, timeoutMs, enabled } = body as Record<string, unknown>;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'name is required', code: 'VALIDATION_ERROR' }, 400);
    }
    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      return c.json({ error: 'command is required', code: 'VALIDATION_ERROR' }, 400);
    }

    const provider = createWorkspaceProvider(db, {
      id: crypto.randomUUID(),
      projectId: typeof projectId === 'string' ? projectId : null,
      name: name.trim(),
      command: command.trim(),
      args: Array.isArray(args) ? (args as string[]) : [],
      workingDir: typeof workingDir === 'string' ? workingDir : null,
      timeoutMs: typeof timeoutMs === 'number' ? timeoutMs : 1800000,
      enabled: enabled !== false,
    });

    return c.json(provider, 201);
  });

  // GET /api/workspace-providers/:id — Get a single provider
  router.get('/:id', (c) => {
    const id = c.req.param('id');
    const provider = getWorkspaceProvider(db, id);
    if (!provider) {
      return c.json({ error: 'Provider not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json(provider);
  });

  // PATCH /api/workspace-providers/:id — Update a provider (partial)
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const provider = getWorkspaceProvider(db, id);
    if (!provider) {
      return c.json({ error: 'Provider not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const { name, command, args, workingDir, timeoutMs, enabled } = body as Record<string, unknown>;

    const patch: Parameters<typeof updateWorkspaceProvider>[2] = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return c.json({ error: 'name must be a non-empty string', code: 'VALIDATION_ERROR' }, 400);
      }
      patch.name = name.trim();
    }
    if (command !== undefined) {
      if (typeof command !== 'string' || command.trim().length === 0) {
        return c.json({ error: 'command must be a non-empty string', code: 'VALIDATION_ERROR' }, 400);
      }
      patch.command = command.trim();
    }
    if (args !== undefined) {
      if (!Array.isArray(args)) {
        return c.json({ error: 'args must be an array', code: 'VALIDATION_ERROR' }, 400);
      }
      patch.args = args as string[];
    }
    if (workingDir !== undefined) {
      patch.workingDir = typeof workingDir === 'string' ? workingDir : null;
    }
    if (timeoutMs !== undefined) {
      if (typeof timeoutMs !== 'number') {
        return c.json({ error: 'timeoutMs must be a number', code: 'VALIDATION_ERROR' }, 400);
      }
      patch.timeoutMs = timeoutMs;
    }
    if (enabled !== undefined) {
      patch.enabled = Boolean(enabled);
    }

    updateWorkspaceProvider(db, id, patch);
    const updated = getWorkspaceProvider(db, id);
    return c.json(updated);
  });

  // DELETE /api/workspace-providers/:id — Delete a provider
  router.delete('/:id', (c) => {
    const id = c.req.param('id');
    const provider = getWorkspaceProvider(db, id);
    if (!provider) {
      return c.json({ error: 'Provider not found', code: 'NOT_FOUND' }, 404);
    }

    deleteWorkspaceProvider(db, id);
    return new Response(null, { status: 204 });
  });

  return router;
}
