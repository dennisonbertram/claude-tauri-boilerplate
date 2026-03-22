import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  getArtifact,
  getProject,
  listArtifactsByProject,
  createArtifact,
  createArtifactRevision,
  setArtifactCurrentRevision,
} from '../db';
import { streamClaude } from '../services/claude';
import {
  DASHBOARD_GENERATION_SYSTEM_PROMPT,
  generateArtifactSchema,
  parseDashboardSpec,
} from './artifact-helpers';

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

    // 6. Create artifact + revision in DB atomically
    const artifactId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();

    const { artifact, revision } = db.transaction(() => {
      const art = createArtifact(db, {
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

      const rev = createArtifactRevision(db, {
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

      return { artifact: art, revision: rev };
    })();

    // Re-fetch artifact to get updated currentRevisionId
    const updatedArtifact = getArtifact(db, artifactId)!;

    return c.json({ artifact: updatedArtifact, revision }, 201);
  });

  return router;
}
