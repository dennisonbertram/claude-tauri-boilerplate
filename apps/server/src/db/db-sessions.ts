import { Database } from 'bun:sqlite';

interface SessionRow {
  id: string;
  title: string;
  claude_session_id: string | null;
  model: string;
  workspace_id: string | null;
  profile_id: string | null;
  linear_issue_id: string | null;
  linear_issue_title: string | null;
  linear_issue_summary: string | null;
  linear_issue_url: string | null;
  created_at: string;
  updated_at: string;
}

type SessionWithProfileRow = SessionRow & {
  message_count: number;
  profile_name: string | null;
  profile_icon: string | null;
  profile_color: string | null;
};

export type LinearIssueMetadata = {
  id: string;
  title: string;
  summary?: string;
  url?: string;
};

export function mapSession(row: SessionRow) {
  return {
    id: row.id,
    title: row.title,
    claudeSessionId: row.claude_session_id,
    model: row.model,
    workspaceId: row.workspace_id,
    profileId: row.profile_id ?? null,
    linearIssueId: row.linear_issue_id,
    linearIssueTitle: row.linear_issue_title,
    linearIssueSummary: row.linear_issue_summary,
    linearIssueUrl: row.linear_issue_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSessionWithProfile(row: SessionWithProfileRow) {
  const session = mapSession(row);
  const profile = row.profile_id
    ? { id: row.profile_id, name: row.profile_name!, icon: row.profile_icon, color: row.profile_color }
    : null;
  return { ...session, messageCount: row.message_count, profile };
}

export function createSession(
  db: Database,
  id: string,
  title?: string,
  linearIssue?: LinearIssueMetadata,
  model?: string
) {
  const linearIssueId = linearIssue?.id ?? null;
  const linearIssueTitle = linearIssue?.title ?? null;
  const linearIssueSummary = linearIssue?.summary ?? null;
  const linearIssueUrl = linearIssue?.url ?? null;
  const sessionModel = model ?? 'claude-sonnet-4-6';
  const stmt = db.prepare(
    `INSERT INTO sessions (id, title, model, linear_issue_id, linear_issue_title, linear_issue_summary, linear_issue_url) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    id,
    title || 'New Chat',
    sessionModel,
    linearIssueId,
    linearIssueTitle,
    linearIssueSummary,
    linearIssueUrl
  ) as SessionRow;
  return mapSession(row);
}

export function getSession(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
  const row = stmt.get(id) as SessionRow | null;
  return row ? mapSession(row) : null;
}

export function listSessions(db: Database, searchQuery?: string) {
  const normalized = (searchQuery ?? '').trim();

  if (!normalized) {
    const stmt = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count,
        ap.name AS profile_name,
        ap.icon AS profile_icon,
        ap.color AS profile_color
      FROM sessions s
      LEFT JOIN agent_profiles ap ON ap.id = s.profile_id
      ORDER BY s.created_at DESC
    `);
    const rows = stmt.all() as SessionWithProfileRow[];
    return rows.map(mapSessionWithProfile);
  }

  const pattern = `%${normalized}%`;
  const stmt = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM messages m2 WHERE m2.session_id = s.id) AS message_count,
      ap.name AS profile_name,
      ap.icon AS profile_icon,
      ap.color AS profile_color
    FROM sessions s
    LEFT JOIN agent_profiles ap ON ap.id = s.profile_id
    LEFT JOIN messages m ON m.session_id = s.id
    WHERE s.title LIKE ? OR m.content LIKE ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `);
  const rows = stmt.all(pattern, pattern) as SessionWithProfileRow[];

  return rows.map(mapSessionWithProfile);
}

export function deleteSession(db: Database, id: string) {
  const stmt = db.prepare(`DELETE FROM sessions WHERE id = ?`);
  return stmt.run(id);
}

export function updateSessionTitle(db: Database, id: string, title: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(title, id);
}

export function updateSessionModel(db: Database, id: string, model: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET model = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(model, id);
}

export function updateClaudeSessionId(
  db: Database,
  sessionId: string,
  claudeSessionId: string
) {
  const stmt = db.prepare(
    `UPDATE sessions SET claude_session_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(claudeSessionId, sessionId);
}

export function setSessionLinearIssue(
  db: Database,
  sessionId: string,
  linearIssue: LinearIssueMetadata
) {
  const stmt = db.prepare(
    `UPDATE sessions SET linear_issue_id = ?, linear_issue_title = ?, linear_issue_summary = ?, linear_issue_url = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(
    linearIssue.id,
    linearIssue.title,
    linearIssue.summary ?? null,
    linearIssue.url ?? null,
    sessionId
  );
}

export function clearClaudeSessionId(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET claude_session_id = NULL, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(sessionId);
}

export function getSessionForWorkspace(db: Database, workspaceId: string) {
  const stmt = db.prepare(
    `SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 1`
  );
  const row = stmt.get(workspaceId) as any;
  if (!row) return null;
  return mapSession(row);
}

export function linkSessionToWorkspace(db: Database, sessionId: string, workspaceId: string) {
  const stmt = db.prepare(
    `UPDATE sessions SET workspace_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(workspaceId, sessionId);
}

export function linkSessionToProfile(db: Database, sessionId: string, profileId: string | null) {
  const stmt = db.prepare(
    `UPDATE sessions SET profile_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(profileId, sessionId);
}
