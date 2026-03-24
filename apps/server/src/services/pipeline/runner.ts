import type { Database } from 'bun:sqlite';
import type { PipelineConfig, PipelineStepName } from '@claude-tauri/shared';
import { readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import {
  claimNextUnenrichedDocument,
  recoverStaleJobs,
  createStepRun,
  updateStepRun,
  getLatestStepRun,
  getPipelineConfig,
  updateDocument,
  getDocument,
  cleanupDocumentEnrichment,
} from '../../db';
import { PIPELINE_STEPS } from './steps';
import type { PipelineContext, StepResult } from './types';

const DOCUMENTS_DIR = join(process.env.HOME || '~', '.claude-tauri', 'documents');

let sweepInterval: Timer | null = null;
let isProcessing = false;
let workerDb: Database | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

export function startPipelineWorker(db: Database): void {
  workerDb = db;
  recoverOnStartup(db);

  const config = getPipelineConfig(db);
  const intervalMs = config?.pollIntervalMs || 15000;

  sweepInterval = setInterval(() => {
    if (isProcessing) return;
    discoverInboxFiles(db);
    processNextDocument(db).catch((err) =>
      console.error('[pipeline] sweep error:', err),
    );
  }, intervalMs);

  console.log(`[pipeline] worker started (poll every ${intervalMs}ms)`);
}

export function stopPipelineWorker(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
  console.log('[pipeline] worker stopped');
}

/** Kick the worker to process immediately (e.g. after upload) */
export function nudgePipelineWorker(): void {
  if (!workerDb || isProcessing) return;
  const db = workerDb;
  setImmediate(() => {
    if (isProcessing) return;
    processNextDocument(db).catch((err) =>
      console.error('[pipeline] nudge error:', err),
    );
  });
}

// ─── Crash Recovery ──────────────────────────────────────────────────────────

function recoverOnStartup(db: Database): void {
  try {
    const recovered = recoverStaleJobs(db);
    if (recovered.documentsRecovered > 0 || recovered.stepsReset > 0) {
      console.log(`[pipeline] recovered ${recovered.documentsRecovered} doc(s), ${recovered.stepsReset} step(s)`);
    }
  } catch (err) {
    console.error('[pipeline] recovery error:', err);
  }
}

// ─── Inbox Discovery ─────────────────────────────────────────────────────────

function discoverInboxFiles(db: Database): void {
  try {
    if (!existsSync(DOCUMENTS_DIR)) {
      mkdirSync(DOCUMENTS_DIR, { recursive: true });
      return;
    }

    const entries = readdirSync(DOCUMENTS_DIR);

    for (const entry of entries) {
      const fullPath = join(DOCUMENTS_DIR, entry);

      // Skip directories and hidden files
      if (entry.startsWith('.')) continue;
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;

      // Check if already tracked by storage_path
      const existing = db
        .prepare('SELECT id FROM documents WHERE storage_path = ?')
        .get(fullPath) as { id: string } | null;

      if (existing) continue;

      // Detect MIME type via Bun
      const mimeType = Bun.file(fullPath).type || 'application/octet-stream';
      const id = crypto.randomUUID();

      try {
        const stmt = db.prepare(
          `INSERT INTO documents (id, filename, storage_path, mime_type, size_bytes, status)
           VALUES (?, ?, ?, ?, ?, 'ready')`,
        );
        stmt.run(id, entry, fullPath, mimeType, stat.size);
        console.log(`[pipeline] discovered: ${entry}`);
      } catch (insertErr) {
        // Ignore duplicate insert races
        console.error(`[pipeline] failed to insert ${entry}:`, insertErr);
      }
    }
  } catch (err) {
    console.error('[pipeline] inbox discovery error:', err);
  }
}

// ─── Main Processing Loop ───────────────────────────────────────────────────

async function processNextDocument(db: Database): Promise<void> {
  isProcessing = true;

  try {
    const doc = claimNextUnenrichedDocument(db);
    if (!doc) return;

    const config = getPipelineConfig(db);
    if (!config) {
      console.error('[pipeline] no pipeline config found, skipping');
      updateDocument(db, doc.id, { status: 'error' });
      return;
    }

    const previousResults: Record<string, unknown> = {};

    for (const stepDef of PIPELINE_STEPS) {
      // Skip disabled steps
      if (!config.enabledSteps.includes(stepDef.name)) continue;

      // Check if doc was cancelled between steps
      const freshDoc = getDocument(db, doc.id);
      if (freshDoc && freshDoc.status === 'error') {
        console.log(`[pipeline] doc ${doc.id} was cancelled, stopping`);
        return;
      }

      // Find existing step run or create new one with incremented attempt
      const existingRun = getLatestStepRun(db, doc.id, stepDef.name);
      let stepRun;
      if (existingRun && existingRun.status === 'pending') {
        // Reuse pending run (from retry)
        stepRun = existingRun;
      } else if (existingRun && (existingRun.status === 'completed' || existingRun.status === 'skipped')) {
        // Already done, skip
        previousResults[stepDef.name] = existingRun.resultJson;
        continue;
      } else {
        // Create new run with incremented attempt
        const nextAttempt = existingRun ? existingRun.attempt + 1 : 1;
        stepRun = createStepRun(db, {
          documentId: doc.id,
          stepName: stepDef.name,
          attempt: nextAttempt,
        });
      }

      // Mark as running
      updateStepRun(db, stepRun.id, {
        status: 'running',
        startedAt: new Date().toISOString(),
      });

      // Set up abort controller with timeout
      const timeoutMs = config.stepTimeouts?.[stepDef.name] ?? 120_000;
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), timeoutMs);

      const startTime = Date.now();
      let stepResult: StepResult;

      try {
        const ctx: PipelineContext = {
          db,
          document: doc,
          storagePath: doc.storagePath,
          config,
          previousResults,
          abortSignal: abortController.signal,
        };

        stepResult = await stepDef.execute(ctx);
      } catch (err) {
        stepResult = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        clearTimeout(timeout);
      }

      const processingTimeMs = Date.now() - startTime;

      if (stepResult.skip) {
        updateStepRun(db, stepRun.id, {
          status: 'skipped',
          resultJson: stepResult.result,
          processingTimeMs,
          completedAt: new Date().toISOString(),
        });
        continue;
      }

      if (stepResult.success) {
        updateStepRun(db, stepRun.id, {
          status: 'completed',
          resultJson: stepResult.result,
          modelName: stepResult.modelName,
          modelVersion: stepResult.modelVersion,
          providerRequestId: stepResult.providerRequestId,
          processingTimeMs,
          completedAt: new Date().toISOString(),
        });

        // Store result for downstream steps
        previousResults[stepDef.name] = stepResult.result;
      } else {
        // Step failed
        updateStepRun(db, stepRun.id, {
          status: 'failed',
          error: stepResult.error,
          processingTimeMs,
          completedAt: new Date().toISOString(),
        });

        if (stepDef.critical) {
          // Critical step failed — halt pipeline, mark doc as error
          console.error(
            `[pipeline] critical step "${stepDef.name}" failed for doc ${doc.id}: ${stepResult.error}`,
          );
          updateDocument(db, doc.id, { status: 'error' });
          return;
        }

        // Non-critical — log and continue
        console.warn(
          `[pipeline] non-critical step "${stepDef.name}" failed for doc ${doc.id}: ${stepResult.error}`,
        );
      }
    }

    // All steps complete — mark document as ready
    updateDocument(db, doc.id, { status: 'ready' });
  } finally {
    isProcessing = false;
  }
}
