import type { Database } from 'bun:sqlite';
import type { Document, PipelineConfig, PipelineStepName } from '@claude-tauri/shared';

export interface StepResult {
  success: boolean;
  skip?: boolean;
  result?: unknown;
  error?: string;
  modelName?: string;
  modelVersion?: string;
  providerRequestId?: string;
}

export interface PipelineContext {
  db: Database;
  document: Document;
  storagePath: string;
  config: PipelineConfig;
  previousResults: Record<string, unknown>;
  abortSignal: AbortSignal;
}

export type PipelineStepExecutor = (ctx: PipelineContext) => Promise<StepResult>;

export interface PipelineStepDefinition {
  name: PipelineStepName;
  critical: boolean; // if true, failure halts pipeline
  execute: PipelineStepExecutor;
}

export interface OcrResult {
  text: string;
  confidence?: number;
  pageTexts?: string[];
  engine: 'mistral' | 'gemini';
  processingTimeMs: number;
  modelVersion?: string;
  providerRequestId?: string;
}

export interface OcrDiffResult {
  agreementScore: number;
  mismatchPages: number[];
  chosenEngine: 'mistral' | 'gemini';
  reason: string;
  needsReview: boolean;
}

export interface PageAnalysis {
  pageNumber: number;
  hasEmbeddedText: boolean;
  textContent: string;
  charCount: number;
}

export interface TextExtractionResult {
  text: string | null;
  needsOcr: boolean;
  pageCount: number;
  pages?: PageAnalysis[];
  method: 'embedded' | 'direct_read' | 'needs_ocr';
}

export interface StructuredExtractionResult {
  classification: string;
  summary: string;
  keyFields: Record<string, unknown>;
  entities: EntityCandidate[];
}

export interface EntityCandidate {
  type: string;
  value: string;
  normalizedValue?: string;
  confidence?: number;
  sourceText?: string;
  pageNumber?: number;
}
