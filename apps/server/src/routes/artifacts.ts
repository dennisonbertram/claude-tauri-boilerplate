import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  getArtifact,
  archiveArtifact,
  createArtifactRevision,
  setArtifactCurrentRevision,
  updateArtifactTitle,
  getArtifactLatestRevision,
  getArtifactRevision,
} from '../db';
import { streamClaude } from '../services/claude';
import {
  DASHBOARD_GENERATION_SYSTEM_PROMPT,
  regenerateArtifactSchema,
  renameArtifactSchema,
  parseDashboardSpec,
} from './artifact-helpers';

// Re-export the project-scoped router for backwards compatibility
export { createProjectArtifactsRouter } from './project-artifacts';

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

  // GET /api/artifacts/:id/latest-revision — get the latest revision for an artifact
  router.get('/:id/latest-revision', (c) => {
    const id = c.req.param('id');
    const artifact = getArtifact(db, id);
    if (!artifact) {
      return c.json({ error: 'Artifact not found', code: 'NOT_FOUND' }, 404);
    }
    const revision = getArtifactLatestRevision(db, id);
    if (!revision) {
      return c.json({ error: 'No revisions found', code: 'NOT_FOUND' }, 404);
    }
    return c.json(revision);
  });

  // GET /api/artifacts/:id/revisions/:revisionId — get a specific revision
  router.get('/:id/revisions/:revisionId', (c) => {
    const revisionId = c.req.param('revisionId');
    const revision = getArtifactRevision(db, revisionId);
    if (!revision) {
      return c.json({ error: 'Revision not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json(revision);
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

    const artifact = getArtifact(db, id);
    if (!artifact) {
      return c.json({ error: 'Artifact not found', code: 'NOT_FOUND' }, 404);
    }
    if (artifact.status === 'archived') {
      return c.json({ error: 'Cannot regenerate an archived artifact', code: 'INVALID_STATE' }, 400);
    }

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

    const { spec } = parseDashboardSpec(fullResponse);

    const revisionId = crypto.randomUUID();
    const { revision } = db.transaction(() => {
      const row = db.prepare(
        `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next FROM artifact_revisions WHERE artifact_id = ?`
      ).get(artifact.id) as { next: number };
      const nextRevisionNumber = row.next;

      const rev = createArtifactRevision(db, {
        id: revisionId,
        artifactId: artifact.id,
        revisionNumber: nextRevisionNumber,
        specJson: JSON.stringify(spec),
        summary: null,
        prompt,
        model: model ?? 'claude-haiku-4-5-20251001',
        sourceSessionId: null,
        sourceMessageId: null,
      });

      setArtifactCurrentRevision(db, artifact.id, revisionId);

      return { revision: rev };
    })();

    const updatedArtifact = getArtifact(db, id)!;

    return c.json({ artifact: updatedArtifact, revision });
  });

  return router;
}
