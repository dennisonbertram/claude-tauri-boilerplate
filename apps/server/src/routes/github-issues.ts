import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { getProject } from '../db';

export interface GithubIssue {
  number: number;
  title: string;
  url: string;
  state: string;
  body?: string;
}

export interface GithubBranch {
  name: string;
  isCurrent: boolean;
}

/**
 * Parse the output of `gh issue list --json` into GithubIssue objects.
 * Returns an empty array on parse failure.
 */
export function parseGhIssueOutput(raw: string): GithubIssue[] {
  try {
    const parsed = JSON.parse(raw.trim());
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        number: typeof item.number === 'number' ? item.number : 0,
        title: typeof item.title === 'string' ? item.title : '',
        url: typeof item.url === 'string' ? item.url : '',
        state: typeof item.state === 'string' ? item.state : '',
        body: typeof item.body === 'string' ? item.body : undefined,
      }))
      .filter((issue) => issue.number > 0 && issue.title);
  } catch {
    return [];
  }
}

/**
 * Parse the output of `git branch -r` or `git branch -a` into branch names.
 */
export function parseGitBranchOutput(raw: string): GithubBranch[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('->'))
    .map((line) => {
      const isCurrent = line.startsWith('* ');
      const name = line.replace(/^\*\s+/, '').replace(/^origin\//, '').trim();
      return { name, isCurrent };
    })
    .filter((b) => b.name && !b.name.startsWith('HEAD'));
}

export function createGithubIssuesRouter(db: Database) {
  const router = new Hono();

  /**
   * GET /api/projects/:projectId/github-issues?q={query}
   * Search GitHub issues for a project's repo using the `gh` CLI.
   */
  router.get('/:projectId/github-issues', async (c) => {
    const projectId = c.req.param('projectId');
    const query = c.req.query('q') ?? '';

    const project = getProject(db, projectId);
    if (!project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    const args = [
      'issue', 'list',
      '--json', 'number,title,url,state,body',
      '--limit', '20',
      '--state', 'open',
    ];

    if (query.trim()) {
      args.push('--search', query.trim());
    }

    try {
      const result = Bun.spawnSync(['gh', ...args], {
        cwd: project.repoPathCanonical,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      if (result.exitCode !== 0) {
        const stderr = result.stderr.toString().trim();
        // gh not authenticated or repo has no GitHub remote
        if (stderr.includes('authentication') || stderr.includes('not logged') || stderr.includes('no such') || stderr.includes('Could not resolve')) {
          return c.json({ error: 'GitHub CLI not authenticated or no remote', code: 'GH_ERROR' }, 503);
        }
        return c.json({ error: 'Failed to fetch GitHub issues', code: 'GH_ERROR', detail: stderr.slice(0, 200) }, 502);
      }

      const issues = parseGhIssueOutput(result.stdout.toString());
      return c.json(issues);
    } catch {
      return c.json({ error: 'GitHub CLI not available', code: 'GH_UNAVAILABLE' }, 503);
    }
  });

  /**
   * GET /api/projects/:projectId/branches
   * List branches for a project's git repo.
   */
  router.get('/:projectId/branches', async (c) => {
    const projectId = c.req.param('projectId');

    const project = getProject(db, projectId);
    if (!project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    try {
      // Get all branches (local + remote) deduplicated
      const localResult = Bun.spawnSync(['git', 'branch', '--format=%(refname:short)'], {
        cwd: project.repoPathCanonical,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const remoteResult = Bun.spawnSync(['git', 'branch', '-r', '--format=%(refname:short)'], {
        cwd: project.repoPathCanonical,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      if (localResult.exitCode !== 0) {
        return c.json({ error: 'Failed to list branches', code: 'GIT_ERROR' }, 502);
      }

      const localBranches = localResult.stdout.toString().split('\n')
        .map((b) => b.trim())
        .filter(Boolean);

      const remoteBranches = remoteResult.exitCode === 0
        ? remoteResult.stdout.toString().split('\n')
            .map((b) => b.trim().replace(/^origin\//, ''))
            .filter((b) => b && !b.startsWith('HEAD'))
        : [];

      // Deduplicate: local takes precedence
      const seen = new Set<string>();
      const branches: GithubBranch[] = [];

      for (const name of localBranches) {
        if (!seen.has(name)) {
          seen.add(name);
          branches.push({ name, isCurrent: false });
        }
      }

      for (const name of remoteBranches) {
        if (!seen.has(name)) {
          seen.add(name);
          branches.push({ name, isCurrent: false });
        }
      }

      return c.json(branches);
    } catch {
      return c.json({ error: 'Git not available', code: 'GIT_UNAVAILABLE' }, 503);
    }
  });

  /**
   * POST /api/projects/:projectId/github-issues
   * Create a GitHub issue for a project's repo using the `gh` CLI.
   */
  router.post('/:projectId/github-issues', async (c) => {
    const projectId = c.req.param('projectId');

    const project = getProject(db, projectId);
    if (!project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    let body: { title?: string; body?: string; labels?: string[] };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON in request body', code: 'VALIDATION_ERROR' }, 400);
    }

    const { title, body: issueBody, labels } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return c.json({ error: 'Missing or empty title', code: 'VALIDATION_ERROR' }, 400);
    }
    if (!issueBody || typeof issueBody !== 'string') {
      return c.json({ error: 'Missing or empty body', code: 'VALIDATION_ERROR' }, 400);
    }

    const args: string[] = [
      'issue', 'create',
      '--title', title.trim(),
      '--body', issueBody,
    ];

    if (labels && Array.isArray(labels)) {
      for (const label of labels) {
        if (typeof label === 'string' && label.trim()) {
          args.push('--label', label.trim());
        }
      }
    }

    try {
      const result = Bun.spawnSync(['gh', ...args], {
        cwd: project.repoPathCanonical,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      if (result.exitCode !== 0) {
        const stderr = result.stderr.toString().trim();
        if (stderr.includes('authentication') || stderr.includes('not logged') || stderr.includes('Could not resolve')) {
          return c.json({ error: 'GitHub CLI not authenticated or no remote', code: 'GH_ERROR' }, 503);
        }
        return c.json({ error: 'Failed to create GitHub issue', code: 'GH_ERROR', detail: stderr.slice(0, 200) }, 502);
      }

      const output = result.stdout.toString().trim();
      // gh issue create outputs the issue URL, e.g. https://github.com/owner/repo/issues/42
      const urlMatch = output.match(/(https:\/\/github\.com\/[^\s]+\/issues\/(\d+))/);
      const url = urlMatch?.[1] ?? output;
      const number = urlMatch?.[2] ? parseInt(urlMatch[2], 10) : 0;

      return c.json({ url, number });
    } catch {
      return c.json({ error: 'GitHub CLI not available', code: 'GH_UNAVAILABLE' }, 503);
    }
  });

  return router;
}
