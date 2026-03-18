import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import { getWorkspace } from '../db';
import { worktreeService } from '../services/worktree';
import { streamClaude } from '../services/claude';
import type { WorkspaceStatus, CodeReviewResult, CodeReviewComment } from '@claude-tauri/shared';

const DEFAULT_CODE_REVIEW_PROMPT = [
  'You are a senior software engineer performing a thorough code review.',
  '',
  'Review the git diff below and provide structured feedback.',
  '',
  'Requirements:',
  '- Identify bugs, edge cases, and unsafe changes',
  '- Suggest concrete improvements with file/line references where possible',
  '- Call out missing tests and propose test cases',
  '- Assign each comment a severity: critical | warning | suggestion | info',
  '',
  'Output format (MUST be valid JSON, no markdown fences):',
  '{',
  '  "summary": "Brief overall assessment in 1-3 sentences.",',
  '  "comments": [',
  '    {',
  '      "file": "path/to/file.ts",',
  '      "line": 42,',
  '      "severity": "warning",',
  '      "body": "Explanation of the issue and suggested fix."',
  '    }',
  '  ]',
  '}',
  '',
  'Use line numbers that match the new file (+ lines in the diff).',
  'Omit "line" if the comment applies to the whole file.',
  'Output ONLY valid JSON. Do not include explanation outside the JSON object.',
].join('\n');

const codeReviewRequestSchema = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
});

function buildReviewPrompt(systemPrompt: string, diff: string): string {
  return [
    systemPrompt.trim(),
    '',
    'Diff to review:',
    '```diff',
    diff,
    '```',
  ].join('\n');
}

interface RawComment {
  file?: unknown;
  line?: unknown;
  severity?: unknown;
  body?: unknown;
}

function parseReviewResult(rawText: string): CodeReviewResult {
  // Strip markdown code fences if Claude wraps in them anyway
  let json = rawText.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  let parsed: { summary?: unknown; comments?: unknown };
  try {
    parsed = JSON.parse(json);
  } catch {
    // If parsing fails, return a fallback result with the raw text as summary
    return {
      summary: rawText.slice(0, 500),
      comments: [],
      reviewedAt: new Date().toISOString(),
    };
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Code review completed.';
  const rawComments = Array.isArray(parsed.comments) ? parsed.comments : [];

  const VALID_SEVERITIES = new Set(['critical', 'warning', 'suggestion', 'info']);

  const comments: CodeReviewComment[] = rawComments
    .filter((c): c is RawComment => c !== null && typeof c === 'object')
    .map((c, index) => {
      const severity = VALID_SEVERITIES.has(c.severity as string)
        ? (c.severity as CodeReviewComment['severity'])
        : 'info';

      const comment: CodeReviewComment = {
        id: `ai-review-${index + 1}`,
        file: typeof c.file === 'string' ? c.file : 'unknown',
        severity,
        body: typeof c.body === 'string' ? c.body : '',
        isAI: true,
      };

      if (typeof c.line === 'number' && Number.isInteger(c.line) && c.line > 0) {
        comment.line = c.line;
      }

      return comment;
    });

  return {
    summary,
    comments,
    reviewedAt: new Date().toISOString(),
  };
}

export function createCodeReviewRouter(db: Database) {
  const router = new Hono();

  // POST /api/workspaces/:id/code-review
  // Runs an AI code review on the current workspace diff and returns a CodeReviewResult.
  router.post('/:id/code-review', async (c) => {
    const id = c.req.param('id');

    // 1. Parse and validate request body
    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      bodyRaw = {};
    }
    const parsed = codeReviewRequestSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid code review request payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        },
        400
      );
    }
    const { prompt, model, effort } = parsed.data;

    // 2. Validate workspace exists
    const workspace = getWorkspace(db, id);
    if (!workspace) {
      return c.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, 404);
    }

    // 3. Validate workspace is in a usable state
    const usableStatuses: WorkspaceStatus[] = ['ready', 'active'];
    if (!usableStatuses.includes(workspace.status as WorkspaceStatus)) {
      return c.json(
        {
          error: `Workspace is in '${workspace.status}' state and cannot be reviewed`,
          code: 'INVALID_STATE',
        },
        400
      );
    }

    // 4. Get the workspace diff
    const diff = await worktreeService.getWorktreeDiff(
      workspace.worktreePath,
      workspace.baseBranch
    );

    // 5. Require a non-empty diff
    if (!diff || diff.trim().length === 0) {
      return c.json(
        {
          error: 'Workspace has no diff to review',
          code: 'NO_DIFF',
        },
        400
      );
    }

    // 6. Build the review prompt
    const systemPrompt = prompt?.trim() || DEFAULT_CODE_REVIEW_PROMPT;
    const reviewPrompt = buildReviewPrompt(systemPrompt, diff);

    // 7. Stream Claude response and collect full text
    let fullResponse = '';
    try {
      for await (const event of streamClaude({
        prompt: reviewPrompt,
        model: model ?? 'claude-haiku-4-5-20251001',
        effort: effort ?? 'low',
        permissionMode: 'dontAsk',
      })) {
        if (event.type === 'text:delta') {
          fullResponse += event.text;
        }
        if (event.type === 'error') {
          return c.json(
            { error: event.message, code: 'REVIEW_ERROR' },
            500
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI review failed';
      return c.json({ error: message, code: 'REVIEW_ERROR' }, 500);
    }

    // 8. Parse response into structured result
    const result = parseReviewResult(fullResponse);

    return c.json(result);
  });

  return router;
}
