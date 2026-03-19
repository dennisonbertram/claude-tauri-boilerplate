import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const tempPaths = new Set<string>();

function createTestWorkspace(
  db: Database,
  opts?: {
    status?: string;
    workspacePath?: string;
    projectPath?: string;
    linearIssue?: {
      id: string;
      title: string;
      summary?: string;
      url?: string;
    };
  }
) {
  const workspacePath = opts?.workspacePath ?? '/tmp/worktrees/test';
  const projectPath = opts?.projectPath ?? '/tmp/repo';

  if (opts?.workspacePath) {
    tempPaths.add(workspacePath);
    mkdirSync(workspacePath, { recursive: true });
  }

  if (opts?.projectPath) {
    tempPaths.add(projectPath);
    mkdirSync(projectPath, { recursive: true });
  }

  const projectId = `proj-${crypto.randomUUID().slice(0, 8)}`;
  createProject(db, projectId, 'Test Project', projectPath, projectPath, 'main');

  const workspaceId = `ws-${crypto.randomUUID().slice(0, 8)}`;
  createWorkspace(
    db,
    workspaceId,
    projectId,
    'test-workspace',
    'workspace/test',
    workspacePath,
    workspacePath,
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

function cleanupTempPaths() {
  for (const path of tempPaths) {
    rmSync(path, { recursive: true, force: true });
  }
  tempPaths.clear();
}

type InstructionEnvSnapshot = {
  home: string | undefined;
  globalInstructionPath: string | undefined;
  userInstructionPath: string | undefined;
};

const realInstructionEnv: InstructionEnvSnapshot = {
  home: process.env.HOME,
  globalInstructionPath: process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH,
  userInstructionPath: process.env.CLAUDE_USER_INSTRUCTION_PATH,
};

const instructionEnvTempDirs = new Set<string>();

function setBlankInstructionEnv() {
  const tempHome = mkdtempSync(join(tmpdir(), 'chat-workspace-home-'));
  instructionEnvTempDirs.add(tempHome);
  process.env.HOME = tempHome;
  process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH = join(tempHome, 'global-claude.md');
  process.env.CLAUDE_USER_INSTRUCTION_PATH = join(tempHome, 'user-claude.md');
}

function restoreInstructionEnv() {
  if (realInstructionEnv.home === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = realInstructionEnv.home;
  }
  if (realInstructionEnv.globalInstructionPath === undefined) {
    delete process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH;
  } else {
    process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH = realInstructionEnv.globalInstructionPath;
  }
  if (realInstructionEnv.userInstructionPath === undefined) {
    delete process.env.CLAUDE_USER_INSTRUCTION_PATH;
  } else {
    process.env.CLAUDE_USER_INSTRUCTION_PATH = realInstructionEnv.userInstructionPath;
  }

  for (const dir of instructionEnvTempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  instructionEnvTempDirs.clear();
}

describe('Chat Route - Workspace Integration', () => {
  let testApp: InstanceType<typeof Hono>;
  let db: Database;

  beforeEach(() => {
    mockQuery.mockReset();
    setBlankInstructionEnv();
    db = createDb(':memory:');
    const chatRouter = createChatRouter(db);
    testApp = new Hono();
    testApp.route('/api/chat', chatRouter);
  });

  afterEach(() => {
    cleanupTempPaths();
    restoreInstructionEnv();
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

  test('passes additional directories to streamClaude when workspace stores them', async () => {
    setupStandardMock('ws-claude-session-dirs', 'Workspace reply');
    const { workspaceId } = createTestWorkspace(db);
    const { updateWorkspace } = await import('../db');
    updateWorkspace(db, workspaceId, {
      additionalDirectories: ['/repo-a', '/repo-b'],
    });

    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'Work across repos' }],
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
    expect(callArgs.options.additionalDirectories).toEqual(['/repo-a', '/repo-b']);
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

  test('injects global/user/workspace CLAUDE.md instructions in priority order', async () => {
    setupStandardMock('ws-repo-instructions-session', 'Reply');

    const originalHome = process.env.HOME;
    const originalGlobalPath = process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH;
    const originalUserPath = process.env.CLAUDE_USER_INSTRUCTION_PATH;

    const tempHome = mkdtempSync(join(tmpdir(), 'chat-home-'));
    const homeClaudeDir = join(tempHome, '.claude');
    const userFile = join(homeClaudeDir, 'CLAUDE.md');
    mkdirSync(homeClaudeDir, { recursive: true });
    writeFileSync(userFile, 'User profile: concise answers');
    tempPaths.add(tempHome);

    const globalDir = mkdtempSync(join(tmpdir(), 'chat-global-'));
    const globalFile = join(globalDir, 'CLAUDE.md');
    writeFileSync(globalFile, 'Global guardrails');
    tempPaths.add(globalDir);

    const workspacePath = mkdtempSync(join(tmpdir(), 'chat-workspace-'));
    const managedDir = join(workspacePath, '.claude');
    const managedFile = join(managedDir, 'CLAUDE.md');
    const projectFile = join(workspacePath, 'CLAUDE.md');
    mkdirSync(managedDir, { recursive: true });
    writeFileSync(managedFile, 'Repo managed instructions (should be overridden)');
    writeFileSync(projectFile, 'Repo root instructions');
    tempPaths.add(workspacePath);

    try {
      process.env.HOME = tempHome;
      process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH = globalFile;
      process.env.CLAUDE_USER_INSTRUCTION_PATH = userFile;

      const { workspaceId } = createTestWorkspace(db, {
        workspacePath,
        projectPath: workspacePath,
      });

      const body: ChatRequest = {
        messages: [{ role: 'user', content: 'Summarize repository setup' }],
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
      const prompt = callArgs.prompt as string;

      expect(prompt).toContain('[Global Instruction]');
      expect(prompt).toContain('Global guardrails');
      expect(prompt).toContain('[User Instruction]');
      expect(prompt).toContain('User profile: concise answers');
      expect(prompt).toContain('[Workspace Instruction]');
      expect(prompt).toContain('Repo root instructions');
      expect(prompt).not.toContain('[Workspace managed Instruction]');
      expect(prompt).not.toContain('Repo managed instructions (should be overridden)');
      expect(prompt.indexOf('[Global Instruction]')).toBeLessThan(prompt.indexOf('[User Instruction]'));
      expect(prompt.indexOf('[User Instruction]')).toBeLessThan(
        prompt.indexOf('[Workspace Instruction]')
      );
      expect(prompt.indexOf('[Workspace Instruction]')).toBeLessThan(
        prompt.indexOf('Summarize repository setup')
      );
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
      if (originalGlobalPath === undefined) {
        delete process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH;
      } else {
        process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH = originalGlobalPath;
      }
      if (originalUserPath === undefined) {
        delete process.env.CLAUDE_USER_INSTRUCTION_PATH;
      } else {
        process.env.CLAUDE_USER_INSTRUCTION_PATH = originalUserPath;
      }
    }
  });

  test('injects system prompt after instructions and before the user prompt', async () => {
    setupStandardMock('ws-system-startup-session', 'Reply');

    const originalHome = process.env.HOME;
    const originalGlobalPath = process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH;
    const originalUserPath = process.env.CLAUDE_USER_INSTRUCTION_PATH;

    const tempHome = mkdtempSync(join(tmpdir(), 'chat-home-system-'));
    tempPaths.add(tempHome);
    process.env.HOME = tempHome;

    const globalDir = mkdtempSync(join(tmpdir(), 'chat-global-system-'));
    const globalFile = join(globalDir, 'CLAUDE.md');
    writeFileSync(globalFile, 'Global policy');
    tempPaths.add(globalDir);

    const workspacePath = mkdtempSync(join(tmpdir(), 'chat-workspace-system-'));
    writeFileSync(join(workspacePath, 'CLAUDE.md'), 'Repo startup policy');
    tempPaths.add(workspacePath);

    try {
      process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH = globalFile;
      delete process.env.CLAUDE_USER_INSTRUCTION_PATH;

      const { workspaceId } = createTestWorkspace(db, {
        workspacePath,
        projectPath: workspacePath,
      });

      const body: ChatRequest = {
        messages: [{ role: 'user', content: 'Ship this patch' }],
        workspaceId,
        systemPrompt: 'You are a strict release reviewer.',
      };

      const res = await testApp.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      await res.text();

      expect(res.status).toBe(200);
      const callArgs = mockQuery.mock.calls[0][0] as any;
      const prompt = callArgs.prompt as string;

      expect(prompt).toContain('[Global Instruction]');
      expect(prompt).toContain('[Workspace Instruction]');
      expect(prompt).toContain('[System Prompt]');
      expect(prompt).toContain('You are a strict release reviewer.');
      expect(prompt.indexOf('[Workspace Instruction]')).toBeLessThan(prompt.indexOf('[System Prompt]'));
      expect(prompt.indexOf('[System Prompt]')).toBeLessThan(prompt.indexOf('Ship this patch'));
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
      if (originalGlobalPath === undefined) {
        delete process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH;
      } else {
        process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH = originalGlobalPath;
      }
      if (originalUserPath === undefined) {
        delete process.env.CLAUDE_USER_INSTRUCTION_PATH;
      } else {
        process.env.CLAUDE_USER_INSTRUCTION_PATH = originalUserPath;
      }
    }
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

  test('lets explicit request linearIssue override workspace-linked issue context', async () => {
    setupStandardMock('ws-issue-override', 'Issue override reply');
    const { workspaceId } = createTestWorkspace(db, {
      linearIssue: {
        id: 'ISS-900',
        title: 'Workspace issue',
      },
    });

    const sessionId = crypto.randomUUID();
    const body: ChatRequest = {
      messages: [{ role: 'user', content: 'What should I do?' }],
      sessionId,
      workspaceId,
      linearIssue: {
        id: 'ISS-902',
        title: 'Request override issue',
        summary: 'Use request issue in prompt',
        url: 'https://linear.app/org/issue/ISS-902',
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
    expect(callArgs.prompt).toContain('ISS-902');
    expect(callArgs.prompt).not.toContain('ISS-900');

    const session = getSession(db, sessionId);
    expect(session?.linearIssueId).toBe('ISS-902');
    expect(session?.linearIssueTitle).toBe('Request override issue');
    expect(session?.linearIssueSummary).toBe('Use request issue in prompt');
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

  // Regression test for: null sessionId from workspace with no existing session
  // Bug: frontend sends { sessionId: null } when workspace has no session yet,
  //      causing a Zod validation error because the schema only accepted string | undefined.
  test('accepts null sessionId with a valid workspaceId (does not return 400)', async () => {
    setupStandardMock('ws-null-session-id', 'Hello from workspace');
    const { workspaceId } = createTestWorkspace(db);

    const body = {
      messages: [{ role: 'user', content: 'Hello' }],
      sessionId: null,
      workspaceId,
    };

    const res = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Must not be a validation error (400)
    expect(res.status).not.toBe(400);
    // Should succeed with a stream response
    expect(res.status).toBe(200);
  });

  test('reuses existing workspace session instead of creating a new one when sessionId is null', async () => {
    setupStandardMock('ws-reuse-session', 'Hello again');
    const { workspaceId } = createTestWorkspace(db);

    // First message: creates a session linked to the workspace
    const firstBody = {
      messages: [{ role: 'user', content: 'First message' }],
      sessionId: null,
      workspaceId,
    };

    const firstRes = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firstBody),
    });
    await firstRes.text(); // consume stream
    expect(firstRes.status).toBe(200);

    // Check a session was created and linked to the workspace
    const { getSessionForWorkspace: getWsSession } = await import('../db');
    const sessionAfterFirstMessage = getWsSession(db, workspaceId);
    expect(sessionAfterFirstMessage).not.toBeNull();
    const firstSessionId = sessionAfterFirstMessage!.id;

    // Second message: should reuse the same session, not create a new one
    setupStandardMock('ws-reuse-session-2', 'Second reply');
    const secondBody = {
      messages: [{ role: 'user', content: 'Second message' }],
      sessionId: null,
      workspaceId,
    };

    const secondRes = await testApp.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secondBody),
    });
    await secondRes.text(); // consume stream
    expect(secondRes.status).toBe(200);

    // Session linked to workspace should be the SAME session (not a new orphaned one)
    const sessionAfterSecondMessage = getWsSession(db, workspaceId);
    expect(sessionAfterSecondMessage).not.toBeNull();
    expect(sessionAfterSecondMessage!.id).toBe(firstSessionId);
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
