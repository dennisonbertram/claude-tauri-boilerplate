import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getProjectByPath, createProject } from '../db/index';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import { isValidGitHubName, isValidGitHubUrl, sanitizeClonePath } from '../utils/paths';

/** Default base directory for cloned repos */
function getCloneBaseDir(): string {
  return process.env.CLONE_BASE_DIR || path.join(os.homedir(), 'Dev');
}

export function createProjectsGithubRouter(db: Database) {
  const app = new Hono();

  // POST /api/projects/from-github
  app.post('/from-github', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !body.owner || !body.repo) {
      return c.json({ error: 'owner and repo are required', code: 'VALIDATION_ERROR' }, 400);
    }

    const { owner, repo, path: localPath, token } = body as {
      owner: string;
      repo: string;
      path?: string;
      token?: string;
    };

    // Validate owner and repo names
    if (!isValidGitHubName(owner)) {
      return c.json({ error: 'Invalid GitHub owner name', code: 'VALIDATION_ERROR' }, 400);
    }
    if (!isValidGitHubName(repo)) {
      return c.json({ error: 'Invalid GitHub repo name', code: 'VALIDATION_ERROR' }, 400);
    }

    // Build and validate the clone URL (never embed credentials)
    const cloneUrl = `https://github.com/${owner}/${repo}.git`;
    if (!isValidGitHubUrl(cloneUrl)) {
      return c.json({ error: 'Invalid GitHub URL', code: 'VALIDATION_ERROR' }, 400);
    }

    // Determine and validate clone destination
    const baseDir = getCloneBaseDir();
    let clonePath: string;
    try {
      clonePath = localPath
        ? sanitizeClonePath(baseDir, localPath)
        : path.join(baseDir, repo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid clone path';
      return c.json({ error: message, code: 'VALIDATION_ERROR' }, 400);
    }

    // Check if path already exists as a project
    const canonicalPath = clonePath.toLowerCase();
    const existing = getProjectByPath(db, canonicalPath);
    if (existing) {
      return c.json({ error: 'A project at this path already exists', code: 'ALREADY_EXISTS', project: existing }, 409);
    }

    // Build git clone command with secure credential passing.
    // Instead of embedding the token in the URL (visible in process lists,
    // logs, and git config), we use git's http.extraheader config to pass
    // an Authorization header.
    const cloneArgs = ['git'];
    if (token) {
      cloneArgs.push('-c', `http.extraheader=Authorization: bearer ${token}`);
    }
    cloneArgs.push('clone', cloneUrl, clonePath);

    const result = Bun.spawnSync(cloneArgs);
    if (result.exitCode !== 0) {
      // Scrub any token remnants from stderr just in case
      const stderr = new TextDecoder().decode(result.stderr).replace(token ?? '', '***');
      return c.json({ error: 'Failed to clone repository', code: 'GIT_ERROR', detail: stderr }, 502);
    }

    // Create project row
    const id = randomUUID();
    const project = createProject(db, id, repo, clonePath, clonePath.toLowerCase(), 'main');

    return c.json(project, 201);
  });

  return app;
}
