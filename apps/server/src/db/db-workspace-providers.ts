import { Database } from 'bun:sqlite';

export interface WorkspaceProviderRow {
  id: string;
  project_id: string | null;
  name: string;
  type: string;
  command: string;
  args_json: string;
  working_dir: string | null;
  timeout_ms: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function mapWorkspaceProvider(row: WorkspaceProviderRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type as 'script',
    command: row.command,
    argsJson: JSON.parse(row.args_json) as string[],
    workingDir: row.working_dir,
    timeoutMs: row.timeout_ms,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkspaceProvider(
  db: Database,
  data: {
    id: string;
    projectId?: string | null;
    name: string;
    command: string;
    args?: string[];
    workingDir?: string | null;
    timeoutMs?: number;
    enabled?: boolean;
  }
) {
  const stmt = db.prepare(
    `INSERT INTO workspace_providers (id, project_id, name, command, args_json, working_dir, timeout_ms, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    data.id,
    data.projectId ?? null,
    data.name,
    data.command,
    JSON.stringify(data.args ?? []),
    data.workingDir ?? null,
    data.timeoutMs ?? 1800000,
    data.enabled !== false ? 1 : 0
  ) as WorkspaceProviderRow;
  return mapWorkspaceProvider(row);
}

export function listWorkspaceProviders(db: Database, projectId?: string) {
  if (projectId !== undefined) {
    const stmt = db.prepare(`SELECT * FROM workspace_providers WHERE project_id = ? ORDER BY created_at DESC`);
    const rows = stmt.all(projectId) as WorkspaceProviderRow[];
    return rows.map(mapWorkspaceProvider);
  }
  const stmt = db.prepare(`SELECT * FROM workspace_providers ORDER BY created_at DESC`);
  const rows = stmt.all() as WorkspaceProviderRow[];
  return rows.map(mapWorkspaceProvider);
}

export function getWorkspaceProvider(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM workspace_providers WHERE id = ?`);
  const row = stmt.get(id) as WorkspaceProviderRow | null;
  return row ? mapWorkspaceProvider(row) : undefined;
}

export function updateWorkspaceProvider(
  db: Database,
  id: string,
  patch: {
    name?: string;
    command?: string;
    args?: string[];
    workingDir?: string | null;
    timeoutMs?: number;
    enabled?: boolean;
  }
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) {
    setClauses.push('name = ?');
    values.push(patch.name);
  }
  if (patch.command !== undefined) {
    setClauses.push('command = ?');
    values.push(patch.command);
  }
  if (patch.args !== undefined) {
    setClauses.push('args_json = ?');
    values.push(JSON.stringify(patch.args));
  }
  if (patch.workingDir !== undefined) {
    setClauses.push('working_dir = ?');
    values.push(patch.workingDir);
  }
  if (patch.timeoutMs !== undefined) {
    setClauses.push('timeout_ms = ?');
    values.push(patch.timeoutMs);
  }
  if (patch.enabled !== undefined) {
    setClauses.push('enabled = ?');
    values.push(patch.enabled ? 1 : 0);
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(
    `UPDATE workspace_providers SET ${setClauses.join(', ')} WHERE id = ?`
  );
  stmt.run(...values);
}

export function deleteWorkspaceProvider(db: Database, id: string) {
  const activeCheck = db.prepare(
    `SELECT COUNT(*) as count FROM workspace_provisioning_runs WHERE provider_id = ? AND status IN ('pending','running')`
  );
  const result = activeCheck.get(id) as { count: number };
  if (result.count > 0) {
    const err = new Error('Cannot delete provider with active provisioning runs');
    (err as any).status = 409;
    (err as any).code = 'ACTIVE_RUNS_EXIST';
    throw err;
  }
  const stmt = db.prepare(`DELETE FROM workspace_providers WHERE id = ?`);
  stmt.run(id);
}
