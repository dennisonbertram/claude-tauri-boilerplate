import { Database } from 'bun:sqlite';
import { SCHEMA } from './schema';
import { join } from 'path';
import { mkdirSync } from 'fs';

const DB_DIR = join(process.env.HOME || '~', '.claude-tauri');
const DB_PATH = join(DB_DIR, 'data.db');

interface SessionRow {
  id: string;
  title: string;
  claude_session_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

function mapSession(row: SessionRow) {
  return {
    id: row.id,
    title: row.title,
    claudeSessionId: row.claude_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: row.created_at,
  };
}

export function createDb(path?: string): Database {
  if (path !== ':memory:') {
    mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(path || DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function createSession(db: Database, id: string, title?: string) {
  const stmt = db.prepare(
    `INSERT INTO sessions (id, title) VALUES (?, ?) RETURNING *`
  );
  const row = stmt.get(id, title || 'New Chat') as SessionRow;
  return mapSession(row);
}

export function getSession(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
  const row = stmt.get(id) as SessionRow | null;
  return row ? mapSession(row) : null;
}

export function listSessions(db: Database) {
  const stmt = db.prepare(`SELECT * FROM sessions ORDER BY created_at DESC`);
  const rows = stmt.all() as SessionRow[];
  return rows.map(mapSession);
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

export function addMessage(
  db: Database,
  id: string,
  sessionId: string,
  role: string,
  content: string
) {
  const stmt = db.prepare(
    `INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(id, sessionId, role, content) as MessageRow;
  return mapMessage(row);
}

export function getMessages(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
  );
  const rows = stmt.all(sessionId) as MessageRow[];
  return rows.map(mapMessage);
}
