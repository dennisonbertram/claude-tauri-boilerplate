import { Database } from 'bun:sqlite';

interface ArtifactRow {
  id: string;
  kind: string;
  schema_version: number;
  title: string;
  project_id: string;
  workspace_id: string | null;
  source_session_id: string | null;
  source_message_id: string | null;
  status: string;
  current_revision_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ArtifactRevisionRow {
  id: string;
  artifact_id: string;
  revision_number: number;
  spec_json: string;
  summary: string | null;
  prompt: string | null;
  model: string | null;
  source_session_id: string | null;
  source_message_id: string | null;
  created_at: string;
}

function mapArtifact(row: ArtifactRow) {
  return {
    id: row.id,
    kind: row.kind as import('@claude-tauri/shared').ArtifactKind,
    schemaVersion: row.schema_version,
    title: row.title,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    sourceSessionId: row.source_session_id,
    sourceMessageId: row.source_message_id,
    status: row.status as import('@claude-tauri/shared').ArtifactStatus,
    currentRevisionId: row.current_revision_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapArtifactRevision(row: ArtifactRevisionRow) {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    revisionNumber: row.revision_number,
    specJson: row.spec_json,
    summary: row.summary,
    prompt: row.prompt,
    model: row.model,
    sourceSessionId: row.source_session_id,
    sourceMessageId: row.source_message_id,
    createdAt: row.created_at,
  };
}

export function createArtifact(db: Database, params: {
  id: string;
  kind: string;
  schemaVersion: number;
  title: string;
  projectId: string;
  workspaceId: string | null;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  status: 'active' | 'archived';
}) {
  const stmt = db.prepare(
    `INSERT INTO artifacts (id, kind, schema_version, title, project_id, workspace_id, source_session_id, source_message_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    params.id,
    params.kind,
    params.schemaVersion,
    params.title,
    params.projectId,
    params.workspaceId,
    params.sourceSessionId,
    params.sourceMessageId,
    params.status
  ) as ArtifactRow;
  return mapArtifact(row);
}

export function getArtifact(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM artifacts WHERE id = ?`);
  const row = stmt.get(id) as ArtifactRow | null;
  return row ? mapArtifact(row) : null;
}

export function listArtifactsByProject(db: Database, projectId: string, opts?: { includeArchived?: boolean }) {
  const includeArchived = opts?.includeArchived ?? false;
  if (includeArchived) {
    const stmt = db.prepare(`SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at DESC`);
    const rows = stmt.all(projectId) as ArtifactRow[];
    return rows.map(mapArtifact);
  } else {
    const stmt = db.prepare(`SELECT * FROM artifacts WHERE project_id = ? AND status = 'active' ORDER BY created_at DESC`);
    const rows = stmt.all(projectId) as ArtifactRow[];
    return rows.map(mapArtifact);
  }
}

export function setArtifactCurrentRevision(db: Database, artifactId: string, revisionId: string) {
  const stmt = db.prepare(
    `UPDATE artifacts SET current_revision_id = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(revisionId, artifactId);
}

export function archiveArtifact(db: Database, id: string) {
  const stmt = db.prepare(
    `UPDATE artifacts SET status = 'archived', updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(id);
}

export function createArtifactRevision(db: Database, params: {
  id: string;
  artifactId: string;
  revisionNumber: number;
  specJson: string;
  summary: string | null;
  prompt: string | null;
  model: string | null;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
}) {
  const stmt = db.prepare(
    `INSERT INTO artifact_revisions (id, artifact_id, revision_number, spec_json, summary, prompt, model, source_session_id, source_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    params.id,
    params.artifactId,
    params.revisionNumber,
    params.specJson,
    params.summary,
    params.prompt,
    params.model,
    params.sourceSessionId,
    params.sourceMessageId
  ) as ArtifactRevisionRow;
  return mapArtifactRevision(row);
}

export function updateArtifactTitle(db: Database, id: string, title: string) {
  const stmt = db.prepare(
    `UPDATE artifacts SET title = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(title, id);
}

export function getArtifactLatestRevision(db: Database, artifactId: string) {
  const stmt = db.prepare(
    `SELECT * FROM artifact_revisions WHERE artifact_id = ? ORDER BY revision_number DESC LIMIT 1`
  );
  const row = stmt.get(artifactId) as ArtifactRevisionRow | null;
  return row ? mapArtifactRevision(row) : null;
}

export function getArtifactRevision(db: Database, revisionId: string) {
  const stmt = db.prepare(`SELECT * FROM artifact_revisions WHERE id = ?`);
  const row = stmt.get(revisionId) as ArtifactRevisionRow | null;
  return row ? mapArtifactRevision(row) : null;
}

export function countArtifactRevisions(db: Database, artifactId: string): number {
  const stmt = db.prepare(
    `SELECT COUNT(*) AS count FROM artifact_revisions WHERE artifact_id = ?`
  );
  const row = stmt.get(artifactId) as { count: number } | null;
  return row?.count ?? 0;
}
