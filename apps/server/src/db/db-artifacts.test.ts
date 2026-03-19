import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import {
  addMessage,
  archiveArtifact,
  createArtifact,
  createArtifactRevision,
  createDb,
  createProject,
  createSession,
  getArtifact,
  getThreadMessages,
  listArtifactsByProject,
  setArtifactCurrentRevision,
} from './index';

describe('artifact + durable thread persistence', () => {
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  test('creates artifact tables and message_parts table', () => {
    const tableRows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('artifacts','artifact_revisions','message_parts') ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tableRows.map((row) => row.name)).toEqual([
      'artifact_revisions',
      'artifacts',
      'message_parts',
    ]);

    const messagePartColumns = db.prepare('PRAGMA table_info(message_parts)').all() as Array<{ name: string }>;
    expect(messagePartColumns.map((column) => column.name)).toContain('part_type');
    expect(messagePartColumns.map((column) => column.name)).toContain('ordinal');
  });

  test('hydrates legacy messages without message_parts with fallback text part', () => {
    createSession(db, 'sess-legacy', 'Legacy Chat');
    db.prepare(`INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`).run(
      'msg-legacy',
      'sess-legacy',
      'assistant',
      'Legacy content',
    );

    const thread = getThreadMessages(db, 'sess-legacy');
    expect(thread).toHaveLength(1);
    expect(thread[0].parts).toHaveLength(1);
    expect(thread[0].parts[0]).toMatchObject({
      type: 'text',
      text: 'Legacy content',
      ordinal: 0,
    });
  });

  test('links artifact revisions and updates current revision', () => {
    createProject(db, 'proj-1', 'Project', '/tmp/project', '/tmp/project', 'main');

    const artifact = createArtifact(db, {
      id: 'art-1',
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Team Dashboard',
      projectId: 'proj-1',
      workspaceId: null,
      sourceSessionId: null,
      sourceMessageId: null,
      status: 'active',
    });

    const revision1 = createArtifactRevision(db, {
      id: 'rev-1',
      artifactId: artifact.id,
      revisionNumber: 1,
      specJson: JSON.stringify({ kind: 'dashboard', schemaVersion: 1, title: 'v1', layout: { columns: 12, rowHeight: 32, gap: 8 }, widgets: [], dataSources: [] }),
      summary: 'initial',
      prompt: 'build v1',
      model: 'claude-sonnet-4-6',
      sourceSessionId: null,
      sourceMessageId: null,
    });

    const revision2 = createArtifactRevision(db, {
      id: 'rev-2',
      artifactId: artifact.id,
      revisionNumber: 2,
      specJson: JSON.stringify({ kind: 'dashboard', schemaVersion: 1, title: 'v2', layout: { columns: 12, rowHeight: 32, gap: 8 }, widgets: [], dataSources: [] }),
      summary: 'second',
      prompt: 'build v2',
      model: 'claude-sonnet-4-6',
      sourceSessionId: null,
      sourceMessageId: null,
    });

    setArtifactCurrentRevision(db, artifact.id, revision2.id);

    const loaded = getArtifact(db, artifact.id);
    expect(loaded?.currentRevisionId).toBe(revision2.id);
    expect(revision1.revisionNumber).toBe(1);
    expect(revision2.revisionNumber).toBe(2);
  });

  test('addMessage transaction safety: all parts are present when message is created successfully', () => {
    // This guards against the partial-write scenario where message INSERT
    // succeeds but one of the part INSERTs fails, leaving the message in the
    // DB without its parts. The invariant: if addMessage returns without
    // throwing, ALL parts must be present in the DB.
    createProject(db, 'proj-tx', 'TX Project', '/tmp/tx', '/tmp/tx', 'main');
    createSession(db, 'sess-tx', 'TX Chat');

    const msg = addMessage(db, 'msg-tx', 'sess-tx', 'user', 'hello', [
      { type: 'text', text: 'hello' },
      { type: 'text', text: 'world' },
      { type: 'text', text: 'foo' },
    ]);

    expect(msg.id).toBe('msg-tx');

    // All 3 parts must be in message_parts
    const parts = db
      .prepare('SELECT * FROM message_parts WHERE message_id = ? ORDER BY ordinal ASC')
      .all('msg-tx') as Array<{ ordinal: number; text: string | null }>;

    expect(parts).toHaveLength(3);
    expect(parts[0].text).toBe('hello');
    expect(parts[1].text).toBe('world');
    expect(parts[2].text).toBe('foo');
  });

  test('addMessage transaction safety: message with no parts has zero message_parts rows', () => {
    createProject(db, 'proj-tx2', 'TX Project 2', '/tmp/tx2', '/tmp/tx2', 'main');
    createSession(db, 'sess-tx2', 'TX Chat 2');

    const msg = addMessage(db, 'msg-tx2', 'sess-tx2', 'assistant', 'bare content');

    expect(msg.id).toBe('msg-tx2');

    const parts = db
      .prepare('SELECT * FROM message_parts WHERE message_id = ?')
      .all('msg-tx2');

    expect(parts).toHaveLength(0);
  });

  test('archived artifacts disappear from listings but old thread refs still render', () => {
    createProject(db, 'proj-archive', 'Project', '/tmp/archive', '/tmp/archive', 'main');
    createSession(db, 'sess-archive', 'Archive Chat');

    const artifact = createArtifact(db, {
      id: 'art-archive',
      kind: 'dashboard',
      schemaVersion: 1,
      title: 'Archive Me',
      projectId: 'proj-archive',
      workspaceId: null,
      sourceSessionId: 'sess-archive',
      sourceMessageId: null,
      status: 'active',
    });

    const revision = createArtifactRevision(db, {
      id: 'rev-archive',
      artifactId: artifact.id,
      revisionNumber: 1,
      specJson: JSON.stringify({ kind: 'dashboard', schemaVersion: 1, title: 'Archive Me', layout: { columns: 12, rowHeight: 32, gap: 8 }, widgets: [], dataSources: [] }),
      summary: 'archive test',
      prompt: 'archive prompt',
      model: 'claude-sonnet-4-6',
      sourceSessionId: 'sess-archive',
      sourceMessageId: null,
    });

    setArtifactCurrentRevision(db, artifact.id, revision.id);

    const assistantMessage = addMessage(db, 'msg-archive', 'sess-archive', 'assistant', 'Created dashboard "Archive Me".', [
      { type: 'text', text: 'Created dashboard "Archive Me".' },
      { type: 'artifact_ref', artifactId: artifact.id, artifactRevisionId: revision.id },
    ]);

    expect(assistantMessage.id).toBe('msg-archive');

    archiveArtifact(db, artifact.id);

    expect(listArtifactsByProject(db, 'proj-archive')).toHaveLength(0);
    expect(listArtifactsByProject(db, 'proj-archive', { includeArchived: true })).toHaveLength(1);

    const thread = getThreadMessages(db, 'sess-archive');
    expect(thread).toHaveLength(1);
    expect(thread[0].parts).toHaveLength(2);
    expect(thread[0].parts[1]).toMatchObject({
      type: 'artifact_ref',
      artifactId: artifact.id,
      artifactRevisionId: revision.id,
    });
  });
});
