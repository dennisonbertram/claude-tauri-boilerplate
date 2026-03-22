import { Database } from 'bun:sqlite';
import { mapSession } from './db-sessions';

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface CheckpointRow {
  id: string;
  session_id: string;
  user_message_id: string;
  prompt_preview: string;
  timestamp: string;
  files_changed: string;
  turn_index: number;
  git_commit: string | null;
  message_count: number;
}

export type CheckpointMetadata = {
  sessionId: string;
  userMessageId: string;
  promptPreview: string;
  filesChanged: import('@claude-tauri/shared').FileChange[];
  turnIndex: number;
  gitCommit?: string | null;
  messageCount?: number;
};

interface MessagePartRow {
  id: string;
  message_id: string;
  part_type: string;
  ordinal: number;
  text: string | null;
  artifact_id: string | null;
  artifact_revision_id: string | null;
  metadata_json: string | null;
  created_at: string;
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

function mapCheckpoint(row: CheckpointRow) {
  return {
    id: row.id,
    userMessageId: row.user_message_id,
    promptPreview: row.prompt_preview,
    timestamp: row.timestamp,
    filesChanged: JSON.parse(row.files_changed) as import('@claude-tauri/shared').FileChange[],
    turnIndex: row.turn_index,
    gitCommit: row.git_commit,
    messageCount: row.message_count,
  };
}

function mapMessagePart(row: MessagePartRow) {
  return {
    type: row.part_type,
    text: row.text ?? undefined,
    artifactId: row.artifact_id ?? undefined,
    artifactRevisionId: row.artifact_revision_id ?? undefined,
    ordinal: row.ordinal,
  };
}

export function addMessage(
  db: Database,
  id: string,
  sessionId: string,
  role: string,
  content: string,
  parts?: Array<{ type: string; text?: string; artifactId?: string; artifactRevisionId?: string; [key: string]: unknown }>
) {
  return db.transaction(() => {
    const stmt = db.prepare(
      `INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?) RETURNING *`
    );
    const row = stmt.get(id, sessionId, role, content) as MessageRow;
    if (parts && parts.length > 0) {
      const partStmt = db.prepare(
        `INSERT INTO message_parts (id, message_id, part_type, ordinal, text, artifact_id, artifact_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        partStmt.run(
          crypto.randomUUID(),
          id,
          part.type,
          i,
          part.text ?? null,
          part.artifactId ?? null,
          part.artifactRevisionId ?? null
        );
      }
    }
    return mapMessage(row);
  })();
}

export function getMessages(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
  );
  const rows = stmt.all(sessionId) as MessageRow[];
  return rows.map(mapMessage);
}

export function getSessionMessageCount(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `SELECT COUNT(*) AS count FROM messages WHERE session_id = ?`
  );
  const row = stmt.get(sessionId) as { count: number } | null;
  return row?.count ?? 0;
}

export function listSessionCheckpoints(db: Database, sessionId: string) {
  const stmt = db.prepare(
    `SELECT * FROM checkpoints WHERE session_id = ? ORDER BY turn_index ASC, timestamp ASC, id ASC`
  );
  const rows = stmt.all(sessionId) as CheckpointRow[];
  return rows.map(mapCheckpoint);
}

export function getSessionCheckpoint(db: Database, sessionId: string, checkpointId: string) {
  const stmt = db.prepare(
    `SELECT * FROM checkpoints WHERE session_id = ? AND id = ?`
  );
  const row = stmt.get(sessionId, checkpointId) as CheckpointRow | null;
  return row ? mapCheckpoint(row) : null;
}

export function createCheckpoint(db: Database, checkpoint: CheckpointMetadata) {
  const id = crypto.randomUUID();
  const stmt = db.prepare(
    `INSERT INTO checkpoints (
      id,
      session_id,
      user_message_id,
      prompt_preview,
      files_changed,
      turn_index,
      git_commit,
      message_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(
    id,
    checkpoint.sessionId,
    checkpoint.userMessageId,
    checkpoint.promptPreview,
    JSON.stringify(checkpoint.filesChanged),
    checkpoint.turnIndex,
    checkpoint.gitCommit ?? null,
    checkpoint.messageCount ?? 0
  ) as CheckpointRow;
  return mapCheckpoint(row);
}

export function deleteSessionCheckpointsAfter(db: Database, sessionId: string, checkpointId: string) {
  const checkpoint = getSessionCheckpoint(db, sessionId, checkpointId);
  if (!checkpoint) return;
  const stmt = db.prepare(
    `DELETE FROM checkpoints WHERE session_id = ? AND turn_index > ?`
  );
  return stmt.run(sessionId, checkpoint.turnIndex);
}

export function trimSessionMessagesToCount(db: Database, sessionId: string, messageCount: number) {
  const count = Math.max(0, messageCount);
  const stmt = db.prepare(
    `SELECT id FROM messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC`
  );
  const rows = stmt.all(sessionId) as Array<{ id: string }>;
  const idsToDelete = rows.slice(count).map((row) => row.id);
  if (idsToDelete.length === 0) return;

  const deleteStmt = db.prepare(`DELETE FROM messages WHERE id = ?`);
  for (const id of idsToDelete) {
    deleteStmt.run(id);
  }
}

export function getThreadMessages(db: Database, sessionId: string) {
  const msgStmt = db.prepare(
    `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
  );
  const messages = msgStmt.all(sessionId) as MessageRow[];

  const partStmt = db.prepare(
    `SELECT * FROM message_parts WHERE message_id = ? ORDER BY ordinal ASC`
  );

  return messages.map((msg) => {
    const partRows = partStmt.all(msg.id) as MessagePartRow[];
    let parts: ReturnType<typeof mapMessagePart>[];
    if (partRows.length === 0) {
      // Legacy message: synthesize a fallback text part
      parts = [{ type: 'text', text: msg.content, ordinal: 0, artifactId: undefined, artifactRevisionId: undefined }];
    } else {
      parts = partRows.map(mapMessagePart);
    }
    return {
      ...mapMessage(msg),
      parts,
    };
  });
}
