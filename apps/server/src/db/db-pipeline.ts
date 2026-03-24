import { Database } from 'bun:sqlite';
import type {
  PipelineConfig,
  PipelineStepRun,
  PipelineStepName,
  DocumentContent,
  OcrOutput,
  DocumentChunk,
  Entity,
  EntityRelationship,
  Document,
} from '@claude-tauri/shared';

// ─── Row types (snake_case DB rows) ────────────────────────────────────────────

interface StepRunRow {
  id: string;
  document_id: string;
  step_name: string;
  status: string;
  attempt: number;
  result_json: string | null;
  error: string | null;
  model_name: string | null;
  model_version: string | null;
  provider_request_id: string | null;
  processing_time_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface DocumentContentRow {
  id: string;
  document_id: string;
  extracted_text: string;
  extraction_method: string;
  ocr_confidence: number | null;
  page_count: number | null;
  word_count: number | null;
  language: string | null;
  doc_type: string | null;
  structured_data: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

interface OcrOutputRow {
  id: string;
  document_id: string;
  engine: string;
  raw_text: string;
  page_texts: string | null;
  confidence: number | null;
  processing_time_ms: number | null;
  model_version: string | null;
  provider_request_id: string | null;
  created_at: string;
}

interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  token_count: number;
  char_offset_start: number | null;
  char_offset_end: number | null;
  page_number: number | null;
  embedding: Buffer | null;
  embedding_model: string | null;
  embedding_dim: number | null;
  overlap_tokens: number;
  created_at: string;
}

interface EntityRow {
  id: string;
  document_id: string;
  entity_type: string;
  value: string;
  normalized_value: string | null;
  confidence: number | null;
  source_text: string | null;
  page_number: number | null;
  created_at: string;
}

interface EntityRelationshipRow {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  confidence: number | null;
  document_id: string;
  created_at: string;
}

interface DocumentRow {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  pipeline_steps: string;
  tags: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Row mappers ────────────────────────────────────────────────────────────────

function mapStepRun(row: StepRunRow): PipelineStepRun {
  return {
    id: row.id,
    documentId: row.document_id,
    stepName: row.step_name as PipelineStepName,
    status: row.status as PipelineStepRun['status'],
    attempt: row.attempt,
    resultJson: row.result_json ? JSON.parse(row.result_json) : undefined,
    error: row.error ?? undefined,
    modelName: row.model_name ?? undefined,
    modelVersion: row.model_version ?? undefined,
    providerRequestId: row.provider_request_id ?? undefined,
    processingTimeMs: row.processing_time_ms ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapDocumentContent(row: DocumentContentRow): DocumentContent {
  return {
    id: row.id,
    documentId: row.document_id,
    extractedText: row.extracted_text,
    extractionMethod: row.extraction_method,
    ocrConfidence: row.ocr_confidence,
    pageCount: row.page_count,
    wordCount: row.word_count,
    language: row.language,
    docType: row.doc_type,
    structuredData: row.structured_data ? JSON.parse(row.structured_data) : undefined,
    metadataJson: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOcrOutput(row: OcrOutputRow): OcrOutput {
  return {
    id: row.id,
    documentId: row.document_id,
    engine: row.engine as OcrOutput['engine'],
    rawText: row.raw_text,
    pageTexts: row.page_texts ? JSON.parse(row.page_texts) : null,
    confidence: row.confidence,
    processingTimeMs: row.processing_time_ms,
    modelVersion: row.model_version,
    providerRequestId: row.provider_request_id,
    createdAt: row.created_at,
  };
}

function mapChunk(row: ChunkRow, includeEmbeddings: boolean): DocumentChunk {
  const chunk: DocumentChunk = {
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    contentHash: row.content_hash,
    tokenCount: row.token_count,
    charOffsetStart: row.char_offset_start,
    charOffsetEnd: row.char_offset_end,
    pageNumber: row.page_number,
    embeddingModel: row.embedding_model,
    embeddingDim: row.embedding_dim,
    overlapTokens: row.overlap_tokens,
    createdAt: row.created_at,
  };
  // Embeddings are BLOBs and large — only include when requested
  if (includeEmbeddings && row.embedding) {
    (chunk as DocumentChunk & { embedding: Buffer }).embedding = row.embedding;
  }
  return chunk;
}

function mapEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    documentId: row.document_id,
    entityType: row.entity_type as Entity['entityType'],
    value: row.value,
    normalizedValue: row.normalized_value,
    confidence: row.confidence,
    sourceText: row.source_text,
    pageNumber: row.page_number,
    createdAt: row.created_at,
  };
}

function mapEntityRelationship(row: EntityRelationshipRow): EntityRelationship {
  return {
    id: row.id,
    sourceEntityId: row.source_entity_id,
    targetEntityId: row.target_entity_id,
    relationshipType: row.relationship_type,
    confidence: row.confidence,
    documentId: row.document_id,
    createdAt: row.created_at,
  };
}

function mapDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    filename: row.filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    status: row.status as Document['status'],
    pipelineSteps: JSON.parse(row.pipeline_steps),
    tags: JSON.parse(row.tags),
    sessionId: row.session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Default pipeline config ────────────────────────────────────────────────────

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  ocrMode: 'mistral-only',
  enabledSteps: ['text_extraction', 'ocr', 'claude_vision', 'metadata_extraction', 'chunking', 'entity_extraction'],
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-3-small',
  pollIntervalMs: 15000,
  chunkTargetTokens: 500,
  chunkOverlapTokens: 50,
  ocrConfidenceThreshold: 0.7,
  dualVerifyDiffThreshold: 0.05,
  maxFileSizeBytes: 50 * 1024 * 1024,
  maxPageCount: 200,
  stepTimeouts: {
    text_extraction: 30000,
    ocr: 120000,
    claude_vision: 60000,
    metadata_extraction: 10000,
    chunking: 60000,
    entity_extraction: 30000,
  },
};

// ─── Config ─────────────────────────────────────────────────────────────────────

export function getPipelineConfig(db: Database): PipelineConfig {
  const rows = db.prepare(`SELECT key, value FROM pipeline_config`).all() as Array<{ key: string; value: string }>;
  const overrides: Record<string, unknown> = {};
  for (const row of rows) {
    overrides[row.key] = JSON.parse(row.value);
  }
  // Deep merge: for nested objects like stepTimeouts, merge instead of replace
  const merged = { ...DEFAULT_PIPELINE_CONFIG } as Record<string, unknown>;
  for (const [key, val] of Object.entries(overrides)) {
    if (val && typeof val === 'object' && !Array.isArray(val) &&
        key in DEFAULT_PIPELINE_CONFIG && typeof (DEFAULT_PIPELINE_CONFIG as any)[key] === 'object' && !Array.isArray((DEFAULT_PIPELINE_CONFIG as any)[key])) {
      merged[key] = { ...(DEFAULT_PIPELINE_CONFIG as any)[key], ...(val as Record<string, unknown>) };
    } else {
      merged[key] = val;
    }
  }
  return merged as PipelineConfig;
}

export function updatePipelineConfig(db: Database, updates: Partial<PipelineConfig>): PipelineConfig {
  const upsert = db.prepare(
    `INSERT INTO pipeline_config (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );

  const tx = db.transaction(() => {
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        upsert.run(key, JSON.stringify(val));
      }
    }
  });
  tx();

  return getPipelineConfig(db);
}

// ─── Claim next unenriched document ─────────────────────────────────────────────

export function claimNextUnenrichedDocument(db: Database): Document | null {
  // Atomic claim: find a 'ready' document that either:
  // 1. Has no document_content row (never processed), OR
  // 2. Has pending step runs (retry/resume after partial processing)
  const row = db.prepare(`
    UPDATE documents
    SET status = 'enriching', updated_at = datetime('now')
    WHERE id = (
      SELECT d.id FROM documents d
      WHERE d.status = 'ready' AND (
        NOT EXISTS (SELECT 1 FROM document_content dc WHERE dc.document_id = d.id)
        OR EXISTS (SELECT 1 FROM pipeline_step_runs psr WHERE psr.document_id = d.id AND psr.status = 'pending')
      )
      ORDER BY d.created_at ASC
      LIMIT 1
    )
    RETURNING *
  `).get() as DocumentRow | null;

  return row ? mapDocument(row) : null;
}

// ─── Recovery ───────────────────────────────────────────────────────────────────

export function recoverStaleJobs(db: Database): { documentsRecovered: number; stepsReset: number } {
  const tx = db.transaction(() => {
    // Reset documents stuck in 'enriching' for more than 10 minutes
    const docResult = db.prepare(`
      UPDATE documents
      SET status = 'ready', updated_at = datetime('now')
      WHERE status = 'enriching'
        AND updated_at < datetime('now', '-10 minutes')
    `).run();

    // Reset step runs stuck in 'running' for more than 10 minutes
    const stepResult = db.prepare(`
      UPDATE pipeline_step_runs
      SET status = 'failed', error = 'Recovered: step was stale', completed_at = datetime('now')
      WHERE status = 'running'
        AND started_at < datetime('now', '-10 minutes')
    `).run();

    return {
      documentsRecovered: docResult.changes,
      stepsReset: stepResult.changes,
    };
  });

  return tx();
}

// ─── Step Runs ──────────────────────────────────────────────────────────────────

export function createStepRun(
  db: Database,
  params: { documentId: string; stepName: string; attempt?: number },
): PipelineStepRun {
  const id = crypto.randomUUID();
  const row = db.prepare(`
    INSERT INTO pipeline_step_runs (id, document_id, step_name, attempt)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `).get(id, params.documentId, params.stepName, params.attempt ?? 1) as StepRunRow;
  return mapStepRun(row);
}

export function updateStepRun(
  db: Database,
  id: string,
  updates: {
    status?: string;
    resultJson?: unknown;
    error?: string;
    modelName?: string;
    modelVersion?: string;
    providerRequestId?: string;
    processingTimeMs?: number;
    startedAt?: string;
    completedAt?: string;
  },
): PipelineStepRun | null {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  if (updates.resultJson !== undefined) {
    sets.push('result_json = ?');
    params.push(JSON.stringify(updates.resultJson));
  }
  if (updates.error !== undefined) {
    sets.push('error = ?');
    params.push(updates.error);
  }
  if (updates.modelName !== undefined) {
    sets.push('model_name = ?');
    params.push(updates.modelName);
  }
  if (updates.modelVersion !== undefined) {
    sets.push('model_version = ?');
    params.push(updates.modelVersion);
  }
  if (updates.providerRequestId !== undefined) {
    sets.push('provider_request_id = ?');
    params.push(updates.providerRequestId);
  }
  if (updates.processingTimeMs !== undefined) {
    sets.push('processing_time_ms = ?');
    params.push(updates.processingTimeMs);
  }
  if (updates.startedAt !== undefined) {
    sets.push('started_at = ?');
    params.push(updates.startedAt);
  }
  if (updates.completedAt !== undefined) {
    sets.push('completed_at = ?');
    params.push(updates.completedAt);
  }

  if (sets.length === 0) return null;
  params.push(id);

  const row = db.prepare(
    `UPDATE pipeline_step_runs SET ${sets.join(', ')} WHERE id = ? RETURNING *`,
  ).get(...params) as StepRunRow | null;
  return row ? mapStepRun(row) : null;
}

export function getStepRunsForDocument(db: Database, documentId: string): PipelineStepRun[] {
  const rows = db.prepare(
    `SELECT * FROM pipeline_step_runs WHERE document_id = ? ORDER BY step_name, attempt`,
  ).all(documentId) as StepRunRow[];
  return rows.map(mapStepRun);
}

export function getLatestStepRun(
  db: Database,
  documentId: string,
  stepName: string,
): PipelineStepRun | null {
  const row = db.prepare(
    `SELECT * FROM pipeline_step_runs WHERE document_id = ? AND step_name = ? ORDER BY attempt DESC LIMIT 1`,
  ).get(documentId, stepName) as StepRunRow | null;
  return row ? mapStepRun(row) : null;
}

// ─── Document Content ───────────────────────────────────────────────────────────

export function upsertDocumentContent(
  db: Database,
  params: {
    documentId: string;
    extractedText: string;
    extractionMethod: string;
    ocrConfidence?: number | null;
    pageCount?: number | null;
    wordCount?: number | null;
    language?: string | null;
    docType?: string | null;
    structuredData?: unknown;
    metadataJson?: unknown;
  },
): DocumentContent {
  const id = crypto.randomUUID();
  const row = db.prepare(`
    INSERT INTO document_content (id, document_id, extracted_text, extraction_method, ocr_confidence, page_count, word_count, language, doc_type, structured_data, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET
      extracted_text = excluded.extracted_text,
      extraction_method = excluded.extraction_method,
      ocr_confidence = excluded.ocr_confidence,
      page_count = excluded.page_count,
      word_count = excluded.word_count,
      language = excluded.language,
      doc_type = excluded.doc_type,
      structured_data = excluded.structured_data,
      metadata_json = excluded.metadata_json,
      updated_at = datetime('now')
    RETURNING *
  `).get(
    id,
    params.documentId,
    params.extractedText,
    params.extractionMethod,
    params.ocrConfidence ?? null,
    params.pageCount ?? null,
    params.wordCount ?? null,
    params.language ?? null,
    params.docType ?? null,
    params.structuredData ? JSON.stringify(params.structuredData) : null,
    params.metadataJson ? JSON.stringify(params.metadataJson) : null,
  ) as DocumentContentRow;
  return mapDocumentContent(row);
}

export function getDocumentContent(db: Database, documentId: string): DocumentContent | null {
  const row = db.prepare(
    `SELECT * FROM document_content WHERE document_id = ?`,
  ).get(documentId) as DocumentContentRow | null;
  return row ? mapDocumentContent(row) : null;
}

export function deleteDocumentContent(db: Database, documentId: string): boolean {
  const result = db.prepare(`DELETE FROM document_content WHERE document_id = ?`).run(documentId);
  return result.changes > 0;
}

// ─── OCR Outputs ────────────────────────────────────────────────────────────────

export function upsertOcrOutput(
  db: Database,
  params: {
    documentId: string;
    engine: 'mistral' | 'gemini';
    rawText: string;
    pageTexts?: string[] | null;
    confidence?: number | null;
    processingTimeMs?: number | null;
    modelVersion?: string | null;
    providerRequestId?: string | null;
  },
): OcrOutput {
  const id = crypto.randomUUID();
  const row = db.prepare(`
    INSERT INTO ocr_outputs (id, document_id, engine, raw_text, page_texts, confidence, processing_time_ms, model_version, provider_request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(document_id, engine) DO UPDATE SET
      raw_text = excluded.raw_text,
      page_texts = excluded.page_texts,
      confidence = excluded.confidence,
      processing_time_ms = excluded.processing_time_ms,
      model_version = excluded.model_version,
      provider_request_id = excluded.provider_request_id
    RETURNING *
  `).get(
    id,
    params.documentId,
    params.engine,
    params.rawText,
    params.pageTexts ? JSON.stringify(params.pageTexts) : null,
    params.confidence ?? null,
    params.processingTimeMs ?? null,
    params.modelVersion ?? null,
    params.providerRequestId ?? null,
  ) as OcrOutputRow;
  return mapOcrOutput(row);
}

export function getOcrOutputs(db: Database, documentId: string): OcrOutput[] {
  const rows = db.prepare(
    `SELECT * FROM ocr_outputs WHERE document_id = ? ORDER BY engine`,
  ).all(documentId) as OcrOutputRow[];
  return rows.map(mapOcrOutput);
}

// ─── Chunks ─────────────────────────────────────────────────────────────────────

export function insertChunks(
  db: Database,
  documentId: string,
  chunks: Array<{
    content: string;
    contentHash: string;
    tokenCount: number;
    charOffsetStart?: number | null;
    charOffsetEnd?: number | null;
    pageNumber?: number | null;
    embedding?: Buffer | null;
    embeddingModel?: string | null;
    embeddingDim?: number | null;
    overlapTokens?: number;
  }>,
): number {
  const insert = db.prepare(`
    INSERT INTO document_chunks (id, document_id, chunk_index, content, content_hash, token_count, char_offset_start, char_offset_end, page_number, embedding, embedding_model, embedding_dim, overlap_tokens)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    let count = 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      insert.run(
        crypto.randomUUID(),
        documentId,
        i,
        c.content,
        c.contentHash,
        c.tokenCount,
        c.charOffsetStart ?? null,
        c.charOffsetEnd ?? null,
        c.pageNumber ?? null,
        c.embedding ?? null,
        c.embeddingModel ?? null,
        c.embeddingDim ?? null,
        c.overlapTokens ?? 0,
      );
      count++;
    }
    return count;
  });

  return tx();
}

export function getChunksForDocument(
  db: Database,
  documentId: string,
  opts?: { includeEmbeddings?: boolean },
): DocumentChunk[] {
  const includeEmbeddings = opts?.includeEmbeddings ?? false;
  const cols = includeEmbeddings
    ? '*'
    : 'id, document_id, chunk_index, content, content_hash, token_count, char_offset_start, char_offset_end, page_number, embedding_model, embedding_dim, overlap_tokens, created_at';
  const rows = db.prepare(
    `SELECT ${cols} FROM document_chunks WHERE document_id = ? ORDER BY chunk_index`,
  ).all(documentId) as ChunkRow[];
  return rows.map((r) => mapChunk(r, includeEmbeddings));
}

export function deleteChunksForDocument(db: Database, documentId: string): number {
  const result = db.prepare(`DELETE FROM document_chunks WHERE document_id = ?`).run(documentId);
  return result.changes;
}

// ─── Entities ───────────────────────────────────────────────────────────────────

export function insertEntities(
  db: Database,
  documentId: string,
  entities: Array<{
    entityType: string;
    value: string;
    normalizedValue?: string | null;
    confidence?: number | null;
    sourceText?: string | null;
    pageNumber?: number | null;
  }>,
): number {
  const insert = db.prepare(`
    INSERT INTO entities (id, document_id, entity_type, value, normalized_value, confidence, source_text, page_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    let count = 0;
    for (const e of entities) {
      insert.run(
        crypto.randomUUID(),
        documentId,
        e.entityType,
        e.value,
        e.normalizedValue ?? null,
        e.confidence ?? null,
        e.sourceText ?? null,
        e.pageNumber ?? null,
      );
      count++;
    }
    return count;
  });

  return tx();
}

export function insertEntityRelationships(
  db: Database,
  documentId: string,
  relationships: Array<{
    sourceEntityId: string;
    targetEntityId: string;
    relationshipType: string;
    confidence?: number | null;
  }>,
): number {
  const insert = db.prepare(`
    INSERT INTO entity_relationships (id, source_entity_id, target_entity_id, relationship_type, confidence, document_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    let count = 0;
    for (const r of relationships) {
      insert.run(
        crypto.randomUUID(),
        r.sourceEntityId,
        r.targetEntityId,
        r.relationshipType,
        r.confidence ?? null,
        documentId,
      );
      count++;
    }
    return count;
  });

  return tx();
}

export function getEntitiesForDocument(db: Database, documentId: string): Entity[] {
  const rows = db.prepare(
    `SELECT * FROM entities WHERE document_id = ? ORDER BY entity_type, value`,
  ).all(documentId) as EntityRow[];
  return rows.map(mapEntity);
}

export function getEntityRelationshipsForDocument(db: Database, documentId: string): EntityRelationship[] {
  const rows = db.prepare(
    `SELECT * FROM entity_relationships WHERE document_id = ? ORDER BY created_at`,
  ).all(documentId) as EntityRelationshipRow[];
  return rows.map(mapEntityRelationship);
}

export function deleteEntitiesForDocument(db: Database, documentId: string): number {
  // entity_relationships cascade-deletes via FK ON DELETE CASCADE on entities
  const result = db.prepare(`DELETE FROM entities WHERE document_id = ?`).run(documentId);
  return result.changes;
}

// ─── Reprocessing cleanup ───────────────────────────────────────────────────────

export function cleanupDocumentEnrichment(db: Database, documentId: string): void {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM document_content WHERE document_id = ?`).run(documentId);
    db.prepare(`DELETE FROM ocr_outputs WHERE document_id = ?`).run(documentId);
    db.prepare(`DELETE FROM document_chunks WHERE document_id = ?`).run(documentId);
    db.prepare(`DELETE FROM entities WHERE document_id = ?`).run(documentId);
    // entity_relationships cascade via FK on entities
    db.prepare(`DELETE FROM pipeline_step_runs WHERE document_id = ?`).run(documentId);
  });
  tx();
}
