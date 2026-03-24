import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import {
  createTrackerProject,
  listTrackerProjects,
  getTrackerProject,
  getTrackerProjectBySlug,
  getTrackerProjectWithDetails,
  updateTrackerProject,
  deleteTrackerProject,
  listTrackerStatuses,
  createTrackerStatus,
  updateTrackerStatus,
  deleteTrackerStatus,
  listTrackerLabels,
  createTrackerLabel,
  deleteTrackerLabel,
  createTrackerIssue,
  getTrackerIssue,
  getTrackerIssueByIdentifier,
  listTrackerIssues,
  updateTrackerIssue,
  moveTrackerIssue,
  deleteTrackerIssue,
  listTrackerComments,
  createTrackerComment,
} from '../db';

// ─── Validation Schemas ────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  defaultAssignee: z.string().max(255).optional(),
  projectId: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  defaultAssignee: z.string().max(255).nullable().optional(),
});

const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  statusId: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  assignee: z.string().max(255).optional(),
  dueDate: z.string().optional(),
  labels: z.array(z.string()).optional(),
  parentIssueId: z.string().optional(),
  workspaceId: z.string().optional(),
  sessionId: z.string().optional(),
});

const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(50000).nullable().optional(),
  statusId: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  assignee: z.string().max(255).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  labels: z.array(z.string()).optional(),
  parentIssueId: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

const moveIssueSchema = z.object({
  statusId: z.string(),
  sortOrder: z.number(),
});

const createStatusSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled']),
  color: z.string().max(20).optional(),
  sortOrder: z.number().int().optional(),
});

const updateStatusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(50000),
  author: z.string().max(255).optional(),
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function validationError(parsed: z.SafeParseError<unknown>) {
  const err = new Error('Invalid data');
  (err as any).status = 400;
  (err as any).code = 'VALIDATION_ERROR';
  (err as any).details = parsed.error.flatten();
  throw err;
}

function notFound(entity: string) {
  return { error: `${entity} not found`, code: 'NOT_FOUND' };
}

// ─── Router ────────────────────────────────────────────────────────────────────

export function createTrackerRouter(db: Database) {
  const router = new Hono();

  // ── Projects ───────────────────────────────────────────────────────────────

  // GET /projects — List all tracker projects
  router.get('/projects', async (c) => {
    const projects = listTrackerProjects(db);
    return c.json(projects);
  });

  // POST /projects — Create a new tracker project
  router.post('/projects', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    // Check slug uniqueness
    const existing = getTrackerProjectBySlug(db, parsed.data!.slug);
    if (existing) {
      const err = new Error('A project with this slug already exists');
      (err as any).status = 409;
      (err as any).code = 'CONFLICT';
      throw err;
    }

    const project = createTrackerProject(db, parsed.data!);
    const withDetails = getTrackerProjectWithDetails(db, project.id);
    return c.json(withDetails, 201);
  });

  // GET /projects/:id — Get project with statuses and labels
  router.get('/projects/:id', async (c) => {
    const id = c.req.param('id');
    const project = getTrackerProjectWithDetails(db, id);
    if (!project) return c.json(notFound('Project'), 404);
    return c.json(project);
  });

  // PATCH /projects/:id — Update project
  router.patch('/projects/:id', async (c) => {
    const id = c.req.param('id');
    if (!getTrackerProject(db, id)) return c.json(notFound('Project'), 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    updateTrackerProject(db, id, parsed.data!);
    const updated = getTrackerProjectWithDetails(db, id);
    return c.json(updated);
  });

  // DELETE /projects/:id — Delete project
  router.delete('/projects/:id', async (c) => {
    const id = c.req.param('id');
    if (!getTrackerProject(db, id)) return c.json(notFound('Project'), 404);
    deleteTrackerProject(db, id);
    return c.json({ ok: true });
  });

  // ── Issues ─────────────────────────────────────────────────────────────────

  // GET /projects/:projectId/issues — List issues with optional filters
  router.get('/projects/:projectId/issues', async (c) => {
    const projectId = c.req.param('projectId');
    if (!getTrackerProject(db, projectId)) return c.json(notFound('Project'), 404);

    const filters: Record<string, string | undefined> = {
      statusId: c.req.query('statusId'),
      priority: c.req.query('priority'),
      assignee: c.req.query('assignee'),
      search: c.req.query('search'),
      category: c.req.query('category'),
    };

    const issues = listTrackerIssues(db, projectId, filters);
    return c.json(issues);
  });

  // POST /projects/:projectId/issues — Create issue
  router.post('/projects/:projectId/issues', async (c) => {
    const projectId = c.req.param('projectId');
    const project = getTrackerProject(db, projectId);
    if (!project) return c.json(notFound('Project'), 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = createIssueSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    // If no statusId provided, use the first "todo" status
    let statusId = parsed.data!.statusId;
    if (!statusId) {
      const statuses = listTrackerStatuses(db, projectId);
      const todoStatus = statuses.find((s) => s.category === 'todo');
      statusId = todoStatus?.id ?? statuses[0]?.id;
      if (!statusId) {
        const err = new Error('No statuses defined for this project');
        (err as any).status = 400;
        (err as any).code = 'NO_STATUSES';
        throw err;
      }
    }

    const issue = createTrackerIssue(db, {
      ...parsed.data!,
      trackerProjectId: projectId,
      statusId,
    });
    return c.json(issue, 201);
  });

  // GET /issues/:id — Get issue detail
  router.get('/issues/:id', async (c) => {
    const id = c.req.param('id');
    // Try by ID first, then by identifier
    let issue = getTrackerIssue(db, id);
    if (!issue) issue = getTrackerIssueByIdentifier(db, id);
    if (!issue) return c.json(notFound('Issue'), 404);
    return c.json(issue);
  });

  // PATCH /issues/:id — Update issue
  router.patch('/issues/:id', async (c) => {
    const id = c.req.param('id');
    let issue = getTrackerIssue(db, id);
    if (!issue) issue = getTrackerIssueByIdentifier(db, id);
    if (!issue) return c.json(notFound('Issue'), 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = updateIssueSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    updateTrackerIssue(db, issue.id, parsed.data!);
    const updated = getTrackerIssue(db, issue.id);
    return c.json(updated);
  });

  // PATCH /issues/:id/move — Move issue (drag-drop)
  router.patch('/issues/:id/move', async (c) => {
    const id = c.req.param('id');
    let issue = getTrackerIssue(db, id);
    if (!issue) issue = getTrackerIssueByIdentifier(db, id);
    if (!issue) return c.json(notFound('Issue'), 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = moveIssueSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    moveTrackerIssue(db, issue.id, parsed.data!.statusId, parsed.data!.sortOrder);
    const updated = getTrackerIssue(db, issue.id);
    return c.json(updated);
  });

  // DELETE /issues/:id — Delete issue
  router.delete('/issues/:id', async (c) => {
    const id = c.req.param('id');
    let issue = getTrackerIssue(db, id);
    if (!issue) issue = getTrackerIssueByIdentifier(db, id);
    if (!issue) return c.json(notFound('Issue'), 404);
    deleteTrackerIssue(db, issue.id);
    return c.json({ ok: true });
  });

  // ── Statuses ───────────────────────────────────────────────────────────────

  // GET /projects/:projectId/statuses — List statuses
  router.get('/projects/:projectId/statuses', async (c) => {
    const projectId = c.req.param('projectId');
    if (!getTrackerProject(db, projectId)) return c.json(notFound('Project'), 404);
    const statuses = listTrackerStatuses(db, projectId);
    return c.json(statuses);
  });

  // POST /projects/:projectId/statuses — Create status
  router.post('/projects/:projectId/statuses', async (c) => {
    const projectId = c.req.param('projectId');
    if (!getTrackerProject(db, projectId)) return c.json(notFound('Project'), 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = createStatusSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    const status = createTrackerStatus(db, {
      ...parsed.data!,
      trackerProjectId: projectId,
    });
    return c.json(status, 201);
  });

  // PATCH /statuses/:id — Update status
  router.patch('/statuses/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    updateTrackerStatus(db, id, parsed.data!);
    return c.json({ ok: true });
  });

  // DELETE /statuses/:id — Delete status
  router.delete('/statuses/:id', async (c) => {
    const id = c.req.param('id');
    // Check if any issues use this status
    const count = db
      .prepare('SELECT COUNT(*) as count FROM tracker_issues WHERE status_id = ?')
      .get(id) as { count: number } | null;
    if (count && count.count > 0) {
      const err = new Error(
        `Cannot delete status: ${count.count} issue(s) still use it. Reassign them first.`
      );
      (err as any).status = 400;
      (err as any).code = 'STATUS_IN_USE';
      throw err;
    }
    deleteTrackerStatus(db, id);
    return c.json({ ok: true });
  });

  // ── Labels ─────────────────────────────────────────────────────────────────

  // GET /projects/:projectId/labels — List labels
  router.get('/projects/:projectId/labels', async (c) => {
    const projectId = c.req.param('projectId');
    if (!getTrackerProject(db, projectId)) return c.json(notFound('Project'), 404);
    const labels = listTrackerLabels(db, projectId);
    return c.json(labels);
  });

  // POST /projects/:projectId/labels — Create label
  router.post('/projects/:projectId/labels', async (c) => {
    const projectId = c.req.param('projectId');
    if (!getTrackerProject(db, projectId)) return c.json(notFound('Project'), 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = createLabelSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    const label = createTrackerLabel(db, {
      ...parsed.data!,
      trackerProjectId: projectId,
    });
    return c.json(label, 201);
  });

  // DELETE /labels/:id — Delete label
  router.delete('/labels/:id', async (c) => {
    const id = c.req.param('id');
    deleteTrackerLabel(db, id);
    return c.json({ ok: true });
  });

  // ── Comments ───────────────────────────────────────────────────────────────

  // GET /issues/:issueId/comments — List comments
  router.get('/issues/:issueId/comments', async (c) => {
    const issueId = c.req.param('issueId');
    const comments = listTrackerComments(db, issueId);
    return c.json(comments);
  });

  // POST /issues/:issueId/comments — Add comment
  router.post('/issues/:issueId/comments', async (c) => {
    const issueId = c.req.param('issueId');
    let issue = getTrackerIssue(db, issueId);
    if (!issue) issue = getTrackerIssueByIdentifier(db, issueId);
    if (!issue) return c.json(notFound('Issue'), 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    const comment = createTrackerComment(db, {
      issueId: issue.id,
      content: parsed.data!.content,
      author: parsed.data!.author ?? 'user',
    });
    return c.json(comment, 201);
  });

  // ── Cross-project queries ──────────────────────────────────────────────────

  // GET /issues — List all issues across projects (holistic view)
  router.get('/issues', async (c) => {
    const filters: Record<string, string | undefined> = {
      priority: c.req.query('priority'),
      assignee: c.req.query('assignee'),
      search: c.req.query('search'),
      category: c.req.query('category'),
    };

    // Query all projects' issues
    const projects = listTrackerProjects(db);
    const allIssues = projects.flatMap((p) => listTrackerIssues(db, p.id, filters));
    return c.json(allIssues);
  });

  return router;
}
