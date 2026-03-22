import { Database } from 'bun:sqlite';

interface DiffCommentRow {
  id: string;
  workspace_id: string;
  file_path: string;
  line_number: number | null;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

function mapDiffComment(row: DiffCommentRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    filePath: row.file_path,
    lineNumber: row.line_number ?? null,
    content: row.content,
    author: row.author as 'user' | 'ai',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listDiffComments(db: Database, workspaceId: string) {
  const stmt = db.prepare(
    `SELECT * FROM diff_comments WHERE workspace_id = ? ORDER BY created_at ASC`
  );
  const rows = stmt.all(workspaceId) as DiffCommentRow[];
  return rows.map(mapDiffComment);
}

export function createDiffComment(
  db: Database,
  id: string,
  workspaceId: string,
  filePath: string,
  content: string,
  lineNumber?: number | null,
  author: 'user' | 'ai' = 'user'
) {
  const stmt = db.prepare(
    `INSERT INTO diff_comments (id, workspace_id, file_path, line_number, content, author)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(id, workspaceId, filePath, lineNumber ?? null, content, author) as DiffCommentRow;
  return mapDiffComment(row);
}

export function getDiffComment(db: Database, workspaceId: string, commentId: string) {
  const stmt = db.prepare(
    `SELECT * FROM diff_comments WHERE workspace_id = ? AND id = ?`
  );
  const row = stmt.get(workspaceId, commentId) as DiffCommentRow | null;
  return row ? mapDiffComment(row) : null;
}

export function deleteDiffComment(db: Database, workspaceId: string, commentId: string): boolean {
  const stmt = db.prepare(
    `DELETE FROM diff_comments WHERE workspace_id = ? AND id = ?`
  );
  const result = stmt.run(workspaceId, commentId);
  return result.changes > 0;
}
