import { Database } from 'bun:sqlite';

interface SessionMcpOverrideRow {
  session_id: string;
  server_name: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function mapOverride(row: SessionMcpOverrideRow) {
  return {
    sessionId: row.session_id,
    serverName: row.server_name,
    enabled: !!row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getSessionMcpOverrides(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `SELECT * FROM session_mcp_overrides WHERE session_id = ?`
  );
  const rows = stmt.all(sessionId) as SessionMcpOverrideRow[];
  return rows.map(mapOverride);
}

export function setSessionMcpOverride(
  db: Database,
  sessionId: string,
  serverName: string,
  enabled: boolean
) {
  const stmt = db.prepare(
    `INSERT INTO session_mcp_overrides (session_id, server_name, enabled, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(session_id, server_name) DO UPDATE SET enabled = ?, updated_at = datetime('now')`
  );
  return stmt.run(sessionId, serverName, enabled ? 1 : 0, enabled ? 1 : 0);
}

export function deleteSessionMcpOverride(
  db: Database,
  sessionId: string,
  serverName: string
) {
  const stmt = db.prepare(
    `DELETE FROM session_mcp_overrides WHERE session_id = ? AND server_name = ?`
  );
  return stmt.run(sessionId, serverName);
}

export function copySessionMcpOverrides(
  db: Database,
  fromSessionId: string,
  toSessionId: string
) {
  const stmt = db.prepare(
    `INSERT INTO session_mcp_overrides (session_id, server_name, enabled, created_at, updated_at)
     SELECT ?, server_name, enabled, datetime('now'), datetime('now')
     FROM session_mcp_overrides WHERE session_id = ?`
  );
  return stmt.run(toSessionId, fromSessionId);
}
