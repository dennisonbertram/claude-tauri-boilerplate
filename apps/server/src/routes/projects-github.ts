import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getProjectByPath, createProject } from '../db/index';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';

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

    // Determine clone destination
    const defaultPath = path.join(os.homedir(), 'Dev', repo);
    const clonePath = localPath ?? defaultPath;
    const cloneUrl = token
      ? `https://${token}@github.com/${owner}/${repo}.git`
      : `https://github.com/${owner}/${repo}.git`;

    // Check if path already exists as a project
    const canonicalPath = clonePath.toLowerCase();
    const existing = getProjectByPath(db, canonicalPath);
    if (existing) {
      return c.json({ error: 'A project at this path already exists', code: 'ALREADY_EXISTS', project: existing }, 409);
    }

    // Run git clone
    const result = Bun.spawnSync(['git', 'clone', cloneUrl, clonePath]);
    if (result.exitCode !== 0) {
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
