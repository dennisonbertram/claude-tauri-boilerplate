import { Database } from 'bun:sqlite';

export interface WorkspaceProvisioningRunRow {
  id: string;
  workspace_id: string;
  provider_id: string;
  status: string;
  request_json: string;
  response_json: string;
  logs_redacted: string;
  cleanup_owner: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapProvisioningRun(row: WorkspaceProvisioningRunRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    providerId: row.provider_id,
    status: row.status as import('@claude-tauri/shared').ProvisioningRunStatus,
    requestJson: JSON.parse(row.request_json) as Record<string, unknown>,
    responseJson: JSON.parse(row.response_json) as Record<string, unknown>,
    logsRedacted: row.logs_redacted,
    cleanupOwner: row.cleanup_owner,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProvisioningRun(
  db: Database,
  workspaceId: string,
  providerId: string,
  requestJson: Record<string, unknown> = {}
) {
  const id = crypto.randomUUID();
  const stmt = db.prepare(
    `INSERT INTO workspace_provisioning_runs (id, workspace_id, provider_id, request_json)
     VALUES (?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(id, workspaceId, providerId, JSON.stringify(requestJson)) as WorkspaceProvisioningRunRow;
  return mapProvisioningRun(row);
}

export function listProvisioningRuns(db: Database, workspaceId: string) {
  const stmt = db.prepare(
    `SELECT * FROM workspace_provisioning_runs WHERE workspace_id = ? ORDER BY created_at DESC`
  );
  const rows = stmt.all(workspaceId) as WorkspaceProvisioningRunRow[];
  return rows.map(mapProvisioningRun);
}

export function getProvisioningRun(db: Database, runId: string) {
  const stmt = db.prepare(`SELECT * FROM workspace_provisioning_runs WHERE id = ?`);
  const row = stmt.get(runId) as WorkspaceProvisioningRunRow | null;
  return row ? mapProvisioningRun(row) : undefined;
}

export function updateProvisioningRunStatus(
  db: Database,
  runId: string,
  status: import('@claude-tauri/shared').ProvisioningRunStatus,
  patch?: {
    responseJson?: Record<string, unknown>;
    logsRedacted?: string;
    cleanupOwner?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  }
) {
  const setClauses: string[] = ['status = ?'];
  const values: unknown[] = [status];

  if (patch?.responseJson !== undefined) {
    setClauses.push('response_json = ?');
    values.push(JSON.stringify(patch.responseJson));
  }
  if (patch?.logsRedacted !== undefined) {
    setClauses.push('logs_redacted = ?');
    values.push(patch.logsRedacted);
  }
  if (patch?.cleanupOwner !== undefined) {
    setClauses.push('cleanup_owner = ?');
    values.push(patch.cleanupOwner);
  }
  if (patch?.startedAt !== undefined) {
    setClauses.push('started_at = ?');
    values.push(patch.startedAt);
  }
  if (patch?.finishedAt !== undefined) {
    setClauses.push('finished_at = ?');
    values.push(patch.finishedAt);
  }

  setClauses.push("updated_at = datetime('now')");
  values.push(runId);

  const stmt = db.prepare(
    `UPDATE workspace_provisioning_runs SET ${setClauses.join(', ')} WHERE id = ?`
  );
  stmt.run(...values);
}
