import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb } from '../db';
import { errorHandler } from '../middleware/error-handler';

const mockStreamClaude = mock((options?: { prompt?: string; model?: string; effort?: string; permissionMode?: string }) => {
  const generated = `\`\`\`json
{
  "name": "Research Scout",
  "description": "A fast, detail-oriented agent for gathering context and summarizing findings.",
  "icon": "🔎",
  "color": "#0f766e",
  "systemPrompt": "You are a concise research assistant.",
  "useClaudeCodePrompt": true,
  "model": "claude-sonnet-4-20250514",
  "effort": "medium",
  "thinkingBudgetTokens": 8192,
  "allowedTools": ["Read", "Grep"],
  "disallowedTools": ["Write"],
  "permissionMode": "plan",
  "additionalDirectories": ["/tmp/research"],
  "settingSources": ["local"],
  "maxTurns": 6,
  "maxBudgetUsd": 3.5,
  "agentsJson": "[]"
}
\`\`\``;

  return (async function* () {
    yield { type: 'text:delta', text: generated, blockIndex: 0 };
  })();
});

mock.module('../services/claude', () => ({
  streamClaude: mockStreamClaude,
}));
const { createAgentProfilesRouter } = await import('./agent-profiles');

describe('POST /api/agent-profiles/generate', () => {
  let db: Database;
  let app: Hono;

  beforeEach(() => {
    db = createDb(':memory:');
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/agent-profiles', createAgentProfilesRouter(db));
    mockStreamClaude.mockClear();
  });

  afterEach(() => {
    db.close();
  });

  test('generates and creates a profile from a prompt', async () => {
    const res = await app.request('/api/agent-profiles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Create an agent that researches technical topics and summarizes findings.',
        model: 'claude-sonnet-4-20250514',
      }),
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Research Scout');
    expect(body.description).toBe(
      'A fast, detail-oriented agent for gathering context and summarizing findings.'
    );
    expect(body.icon).toBe('🔎');
    expect(body.color).toBe('#0f766e');
    expect(body.systemPrompt).toContain('research assistant');
    expect(body.useClaudeCodePrompt).toBe(true);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.effort).toBe('medium');
    expect(body.permissionMode).toBe('plan');
    expect(body.additionalDirectories).toEqual(['/tmp/research']);
    expect(body.agentsJson).toBe('[]');

    expect(mockStreamClaude).toHaveBeenCalledTimes(1);
    const call = mockStreamClaude.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.prompt).toContain('You are an agent profile generator');
    expect(call?.model).toBe('claude-sonnet-4-20250514');
    expect(call?.effort).toBe('low');
    expect(call?.permissionMode).toBe('dontAsk');
  });

  test('rejects an empty prompt', async () => {
    const res = await app.request('/api/agent-profiles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
