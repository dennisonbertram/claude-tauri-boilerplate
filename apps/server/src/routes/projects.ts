import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import { getProject, updateProject } from '../db';
import {
  addProject,
  listProjectsWithHealth,
  getProjectHealth,
  removeProject,
} from '../services/project';
import { loadWorkspaceConfig } from '../services/workspace-config';

const addProjectSchema = z.object({
  repoPath: z.string().min(1, 'repoPath is required'),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  defaultBranch: z.string().min(1).max(255).optional(),
  setupCommand: z.string().max(2000).optional(),
});

export function createProjectRouter(db: Database) {
  const router = new Hono();

  // GET / — List all projects with health + workspace counts
  router.get('/', async (c) => {
    const projects = await listProjectsWithHealth(db);
    return c.json(projects);
  });

  // POST / — Add a project
  router.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));

    const parsed = addProjectSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error('Invalid project data');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = parsed.error.flatten();
      throw err;
    }

    const project = await addProject(db, parsed.data.repoPath);
    return c.json(project, 201);
  });

  // GET /:id — Get single project details
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const project = getProject(db, id);
    if (!project) {
      return c.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        404
      );
    }

    const health = await getProjectHealth(project);

    const row = db
      .prepare(`SELECT COUNT(*) as count FROM workspaces WHERE project_id = ?`)
      .get(id) as { count: number };

    const repoConfig = await loadWorkspaceConfig(project.repoPathCanonical).catch(() => null);

    return c.json({
      ...project,
      health,
      workspaceCount: row.count,
      repoConfig: repoConfig ?? undefined,
    });
  });

  // PATCH /:id — Update project settings
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const project = getProject(db, id);
    if (!project) {
      return c.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        404
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error('Invalid update data');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = parsed.error.flatten();
      throw err;
    }

    updateProject(db, id, parsed.data);

    const updated = getProject(db, id);
    return c.json(updated);
  });

  // DELETE /:id — Delete project
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const project = getProject(db, id);
    if (!project) {
      return c.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        404
      );
    }

    await removeProject(db, id);
    return c.json({ ok: true });
  });

  return router;
}
