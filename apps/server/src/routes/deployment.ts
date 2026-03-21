import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  getWorkspace,
  getWorkspaceDeployment,
  upsertWorkspaceDeployment,
  updateWorkspaceDeploymentStatus,
  deleteWorkspaceDeployment,
  getRailwayToken,
  setRailwayToken,
} from '../db';
import { queryRailwayDeployments, fetchRailwayDeploymentLogs } from '../services/railway-api';

export function createDeploymentRouter(db: Database) {
  const app = new Hono();

  // GET /api/workspaces/:id/deployment — fetch link + cached status (or null)
  app.get('/:id/deployment', async (c) => {
    const workspaceId = c.req.param('id');
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const deployment = getWorkspaceDeployment(db, workspaceId);
    const token = getRailwayToken(db) ?? process.env.RAILWAY_API_TOKEN ?? null;
    return c.json({ deployment, isConfigured: token !== null });
  });

  // PUT /api/workspaces/:id/deployment — link workspace to Railway (upsert)
  app.put('/:id/deployment', async (c) => {
    const workspaceId = c.req.param('id');
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    let body: { railwayProjectId?: string; railwayServiceId?: string; railwayEnvironmentId?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400);
    }
    const { railwayProjectId, railwayServiceId, railwayEnvironmentId } = body;
    if (!railwayProjectId || !railwayServiceId || !railwayEnvironmentId) {
      return c.json({ error: 'railwayProjectId, railwayServiceId, and railwayEnvironmentId are required', code: 'BAD_REQUEST' }, 400);
    }
    const deployment = upsertWorkspaceDeployment(db, workspaceId, railwayProjectId, railwayServiceId, railwayEnvironmentId);
    return c.json({ deployment });
  });

  // DELETE /api/workspaces/:id/deployment — unlink
  app.delete('/:id/deployment', async (c) => {
    const workspaceId = c.req.param('id');
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    deleteWorkspaceDeployment(db, workspaceId);
    return new Response(null, { status: 204 });
  });

  // POST /api/workspaces/:id/deployment/refresh — fetch fresh status from Railway, cache it
  app.post('/:id/deployment/refresh', async (c) => {
    const workspaceId = c.req.param('id');
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const token = getRailwayToken(db) ?? process.env.RAILWAY_API_TOKEN ?? null;
    if (!token) {
      return c.json({ error: 'Railway API token not configured', code: 'TOKEN_NOT_CONFIGURED' }, 400);
    }
    const existing = getWorkspaceDeployment(db, workspaceId);
    if (!existing) {
      return c.json({ error: 'Workspace is not linked to a Railway deployment', code: 'NOT_LINKED' }, 400);
    }
    try {
      const result = await queryRailwayDeployments(token, existing.railwayProjectId, existing.railwayServiceId, existing.railwayEnvironmentId);
      const deployment = updateWorkspaceDeploymentStatus(db, workspaceId, result.lastDeploymentStatus, result.lastDeploymentId, result.lastDeploymentCreatedAt);
      return c.json({ deployment });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg, code: 'RAILWAY_API_ERROR' }, 502);
    }
  });

  // GET /api/workspaces/:id/deployment/logs — recent logs for lastDeploymentId
  app.get('/:id/deployment/logs', async (c) => {
    const workspaceId = c.req.param('id');
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }
    const token = getRailwayToken(db) ?? process.env.RAILWAY_API_TOKEN ?? null;
    if (!token) {
      return c.json({ error: 'Railway API token not configured', code: 'TOKEN_NOT_CONFIGURED' }, 400);
    }
    const existing = getWorkspaceDeployment(db, workspaceId);
    if (!existing) {
      return c.json({ error: 'Workspace is not linked to a Railway deployment', code: 'NOT_LINKED' }, 400);
    }
    if (!existing.lastDeploymentId) {
      return c.json({ logs: [], deploymentId: null, total: 0 });
    }
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;
    try {
      const result = await fetchRailwayDeploymentLogs(token, existing.lastDeploymentId, limit);
      return c.json({ logs: result.entries, deploymentId: existing.lastDeploymentId, total: result.total });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg, code: 'RAILWAY_API_ERROR' }, 502);
    }
  });

  return app;
}

export function createDeploymentSettingsRouter(db: Database) {
  const app = new Hono();

  // POST /api/deployment-settings/token — store Railway API token
  app.post('/token', async (c) => {
    let body: { token?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400);
    }
    if (!body.token || typeof body.token !== 'string') {
      return c.json({ error: 'token is required', code: 'BAD_REQUEST' }, 400);
    }
    setRailwayToken(db, body.token);
    return c.json({ ok: true });
  });

  // GET /api/deployment-settings/token — check if token is configured (never return actual token)
  app.get('/token', async (c) => {
    const token = getRailwayToken(db);
    return c.json({ configured: token !== null });
  });

  return app;
}
