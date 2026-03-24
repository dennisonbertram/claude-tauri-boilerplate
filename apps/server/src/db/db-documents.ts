import { Database } from 'bun:sqlite';

interface DocumentRow {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  pipeline_steps: string;
  tags: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapDocument(row: DocumentRow) {
  return {
    id: row.id,
    filename: row.filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    status: row.status as import('@claude-tauri/shared').DocumentStatus,
    pipelineSteps: JSON.parse(row.pipeline_steps) as import('@claude-tauri/shared').DocumentPipelineStep[],
    tags: JSON.parse(row.tags) as string[],
    sessionId: row.session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createDocument(db: Database, params: {
  id: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  status?: string;
  sessionId?: string | null;
}) {
  const stmt = db.prepare(
    `INSERT INTO documents (id, filename, storage_path, mime_type, size_bytes, status, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    params.id,
    params.filename,
    params.storagePath,
    params.mimeType,
    params.sizeBytes,
    params.status ?? 'ready',
    params.sessionId ?? null,
  ) as DocumentRow;
  return mapDocument(row);
}

export function getDocument(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
  const row = stmt.get(id) as DocumentRow | null;
  return row ? mapDocument(row) : null;
}

export function listDocuments(db: Database, opts?: {
  status?: string;
  mimeType?: string;
  search?: string;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts?.status) {
    conditions.push('status = ?');
    params.push(opts.status);
  }
  if (opts?.mimeType) {
    conditions.push('mime_type = ?');
    params.push(opts.mimeType);
  }
  if (opts?.search) {
    conditions.push('filename LIKE ?');
    params.push(`%${opts.search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`SELECT * FROM documents ${where} ORDER BY created_at DESC`);
  const rows = stmt.all(...params) as DocumentRow[];
  return rows.map(mapDocument);
}

export function updateDocument(db: Database, id: string, updates: {
  status?: string;
  tags?: string[];
  pipelineSteps?: unknown[];
}) {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  if (updates.tags !== undefined) {
    sets.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }
  if (updates.pipelineSteps !== undefined) {
    sets.push('pipeline_steps = ?');
    params.push(JSON.stringify(updates.pipelineSteps));
  }

  if (sets.length === 0) return null;

  sets.push("updated_at = datetime('now')");
  params.push(id);

  const stmt = db.prepare(
    `UPDATE documents SET ${sets.join(', ')} WHERE id = ? RETURNING *`
  );
  const row = stmt.get(...params) as DocumentRow | null;
  return row ? mapDocument(row) : null;
}

export function deleteDocument(db: Database, id: string): string | null {
  const stmt = db.prepare(`DELETE FROM documents WHERE id = ? RETURNING storage_path`);
  const row = stmt.get(id) as { storage_path: string } | null;
  return row ? row.storage_path : null;
}

export function bulkDeleteDocuments(db: Database, ids: string[]): string[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  const stmt = db.prepare(`DELETE FROM documents WHERE id IN (${placeholders}) RETURNING storage_path`);
  const rows = stmt.all(...ids) as { storage_path: string }[];
  return rows.map(r => r.storage_path);
}
