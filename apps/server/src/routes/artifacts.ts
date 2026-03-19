import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import {
  getArtifact,
  getProject,
  archiveArtifact,
  listArtifactsByProject,
  createArtifact,
  createArtifactRevision,
  setArtifactCurrentRevision,
  updateArtifactTitle,
  countArtifactRevisions,
} from '../db';
import { streamClaude } from '../services/claude';

// ─── Dashboard generation constants ───────────────────────────────────────────

const DASHBOARD_GENERATION_SYSTEM_PROMPT = `You are a dashboard specification generator.
Generate a JSON dashboard specification based on the user's request.

Output format (valid JSON only, no markdown fences):
{
  "kind": "dashboard",
  "schemaVersion": 1,
  "title": "Dashboard title",
  "layout": { "columns": 12, "rowHeight": 32, "gap": 8 },
  "widgets": [],
  "dataSources": []
}

Output ONLY valid JSON. No explanation outside the JSON object.`;

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const generateArtifactSchema = z.object({
  prompt: z.string().min(1),
  title: z.string().optional(),
  workspaceId: z.string().optional(),
  sessionId: z.string().optional(),
  model: z.string().optional(),
});

const regenerateArtifactSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
});

const renameArtifactSchema = z.object({
  title: z.string().min(1),
});

const dashboardSpecSchema = z.object({
  kind: z.literal('dashboard'),
  schemaVersion: z.number(),
  title: z.string(),
  layout: z.object({
    columns: z.number(),
    rowHeight: z.number(),
    gap: z.number(),
  }),
  widgets: z.array(z.unknown()),
  dataSources: z.array(z.unknown()),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripMarkdownFences(text: string): string {
  let json = text.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return json;
}

function parseDashboardSpec(rawText: string): { spec: unknown; parseError?: string } {
  const json = stripMarkdownFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { spec: { _raw: rawText, _parseError: 'Failed to parse JSON from Claude response' }, parseError: 'JSON parse failed' };
  }

  const result = dashboardSpecSchema.safeParse(parsed);
  if (!result.success) {
    // Return raw spec with parse error note rather than failing the request
    return {
      spec: { ...(parsed as object), _parseError: result.error.message },
      parseError: result.error.message,
    };
  }

  return { spec: result.data };
}

// ─── Flat artifact routes: /api/artifacts ─────────────────────────────────────

export function createArtifactsRouter(db: Database) {
  const router = new Hono();

  // GET /api/artifacts/:id — get artifact by id
  router.get('/:id', (c) => {
    const id = c.req.param('id');
    const artifact = getArtifact(db, id);
    if (!artifact) {
      return c.json({ error: 'Artifact not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json(artifact);
  });

  // PATCH /api/artifacts/:id/archive — archive an artifact
  router.patch('/:id/archive', (c) => {
    const id = c.req.param('id');
    const artifact = getArtifact(db, id);
    if (!artifact) {
      return c.json({ error: 'Artifact not found', code: 'NOT_FOUND' }, 404);
    }
    archiveArtifact(db, id);
    const updated = getArtifact(db, id)!;
    return c.json(updated);
  });

  // PATCH /api/artifacts/:id — rename an artifact
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');

    const artifact = getArtifact(db, id);
    if (!artifact) {
      return c.json({ error: 'Artifact not found', code: 'NOT_FOUND' }, 404);
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON in request body', code: 'VALIDATION_ERROR' }, 400);
    }

    const parsed = renameArtifactSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid rename request',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        },
        400
      );
    }

    updateArtifactTitle(db, id, parsed.data.title);
    const updated = getArtifact(db, id)!;
    return c.json(updated);
  });

  // POST /api/artifacts/:id/regenerate — regenerate an artifact with a new prompt
  router.post('/:id/regenerate', async (c) => {
    const id = c.req.param('id');

    // 1. Fetch artifact (404 if not found, 400 if archived)
    const artifact = getArtifact(db, id);
    if (!artifact) {
      return c.json({ error: 'Artifact not found', code: 'NOT_FOUND' }, 404);
    }
    if (artifact.status === 'archived') {
      return c.json({ error: 'Cannot regenerate an archived artifact', code: 'INVALID_STATE' }, 400);
    }

    // 2. Parse and validate body
    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON in request body', code: 'VALIDATION_ERROR' }, 400);
    }

    const parsed = regenerateArtifactSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid regenerate request',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        },
        400
      );
    }

    const { prompt, model } = parsed.data;

    // 3. Get next revision number
    const existingCount = countArtifactRevisions(db, id);
    const nextRevisionNumber = existingCount + 1;

    // 4. Call streamClaude with dashboard generation prompt
    const fullPrompt = `${DASHBOARD_GENERATION_SYSTEM_PROMPT}\n\nUser request: ${prompt}`;
    let fullResponse = '';
    try {
      for await (const event of streamClaude({
        prompt: fullPrompt,
        model: model ?? 'claude-haiku-4-5-20251001',
        effort: 'low',
        permissionMode: 'dontAsk',
      })) {
        if (event.type === 'text:delta') {
          fullResponse += event.text;
        }
        if (event.type === 'error') {
          return c.json({ error: event.message, code: 'GENERATION_ERROR' }, 500);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Artifact regeneration failed';
      return c.json({ error: message, code: 'GENERATION_ERROR' }, 500);
    }

    // 5. Parse JSON from response
    const { spec } = parseDashboardSpec(fullResponse);

    // 6. Create revision
    const revisionId = crypto.randomUUID();
    const revision = createArtifactRevision(db, {
      id: revisionId,
      artifactId: id,
      revisionNumber: nextRevisionNumber,
      specJson: JSON.stringify(spec),
      summary: null,
      prompt,
      model: model ?? 'claude-haiku-4-5-20251001',
      sourceSessionId: null,
      sourceMessageId: null,
    });

    // 7. Set current revision
    setArtifactCurrentRevision(db, id, revisionId);

    // Re-fetch artifact to get updated currentRevisionId
    const updatedArtifact = getArtifact(db, id)!;

    return c.json({ artifact: updatedArtifact, revision });
  });

  return router;
}

// ─── Project-scoped artifact routes: /api/projects ───────────────────────────

export function createProjectArtifactsRouter(db: Database) {
  const router = new Hono();

  // GET /api/projects/:projectId/artifacts — list artifacts for a project
  router.get('/:projectId/artifacts', (c) => {
    const projectId = c.req.param('projectId');
    const project = getProject(db, projectId);
    if (!project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    const includeArchived = c.req.query('includeArchived') === 'true';
    const artifacts = listArtifactsByProject(db, projectId, { includeArchived });
    return c.json(artifacts);
  });

  // POST /api/projects/:projectId/artifacts/generate — generate a new dashboard artifact
  router.post('/:projectId/artifacts/generate', async (c) => {
    const projectId = c.req.param('projectId');

    // 1. Validate project exists
    const project = getProject(db, projectId);
    if (!project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    // 2. Parse and validate request body
    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON in request body', code: 'VALIDATION_ERROR' }, 400);
    }

    const parsed = generateArtifactSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid generate artifact request',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        },
        400
      );
    }

    const { prompt, title, workspaceId, sessionId, model } = parsed.data;

    // 3. Derive title from prompt if not provided
    const artifactTitle = title?.trim() || prompt.slice(0, 60);

    // 4. Call streamClaude with dashboard generation prompt
    const fullPrompt = `${DASHBOARD_GENERATION_SYSTEM_PROMPT}\n\nUser request: ${prompt}`;
    let fullResponse = '';
    try {
      for await (const event of streamClaude({
        prompt: fullPrompt,
        model: model ?? 'claude-haiku-4-5-20251001',
        effort: 'low',
        permissionMode: 'dontAsk',
      })) {
        if (event.type === 'text:delta') {
          fullResponse += event.text;
        }
        if (event.type === 'error') {
          return c.json({ error: event.message, code: 'GENERATION_ERROR' }, 500);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Artifact generation failed';
      return c.json({ error: message, code: 'GENERATION_ERROR' }, 500);
    }

    // 5. Parse JSON from response (strip markdown fences if present)
    const { spec } = parseDashboardSpec(fullResponse);

    // 6. Create artifact + revision in DB
    const artifactId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();

    const artifact = createArtifact(db, {
      id: artifactId,
      kind: 'dashboard',
      schemaVersion: 1,
      title: artifactTitle,
      projectId,
      workspaceId: workspaceId ?? null,
      sourceSessionId: sessionId ?? null,
      sourceMessageId: null,
      status: 'active',
    });

    const revision = createArtifactRevision(db, {
      id: revisionId,
      artifactId,
      revisionNumber: 1,
      specJson: JSON.stringify(spec),
      summary: null,
      prompt,
      model: model ?? 'claude-haiku-4-5-20251001',
      sourceSessionId: sessionId ?? null,
      sourceMessageId: null,
    });

    setArtifactCurrentRevision(db, artifactId, revisionId);

    // Re-fetch artifact to get updated currentRevisionId
    const updatedArtifact = getArtifact(db, artifactId)!;

    return c.json({ artifact: updatedArtifact, revision }, 201);
  });

  return router;
}
