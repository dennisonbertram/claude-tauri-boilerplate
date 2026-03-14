import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  createDb,
  createSession,
  getSession,
  listSessions,
  deleteSession,
  updateSessionTitle,
  updateClaudeSessionId,
  addMessage,
  getMessages,
} from './index';

describe('Database Module', () => {
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('createSession / getSession', () => {
    test('creates a session and retrieves it by ID', () => {
      const session = createSession(db, 'sess-1', 'My Chat');

      expect(session.id).toBe('sess-1');
      expect(session.title).toBe('My Chat');
      expect(session.claudeSessionId).toBeNull();
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();

      const retrieved = getSession(db, 'sess-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('sess-1');
      expect(retrieved!.title).toBe('My Chat');
    });

    test('creates a session with default title when none provided', () => {
      const session = createSession(db, 'sess-2');

      expect(session.title).toBe('New Chat');
    });

    test('getSession returns null for non-existent ID', () => {
      const result = getSession(db, 'does-not-exist');
      expect(result).toBeNull();
    });
  });

  describe('listSessions', () => {
    test('returns empty array when no sessions exist', () => {
      const sessions = listSessions(db);
      expect(sessions).toEqual([]);
    });

    test('returns sessions ordered by createdAt descending (newest first)', () => {
      // Insert with explicit timestamps to control ordering
      db.run(
        `INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        ['old', 'Old Chat', '2024-01-01 00:00:00', '2024-01-01 00:00:00']
      );
      db.run(
        `INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        ['new', 'New Chat', '2024-06-01 00:00:00', '2024-06-01 00:00:00']
      );

      const sessions = listSessions(db);
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('new');
      expect(sessions[1].id).toBe('old');
    });
  });

  describe('deleteSession', () => {
    test('deletes a session', () => {
      createSession(db, 'sess-del');
      expect(getSession(db, 'sess-del')).not.toBeNull();

      deleteSession(db, 'sess-del');
      expect(getSession(db, 'sess-del')).toBeNull();
    });

    test('cascade deletes all messages when session is deleted', () => {
      createSession(db, 'sess-cascade');
      addMessage(db, 'msg-1', 'sess-cascade', 'user', 'Hello');
      addMessage(db, 'msg-2', 'sess-cascade', 'assistant', 'Hi there');

      expect(getMessages(db, 'sess-cascade')).toHaveLength(2);

      deleteSession(db, 'sess-cascade');

      expect(getMessages(db, 'sess-cascade')).toHaveLength(0);
    });

    test('does not throw when deleting non-existent session', () => {
      expect(() => deleteSession(db, 'ghost')).not.toThrow();
    });
  });

  describe('updateSessionTitle', () => {
    test('updates the title of an existing session', () => {
      createSession(db, 'sess-title', 'Original');
      updateSessionTitle(db, 'sess-title', 'Updated Title');

      const session = getSession(db, 'sess-title');
      expect(session!.title).toBe('Updated Title');
    });

    test('updates the updated_at timestamp', () => {
      // Insert with old timestamp
      db.run(
        `INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        ['sess-ts', 'Chat', '2024-01-01 00:00:00', '2024-01-01 00:00:00']
      );

      updateSessionTitle(db, 'sess-ts', 'New Title');

      const session = getSession(db, 'sess-ts');
      expect(session!.updatedAt).not.toBe('2024-01-01 00:00:00');
    });
  });

  describe('updateClaudeSessionId', () => {
    test('sets the claudeSessionId on a session', () => {
      createSession(db, 'sess-claude');
      updateClaudeSessionId(db, 'sess-claude', 'claude-abc-123');

      const session = getSession(db, 'sess-claude');
      expect(session!.claudeSessionId).toBe('claude-abc-123');
    });

    test('updates the updated_at timestamp', () => {
      db.run(
        `INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        ['sess-claude2', 'Chat', '2024-01-01 00:00:00', '2024-01-01 00:00:00']
      );

      updateClaudeSessionId(db, 'sess-claude2', 'claude-xyz');

      const session = getSession(db, 'sess-claude2');
      expect(session!.updatedAt).not.toBe('2024-01-01 00:00:00');
    });
  });

  describe('addMessage / getMessages', () => {
    test('adds a message and retrieves it', () => {
      createSession(db, 'sess-msg');
      addMessage(db, 'msg-1', 'sess-msg', 'user', 'Hello world');

      const messages = getMessages(db, 'sess-msg');
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].sessionId).toBe('sess-msg');
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello world');
      expect(messages[0].createdAt).toBeDefined();
    });

    test('returns messages ordered by createdAt ascending', () => {
      createSession(db, 'sess-order');

      // Insert with explicit timestamps
      db.run(
        `INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
        ['msg-late', 'sess-order', 'assistant', 'Second', '2024-06-02 00:00:00']
      );
      db.run(
        `INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
        ['msg-early', 'sess-order', 'user', 'First', '2024-06-01 00:00:00']
      );

      const messages = getMessages(db, 'sess-order');
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-early');
      expect(messages[1].id).toBe('msg-late');
    });

    test('returns empty array for session with no messages', () => {
      createSession(db, 'sess-empty');
      const messages = getMessages(db, 'sess-empty');
      expect(messages).toEqual([]);
    });

    test('rejects message with invalid role', () => {
      createSession(db, 'sess-role');
      expect(() => addMessage(db, 'msg-bad', 'sess-role', 'system', 'Not allowed')).toThrow();
    });

    test('rejects message referencing non-existent session', () => {
      expect(() => addMessage(db, 'msg-orphan', 'no-session', 'user', 'Orphan')).toThrow();
    });
  });
});
