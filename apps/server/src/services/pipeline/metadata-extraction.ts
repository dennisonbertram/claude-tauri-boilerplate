import type { PipelineContext, StepResult } from './types';
import { getDocumentContent, upsertDocumentContent } from '../../db';

export async function executeMetadataExtraction(ctx: PipelineContext): Promise<StepResult> {
  const content = getDocumentContent(ctx.db, ctx.document.id);
  if (!content) {
    return { success: true, skip: true, result: { reason: 'No extracted text to analyze' } };
  }

  const text = content.extractedText;

  // Word count
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  // Page count (from text extraction result or existing)
  const pageCount = content.pageCount || 1;

  // Simple language detection heuristic
  const language = detectLanguage(text);

  // Doc type from Claude Vision or MIME type
  const docType = content.docType || inferDocType(ctx.document.mimeType, ctx.document.filename);

  // Update document content with metadata
  upsertDocumentContent(ctx.db, {
    documentId: ctx.document.id,
    extractedText: content.extractedText,
    extractionMethod: content.extractionMethod,
    ocrConfidence: content.ocrConfidence,
    pageCount,
    wordCount,
    language,
    docType,
    structuredData: content.structuredData,
  });

  return {
    success: true,
    result: { wordCount, pageCount, language, docType },
  };
}

function detectLanguage(text: string): string {
  // Simple heuristic based on common words
  const sample = text.substring(0, 5000).toLowerCase();
  const enWords = ['the', 'and', 'is', 'in', 'to', 'of', 'for', 'that', 'with'];
  const esWords = ['el', 'la', 'de', 'en', 'los', 'del', 'las', 'por', 'con'];
  const frWords = ['le', 'la', 'de', 'les', 'des', 'est', 'dans', 'pour', 'que'];
  const deWords = ['der', 'die', 'und', 'den', 'das', 'ist', 'ein', 'für', 'mit'];

  const count = (words: string[]) =>
    words.reduce((sum, w) => {
      const regex = new RegExp(`\\b${w}\\b`, 'g');
      return sum + (sample.match(regex)?.length || 0);
    }, 0);

  const scores = [
    { lang: 'en', score: count(enWords) },
    { lang: 'es', score: count(esWords) },
    { lang: 'fr', score: count(frWords) },
    { lang: 'de', score: count(deWords) },
  ];

  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 3 ? scores[0].lang : 'unknown';
}

function inferDocType(mimeType: string, filename: string): string {
  if (mimeType === 'application/pdf') return 'pdf_document';
  if (mimeType.startsWith('image/')) return 'image';
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['md', 'mdx'].includes(ext || '')) return 'markdown';
  if (['json'].includes(ext || '')) return 'json';
  if (['csv', 'tsv'].includes(ext || '')) return 'spreadsheet';
  if (['txt', 'log'].includes(ext || '')) return 'text';
  return 'other';
}
