import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { ChatRequest, StreamEvent } from '@claude-tauri/shared';

// Mock the claude-agent-sdk before importing anything that uses it
const mockQuery = mock(() => {
  return (async function* () {
    yield {
      type: 'system',
      subtype: 'init',
      session_id: 'test-ws-session',
      model: 'claude-opus-4-6',
      tools: [],
      mcp_servers: [],
      claude_code_version: '2.1.39',
      cwd: '/project',
      permissionMode: 'bypassPermissions',
      apiKeySource: 'env',
      slash_commands: [],
      output_style: 'text',
      skills: [],
      plugins: [],
    };
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello from workspace' },
        index: 0,
      },
      parent_tool_use_id: null,
      uuid: 'uuid-1',
      session_id: 'test-ws-session',
    };
  })();
});

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Import AFTER mocking
const { streamClaude } = await import('../services/claude');
const { createChatRouter } = await import('./chat');
const {
  createDb,
  createSession,
  createProject,
  createWorkspace,
  getWorkspace,
  getSession,
  updateWorkspaceStatus,
} = await import('../db');
const { Hono } = await import('hono');

// Helper: collect SSE events from a streaming response
async function collectSSEEvents(response: Response): Promise<string[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
}

// Helper: parse SSE data lines as JSON
function parseSSEData(lines: string[]): unknown[] {
  return lines.filter((l) => l !== '[DONE]').map((l) => JSON.parse(l));
}

function setupStandardMock(sessionId: string, text: string) {
  mockQuery.mockImplementation(() =>
    (async function* () {
      yield {
        type: 'system',
        subtype: 'init',
        session_id: sessionId,
        model: 'claude-opus-4-6',
        tools: [],
        mcp_servers: [],
        claude_code_version: '2.1.39',
        cwd: '/project',
        permissionMode: 'bypassPermissions',
        apiKeySource: 'env',
        slash_commands: [],
        output_style: 'text',
        skills: [],
        plugins: [],
      };
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text },
          index: 0,
        },
        parent_tool_use_id: null,
        uuid: 'uuid-1',
        session_id: sessionId,
      };
    })()
  );
}

// Helper to create a project + workspace in the DB for testing
function createTestWorkspace(
  db: Database,
  opts?: {
    status?: string;
    linearIssue?: {
      id: string;
      title: string;
      summary?: string;
      url?: string;
    };
  }
) {
  const projectId = `proj-${crypto.randomUUID().slice(0, 8)}`;
  createProject(db, projectId, 'Test Project', '/tmp/repo', '/tmp/repo', 'main');

  const workspaceId = `ws-${crypto.randomUUID().slice(0, 8)}`;
  createWorkspace(
    db,
    workspaceId,
    projectId,
    'test-workspace',
    'workspace/test',
    '/tmp/worktrees/test',
    '/tmp/worktrees/test',
    'main',
    opts?.linearIssue
  );

  // Default status is 'creating', transition to 'ready' unless overridden
  const targetStatus = opts?.status ?? 'ready';
  if (targetStatus !== 'creating') {
    updateWorkspaceStatus(db, workspaceId, targetStatus as any);
  }

  return { projectId, workspaceId };
}

describe('Chat Route - Workspace Integration', () => {
  let testApp: InstanceType<typeof Hono>;
  let db: Database;

  beforeEach(() => {
    mockQuery.mockReset();
    db = createDb(':memory:');
    const chatRouter = createChatRouter(db);
    testApp = new Hono();
    testApp.route('/api/chat', chatRouter);
  });

  afterEach(() => {
    db.close();
  });

  test('returns 404 when workspaceId does not exist', async () => {
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId: 'nonexistent-workspace',
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Workspace not found');
  });

  test('returns 400 when workspace is in error state', async () => {
    const { workspaceId } = createTestWorkspace(db, { status: 'error' });

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("'error'");
  });

  test('returns 400 when workspace is in merged state', async () => {
    // Create workspace in ready state first, then transition to merging, then merged
    const { workspaceId } = createTestWorkspace(db, { status: 'ready' });
    updateWorkspaceStatus(db, workspaceId, 'merging');
    updateWorkspaceStatus(db, workspaceId, 'merged');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("'merged'");
  });

  test('returns 400 when workspace is in archived state', async () => {
    const { workspaceId } = createTestWorkspace(db, { status: 'ready' });
    updateWorkspaceStatus(db, workspaceId, 'discarding');
    updateWorkspaceStatus(db, workspaceId, 'archived');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("'archived'");
  });

  test('passes cwd to streamClaude when workspaceId is provided', async () => {
    setupStandardMock('ws-claude-session', 'Workspace reply');
    const { workspaceId } = createTestWorkspace(db);

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Do something in the workspace' }],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Consume stream
    await res.text();

    expect(res.status).toBe(200);

    // Verify cwd was passed to the SDK query
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.cwd).toBe('/tmp/worktrees/test');
  });

  test('does not pass cwd when no workspaceId is provided', async () => {
    setupStandardMock('no-ws-session', 'Normal reply');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Normal chat' }],
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.cwd).toBeUndefined();
  });

  test('accepts workspace attachment references and adds them to the prompt', async () => {
    setupStandardMock('ws-attachment-session', 'Reply with attachments');
    const { workspaceId } = createTestWorkspace(db);

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Inspect these files' }],
      attachments: ['README.md', '@src/index.ts', 'notes/todo.txt'],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.prompt).toContain('Attached files:');
    expect(callArgs.prompt).toContain('@README.md');
    expect(callArgs.prompt).toContain('@src/index.ts');
    expect(callArgs.prompt).toContain('@notes/todo.txt');
  });

  test('rejects attachment references that escape workspace path', async () => {
    setupStandardMock('ws-escape-session', 'Should not be called');
    const { workspaceId } = createTestWorkspace(db);

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Inspect this file' }],
      attachments: ['../../secrets.txt'],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('INVALID_ATTACHMENT_REFERENCE');
  });

  test('saves claude session ID on workspace after streaming', async () => {
    setupStandardMock('ws-claude-id-123', 'Reply');
    const { workspaceId } = createTestWorkspace(db);

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // Check workspace has the claude session ID persisted
    const workspace = getWorkspace(db, workspaceId);
    expect(workspace?.claudeSessionId).toBe('ws-claude-id-123');
  });

  test('links created session to workspace via workspace_id', async () => {
    setupStandardMock('ws-link-session', 'Reply');
    const { workspaceId } = createTestWorkspace(db);

    const sessionId = crypto.randomUUID();
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Test' }],
      sessionId,
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    // The session should have workspace_id set
    const session = getSession(db, sessionId);
    expect(session).toBeDefined();
    expect(session?.workspaceId).toBe(workspaceId);
  });

  test('persists linear issue context from workspace on chat session', async () => {
    setupStandardMock('ws-issue-context', 'Issue context reply');
    const { workspaceId } = createTestWorkspace(db, {
      linearIssue: {
        id: 'ISS-900',
        title: 'Investigate race condition',
        summary: 'Race in scheduler',
        url: 'https://linear.app/org/issue/ISS-900',
      },
    });

    const sessionId = crypto.randomUUID();
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'What should I do?' }],
      sessionId,
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();
    expect(res.status).toBe(200);

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.prompt).toContain('[Linear Issue Context]');
    expect(callArgs.prompt).toContain('ISS-900');
    expect(callArgs.prompt).toContain('Investigate race condition');

    const session = getSession(db, sessionId);
    expect(session?.linearIssueId).toBe('ISS-900');
    expect(session?.linearIssueTitle).toBe('Investigate race condition');
    expect(session?.linearIssueSummary).toBe('Race in scheduler');
  });

  test('persists linear issue context from request body', async () => {
    setupStandardMock('ws-direct-linear', 'Direct linear reply');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Work on this issue' }],
      linearIssue: {
        id: 'ISS-901',
        title: 'Manual import refactor',
        summary: 'Simplify import surface',
        url: 'https://linear.app/org/issue/ISS-901',
      },
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();
    expect(res.status).toBe(200);
    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.prompt).toContain('[Linear Issue Context]');
    expect(callArgs.prompt).toContain('ISS-901');
    const latestSession = db.prepare("SELECT id FROM sessions ORDER BY created_at DESC LIMIT 1").get() as
      | { id: string }
      | undefined;
    const session = latestSession ? getSession(db, latestSession.id) : null;
    expect(latestSession).toBeDefined();
    expect(session?.linearIssueId).toBe('ISS-901');
  });

  test('uses workspace claudeSessionId for resume when no explicit session', async () => {
    setupStandardMock('ws-resume-session', 'Resumed reply');
    const { workspaceId } = createTestWorkspace(db);

    // Manually set a claude session ID on the workspace
    const { updateWorkspaceClaudeSession } = await import('../db');
    updateWorkspaceClaudeSession(db, workspaceId, 'previous-ws-claude-session');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Follow up' }],
      workspaceId,
      // No sessionId provided — should use workspace's claudeSessionId
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await res.text();

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.resume).toBe('previous-ws-claude-session');
  });

  test('allows chat with workspace in ready state', async () => {
    setupStandardMock('ws-ready-session', 'Ready reply');
    const { workspaceId } = createTestWorkspace(db, { status: 'ready' });

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  test('allows chat with workspace in active state', async () => {
    setupStandardMock('ws-active-session', 'Active reply');
    const { workspaceId } = createTestWorkspace(db, { status: 'ready' });
    updateWorkspaceStatus(db, workspaceId, 'active');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
  });

  test('existing chat without workspaceId still works (backwards compat)', async () => {
    setupStandardMock('compat-session', 'Normal reply');

    const session = createSession(db, 'compat-test-session', 'Test');

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      sessionId: session.id,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);

    await res.text();

    // cwd should not be set
    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.cwd).toBeUndefined();
  });
});

describe('Claude Service - cwd option', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('passes cwd to query options when provided', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'cwd-test',
          model: 'claude-opus-4-6',
          tools: [],
          mcp_servers: [],
          claude_code_version: '2.1.39',
          cwd: '/project',
          permissionMode: 'bypassPermissions',
          apiKeySource: 'env',
          slash_commands: [],
          output_style: 'text',
          skills: [],
          plugins: [],
        };
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({
      prompt: 'test',
      cwd: '/some/workspace/path',
    })) {
      events.push(event);
    }

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.cwd).toBe('/some/workspace/path');
  });

  test('does not set cwd when not provided', async () => {
    mockQuery.mockImplementation(() =>
      (async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'no-cwd-test',
          model: 'claude-opus-4-6',
          tools: [],
          mcp_servers: [],
          claude_code_version: '2.1.39',
          cwd: '/project',
          permissionMode: 'bypassPermissions',
          apiKeySource: 'env',
          slash_commands: [],
          output_style: 'text',
          skills: [],
          plugins: [],
        };
      })()
    );

    const events: StreamEvent[] = [];
    for await (const event of streamClaude({ prompt: 'test' })) {
      events.push(event);
    }

    const callArgs = mockQuery.mock.calls[0][0] as any;
    expect(callArgs.options.cwd).toBeUndefined();
  });
});
