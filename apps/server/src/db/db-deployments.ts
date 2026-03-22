import { Database } from 'bun:sqlite';

interface WorkspaceDeploymentRow {
  id: string;
  workspace_id: string;
  railway_project_id: string;
  railway_service_id: string;
  railway_environment_id: string;
  last_deployment_status: string | null;
  last_deployment_id: string | null;
  last_deployment_created_at: string | null;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

function mapWorkspaceDeployment(row: WorkspaceDeploymentRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    railwayProjectId: row.railway_project_id,
    railwayServiceId: row.railway_service_id,
    railwayEnvironmentId: row.railway_environment_id,
    lastDeploymentStatus: (row.last_deployment_status ?? null) as 'success' | 'failed' | 'building' | 'deploying' | null,
    lastDeploymentId: row.last_deployment_id,
    lastDeploymentCreatedAt: row.last_deployment_created_at,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getWorkspaceDeployment(db: Database, workspaceId: string) {
  const stmt = db.prepare(
    `SELECT * FROM workspace_deployments WHERE workspace_id = ?`
  );
  const row = stmt.get(workspaceId) as WorkspaceDeploymentRow | null;
  return row ? mapWorkspaceDeployment(row) : null;
}

export function upsertWorkspaceDeployment(
  db: Database,
  workspaceId: string,
  railwayProjectId: string,
  railwayServiceId: string,
  railwayEnvironmentId: string
) {
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO workspace_deployments (id, workspace_id, railway_project_id, railway_service_id, railway_environment_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET
      railway_project_id = excluded.railway_project_id,
      railway_service_id = excluded.railway_service_id,
      railway_environment_id = excluded.railway_environment_id,
      updated_at = datetime('now')
    RETURNING *
  `);
  const row = stmt.get(id, workspaceId, railwayProjectId, railwayServiceId, railwayEnvironmentId) as WorkspaceDeploymentRow;
  return mapWorkspaceDeployment(row);
}

export function updateWorkspaceDeploymentStatus(
  db: Database,
  workspaceId: string,
  status: 'success' | 'failed' | 'building' | 'deploying' | null,
  deploymentId: string | null,
  deploymentCreatedAt: string | null
) {
  const stmt = db.prepare(`
    UPDATE workspace_deployments
    SET last_deployment_status = ?,
        last_deployment_id = ?,
        last_deployment_created_at = ?,
        last_checked_at = datetime('now'),
        updated_at = datetime('now')
    WHERE workspace_id = ?
    RETURNING *
  `);
  const row = stmt.get(status, deploymentId, deploymentCreatedAt, workspaceId) as WorkspaceDeploymentRow | null;
  return row ? mapWorkspaceDeployment(row) : null;
}

export function deleteWorkspaceDeployment(db: Database, workspaceId: string): void {
  db.prepare(`DELETE FROM workspace_deployments WHERE workspace_id = ?`).run(workspaceId);
}

// ─── Deployment Settings (Railway Token) ──────────────────────────────────────

export function getRailwayToken(db: Database): string | null {
  const row = db.prepare(`SELECT railway_api_token FROM deployment_settings WHERE id = 1`).get() as { railway_api_token: string | null } | null;
  return row?.railway_api_token ?? null;
}

export function setRailwayToken(db: Database, token: string): void {
  db.prepare(`
    INSERT INTO deployment_settings (id, railway_api_token)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET
      railway_api_token = excluded.railway_api_token,
      updated_at = datetime('now')
  `).run(token);
}
