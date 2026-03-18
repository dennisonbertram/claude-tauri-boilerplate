import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_WORKFLOW_PROMPTS,
  loadRepoWorkflowPrompts,
  saveRepoWorkflowPrompts,
  getWorkflowPrompt,
  buildBranchNameWorkflowMessage,
  buildPrWorkflowMessage,
  buildReviewWorkflowMessage,
} from './workflowPrompts';

describe('workflowPrompts', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getWorkflowPrompt', () => {
    it('returns defaults when custom prompts are missing', () => {
      const prompts = getWorkflowPrompt({}, 'review');
      expect(prompts).toBe(DEFAULT_WORKFLOW_PROMPTS.review);
    });

    it('returns the custom prompt when provided', () => {
      const custom = 'CUSTOM REVIEW PROMPT';
      const prompt = getWorkflowPrompt({ review: custom }, 'review');
      expect(prompt).toBe(custom);
    });
  });

  describe('message builders', () => {
    it('buildReviewWorkflowMessage includes prompt + file list + diff', () => {
      const msg = buildReviewWorkflowMessage({
        prompt: 'REVIEW IT',
        changedFiles: ['apps/server/src/app.ts', 'README.md'],
        diff: 'diff --git a/x b/x',
      });

      expect(msg).toContain('REVIEW IT');
      expect(msg).toContain('Changed files:');
      expect(msg).toContain('- apps/server/src/app.ts');
      expect(msg).toContain('- README.md');
      expect(msg).toContain('```diff');
      expect(msg).toContain('diff --git a/x b/x');
    });

    it('buildPrWorkflowMessage includes prompt + diff', () => {
      const msg = buildPrWorkflowMessage({
        prompt: 'WRITE A PR',
        diff: 'diff --git a/x b/x',
      });

      expect(msg).toContain('WRITE A PR');
      expect(msg).toContain('```diff');
    });

    it('buildBranchNameWorkflowMessage includes prompt + changed files', () => {
      const msg = buildBranchNameWorkflowMessage({
        prompt: 'NAME THE BRANCH',
        changedFiles: ['apps/desktop/src/App.tsx'],
      });

      expect(msg).toContain('NAME THE BRANCH');
      expect(msg).toContain('Changed files:');
      expect(msg).toContain('- apps/desktop/src/App.tsx');
      expect(msg).not.toContain('```diff');
    });
  });

  describe('repository prompt persistence', () => {
    it('loads repository workflow prompt overrides from memory files', async () => {
      globalThis.fetch = vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.endsWith('/workflow-review.md')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ content: 'Repo-specific review prompt' }),
          } as Response;
        }
        if (url.endsWith('/workflow-review-memory.md')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ content: 'Repo-specific review memory prompt' }),
          } as Response;
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        } as Response;
      }) as typeof fetch;

      const prompts = await loadRepoWorkflowPrompts();

      expect(prompts).toEqual({
        review: 'Repo-specific review prompt',
        reviewMemory: 'Repo-specific review memory prompt',
      });
    });

    it('creates or clears repository workflow prompt files as needed', async () => {
      const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';

        if (method === 'GET' && url.endsWith('/workflow-review.md')) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not found' }),
          } as Response;
        }

        if (method === 'GET' && url.endsWith('/workflow-pr.md')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ content: 'Old repo PR prompt' }),
          } as Response;
        }

        if (method === 'GET' && url.endsWith('/workflow-branch.md')) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not found' }),
          } as Response;
        }
        if (method === 'GET' && url.endsWith('/workflow-review-memory.md')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ content: 'Old review memory prompt' }),
          } as Response;
        }
        if (method === 'GET' && url.endsWith('/workflow-merge-memory.md')) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not found' }),
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      });

      globalThis.fetch = fetchMock as typeof fetch;

      await saveRepoWorkflowPrompts({
        review: 'Repo review prompt',
        pr: DEFAULT_WORKFLOW_PROMPTS.pr,
        branch: DEFAULT_WORKFLOW_PROMPTS.branch,
        reviewMemory: DEFAULT_WORKFLOW_PROMPTS.reviewMemory,
        mergeMemory: 'Repo merge memory prompt',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3131/api/memory',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'workflow-review.md',
            content: 'Repo review prompt',
          }),
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3131/api/memory/workflow-pr.md',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3131/api/memory/workflow-review-memory.md',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3131/api/memory',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'workflow-merge-memory.md',
            content: 'Repo merge memory prompt',
          }),
        })
      );
    });
  });
});
