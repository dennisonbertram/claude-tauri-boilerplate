import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  getWorkspace,
  getWorkspaceProvider,
  createProvisioningRun,
  listProvisioningRuns,
  getProvisioningRun,
} from '../db';

export function createWorkspaceProvisioningRouter(db: Database) {
  const router = new Hono();

  // GET /api/workspaces/:id/provisioning-runs — List runs for a workspace
  router.get('/:id/provisioning-runs', (c) => {
    const workspaceId = c.req.param('id');
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const runs = listProvisioningRuns(db, workspaceId);
    return c.json(runs);
  });

  // POST /api/workspaces/:id/provisioning-runs — Create a provisioning run (status=pending)
  router.post('/:id/provisioning-runs', async (c) => {
    const workspaceId = c.req.param('id');
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const { providerId, requestJson } = body as Record<string, unknown>;

    if (!providerId || typeof providerId !== 'string') {
      return c.json({ error: 'providerId is required', code: 'VALIDATION_ERROR' }, 400);
    }

    const provider = getWorkspaceProvider(db, providerId);
    if (!provider) {
      return c.json({ error: 'Provider not found', code: 'NOT_FOUND' }, 404);
    }

    const safeRequestJson =
      requestJson !== null && typeof requestJson === 'object' && !Array.isArray(requestJson)
        ? (requestJson as Record<string, unknown>)
        : {};

    const run = createProvisioningRun(db, workspaceId, providerId, safeRequestJson);
    return c.json(run, 201);
  });

  // GET /api/workspaces/:id/provisioning-runs/:runId — Get a single run
  router.get('/:id/provisioning-runs/:runId', (c) => {
    const workspaceId = c.req.param('id');
    const runId = c.req.param('runId');

    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    const run = getProvisioningRun(db, runId);
    if (!run || run.workspaceId !== workspaceId) {
      return c.json({ error: 'Provisioning run not found', code: 'NOT_FOUND' }, 404);
    }

    return c.json(run);
  });

  return router;
}
