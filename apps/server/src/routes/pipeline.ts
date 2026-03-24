import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import {
  getPipelineConfig,
  updatePipelineConfig,
  getStepRunsForDocument,
  getDocumentContent,
  getChunksForDocument,
  getEntitiesForDocument,
  getEntityRelationshipsForDocument,
  getOcrOutputs,
  cleanupDocumentEnrichment,
  getDocument,
  updateDocument,
} from '../db';
import { nudgePipelineWorker } from '../services/pipeline/runner';

export function createPipelineRouter(db: Database) {
  const router = new Hono();

  router.get('/status', (c) => {
    const enriching = db.prepare("SELECT COUNT(*) as count FROM documents WHERE status = 'enriching'").get() as { count: number };
    const unenriched = db.prepare("SELECT COUNT(*) as count FROM documents d LEFT JOIN document_content dc ON dc.document_id = d.id WHERE d.status = 'ready' AND dc.id IS NULL").get() as { count: number };
    const currentDoc = db.prepare("SELECT id FROM documents WHERE status = 'enriching' LIMIT 1").get() as { id: string } | null;
    let currentStep: string | undefined;
    if (currentDoc) {
      const step = db.prepare("SELECT step_name FROM pipeline_step_runs WHERE document_id = ? AND status = 'running' LIMIT 1").get(currentDoc.id) as { step_name: string } | null;
      currentStep = step?.step_name;
    }
    return c.json({ isRunning: enriching.count > 0, currentDocumentId: currentDoc?.id, currentStep, queueDepth: unenriched.count });
  });

  router.get('/status/:documentId', (c) => {
    const documentId = c.req.param('documentId');
    const doc = getDocument(db, documentId);
    if (!doc) return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    const steps = getStepRunsForDocument(db, documentId);
    const content = getDocumentContent(db, documentId);
    const chunkCount = db.prepare('SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ?').get(documentId) as { count: number };
    const hasEmbeddings = db.prepare('SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ? AND embedding IS NOT NULL').get(documentId) as { count: number };
    const entityCount = db.prepare('SELECT COUNT(*) as count FROM entities WHERE document_id = ?').get(documentId) as { count: number };
    const relCount = db.prepare('SELECT COUNT(*) as count FROM entity_relationships WHERE document_id = ?').get(documentId) as { count: number };
    return c.json({
      documentId, status: doc.status, steps,
      content: content ? { hasExtractedText: !!content.extractedText, wordCount: content.wordCount, pageCount: content.pageCount, docType: content.docType, language: content.language } : undefined,
      chunks: { count: chunkCount.count, hasEmbeddings: hasEmbeddings.count > 0 },
      entities: { count: entityCount.count, relationshipCount: relCount.count },
    });
  });

  router.post('/trigger/:documentId', (c) => {
    const documentId = c.req.param('documentId');
    const doc = getDocument(db, documentId);
    if (!doc) return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    if (doc.status === 'enriching') return c.json({ error: 'Document is currently being processed', code: 'CONFLICT' }, 409);
    cleanupDocumentEnrichment(db, documentId);
    updateDocument(db, documentId, { status: 'ready' });
    nudgePipelineWorker();
    return c.json({ success: true, message: 'Enrichment re-triggered' }, 202);
  });

  router.post('/retry/:documentId', (c) => {
    const documentId = c.req.param('documentId');
    const doc = getDocument(db, documentId);
    if (!doc) return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    db.prepare("UPDATE pipeline_step_runs SET status = 'pending', error = NULL, started_at = NULL WHERE document_id = ? AND status = 'failed'").run(documentId);
    if (doc.status === 'error') updateDocument(db, documentId, { status: 'ready' });
    nudgePipelineWorker();
    return c.json({ success: true }, 202);
  });

  router.post('/cancel/:documentId', (c) => {
    const documentId = c.req.param('documentId');
    const doc = getDocument(db, documentId);
    if (!doc) return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    if (doc.status !== 'enriching') return c.json({ error: 'Not currently processing', code: 'CONFLICT' }, 409);
    updateDocument(db, documentId, { status: 'error' });
    return c.json({ success: true });
  });

  router.get('/config', (c) => {
    const config = getPipelineConfig(db);
    return c.json({ ...config, apiKeys: { mistral: !!process.env.MISTRAL_API_KEY, gemini: !!process.env.GOOGLE_AI_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY } });
  });

  router.put('/config', async (c) => {
    let body: Record<string, unknown>;
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, 400); }
    delete body['apiKeys'];
    return c.json(updatePipelineConfig(db, body as any));
  });

  router.get('/documents/:id/content', (c) => {
    const content = getDocumentContent(db, c.req.param('id'));
    if (!content) return c.json({ error: 'No content extracted', code: 'NOT_FOUND' }, 404);
    return c.json(content);
  });

  router.get('/documents/:id/chunks', (c) => c.json(getChunksForDocument(db, c.req.param('id'), { includeEmbeddings: false })));

  router.get('/documents/:id/entities', (c) => {
    const id = c.req.param('id');
    return c.json({ entities: getEntitiesForDocument(db, id), relationships: getEntityRelationshipsForDocument(db, id) });
  });

  router.get('/documents/:id/ocr-outputs', (c) => c.json(getOcrOutputs(db, c.req.param('id'))));

  router.post('/search', async (c) => {
    let body: { query?: string; topK?: number; documentIds?: string[] };
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, 400); }
    const { query, topK = 5, documentIds } = body;
    if (!query || typeof query !== 'string') return c.json({ error: 'query is required', code: 'VALIDATION_ERROR' }, 400);
    const conditions = ['dc.content LIKE ?'];
    const params: (string | number)[] = [`%${query}%`];
    if (documentIds?.length) { conditions.push(`dc.document_id IN (${documentIds.map(() => '?').join(',')})`); params.push(...documentIds); }
    params.push(topK);
    const results = db.prepare(`SELECT dc.id as chunkId, dc.document_id as documentId, dc.content, dc.page_number as pageNumber FROM document_chunks dc WHERE ${conditions.join(' AND ')} LIMIT ?`).all(...params) as any[];
    return c.json({ results: results.map((r: any) => ({ ...r, score: 1.0 })), searchType: 'keyword' });
  });

  return router;
}
