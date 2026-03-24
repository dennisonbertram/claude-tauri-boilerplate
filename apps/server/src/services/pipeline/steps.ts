import type { PipelineStepDefinition } from './types';
import { executeTextExtraction } from './text-extraction';
import { executeOcr } from './ocr';
import { executeClaudeVisionExtraction } from './claude-vision';
import { executeMetadataExtraction } from './metadata-extraction';
import { executeChunking } from './chunking';
import { executeEntityExtraction } from './entity-extraction';

export const PIPELINE_STEPS: PipelineStepDefinition[] = [
  { name: 'text_extraction', critical: true, execute: executeTextExtraction },
  { name: 'ocr', critical: true, execute: executeOcr },
  { name: 'claude_vision', critical: false, execute: executeClaudeVisionExtraction },
  { name: 'metadata_extraction', critical: false, execute: executeMetadataExtraction },
  { name: 'chunking', critical: false, execute: executeChunking },
  { name: 'entity_extraction', critical: false, execute: executeEntityExtraction },
];
