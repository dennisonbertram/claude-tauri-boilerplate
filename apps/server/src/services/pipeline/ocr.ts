import type { PipelineContext, StepResult, TextExtractionResult } from './types';
import { ocrWithMistral } from './ocr-mistral';
import { ocrWithGemini } from './ocr-gemini';
import { diffOcrResults } from './ocr-diff';
import { upsertOcrOutput, upsertDocumentContent } from '../../db';

export async function executeOcr(ctx: PipelineContext): Promise<StepResult> {
  const textResult = ctx.previousResults.text_extraction as TextExtractionResult | undefined;

  // Skip if text extraction says OCR not needed
  if (textResult && !textResult.needsOcr) {
    // Store the already-extracted text as document content
    upsertDocumentContent(ctx.db, {
      documentId: ctx.document.id,
      extractedText: textResult.text || '',
      extractionMethod: textResult.method === 'embedded' ? 'embedded' : 'direct_read',
      pageCount: textResult.pageCount,
    });
    return { success: true, skip: true, result: { reason: 'Text already extracted, OCR not needed' } };
  }

  const { ocrMode } = ctx.config;

  try {
    switch (ocrMode) {
      case 'mistral-only': return await runSingleEngine(ctx, 'mistral');
      case 'gemini-only': return await runSingleEngine(ctx, 'gemini');
      case 'dual-verify': return await runDualVerify(ctx);
      case 'mistral-primary-gemini-verify': return await runMistralPrimaryGeminiVerify(ctx);
      default: return await runSingleEngine(ctx, 'mistral');
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function runSingleEngine(ctx: PipelineContext, engine: 'mistral' | 'gemini'): Promise<StepResult> {
  const ocrFn = engine === 'mistral' ? ocrWithMistral : ocrWithGemini;
  const result = await ocrFn(ctx.storagePath, ctx.document.mimeType, ctx.abortSignal);

  // Store raw OCR output
  upsertOcrOutput(ctx.db, {
    documentId: ctx.document.id,
    engine,
    rawText: result.text,
    pageTexts: result.pageTexts || null,
    confidence: result.confidence || null,
    processingTimeMs: result.processingTimeMs,
    modelVersion: result.modelVersion || null,
    providerRequestId: result.providerRequestId || null,
  });

  // Store as document content
  const textResult = ctx.previousResults.text_extraction as TextExtractionResult | undefined;
  upsertDocumentContent(ctx.db, {
    documentId: ctx.document.id,
    extractedText: result.text,
    extractionMethod: engine === 'mistral' ? 'ocr_mistral' : 'ocr_gemini',
    ocrConfidence: result.confidence || null,
    pageCount: textResult?.pageCount || null,
  });

  return {
    success: true,
    result: { engine, processingTimeMs: result.processingTimeMs },
    modelName: result.modelVersion,
    providerRequestId: result.providerRequestId,
  };
}

async function runDualVerify(ctx: PipelineContext): Promise<StepResult> {
  // Run both in parallel
  const [mistralResult, geminiResult] = await Promise.allSettled([
    ocrWithMistral(ctx.storagePath, ctx.document.mimeType, ctx.abortSignal),
    ocrWithGemini(ctx.storagePath, ctx.document.mimeType, ctx.abortSignal),
  ]);

  // Handle failures
  const mistralOk = mistralResult.status === 'fulfilled' ? mistralResult.value : null;
  const geminiOk = geminiResult.status === 'fulfilled' ? geminiResult.value : null;

  if (!mistralOk && !geminiOk) {
    const errors = [
      mistralResult.status === 'rejected' ? `Mistral: ${mistralResult.reason}` : null,
      geminiResult.status === 'rejected' ? `Gemini: ${geminiResult.reason}` : null,
    ].filter(Boolean).join('; ');
    return { success: false, error: `Both OCR engines failed: ${errors}` };
  }

  // Store both raw outputs
  if (mistralOk) {
    upsertOcrOutput(ctx.db, {
      documentId: ctx.document.id, engine: 'mistral',
      rawText: mistralOk.text, pageTexts: mistralOk.pageTexts || null,
      confidence: mistralOk.confidence || null,
      processingTimeMs: mistralOk.processingTimeMs,
      modelVersion: mistralOk.modelVersion || null,
      providerRequestId: mistralOk.providerRequestId || null,
    });
  }
  if (geminiOk) {
    upsertOcrOutput(ctx.db, {
      documentId: ctx.document.id, engine: 'gemini',
      rawText: geminiOk.text, pageTexts: geminiOk.pageTexts || null,
      confidence: geminiOk.confidence || null,
      processingTimeMs: geminiOk.processingTimeMs,
      modelVersion: geminiOk.modelVersion || null,
      providerRequestId: geminiOk.providerRequestId || null,
    });
  }

  const textResult = ctx.previousResults.text_extraction as TextExtractionResult | undefined;

  // If only one succeeded, use it
  if (!mistralOk && geminiOk) {
    upsertDocumentContent(ctx.db, {
      documentId: ctx.document.id,
      extractedText: geminiOk.text,
      extractionMethod: 'ocr_gemini',
      ocrConfidence: geminiOk.confidence || null,
      pageCount: textResult?.pageCount || null,
    });
    return {
      success: true,
      result: { mode: 'dual-verify', fallback: 'gemini', reason: 'Mistral failed' },
    };
  }
  if (!geminiOk && mistralOk) {
    upsertDocumentContent(ctx.db, {
      documentId: ctx.document.id,
      extractedText: mistralOk.text,
      extractionMethod: 'ocr_mistral',
      ocrConfidence: mistralOk.confidence || null,
      pageCount: textResult?.pageCount || null,
    });
    return {
      success: true,
      result: { mode: 'dual-verify', fallback: 'mistral', reason: 'Gemini failed' },
    };
  }

  // Both succeeded -- diff them
  if (mistralOk && geminiOk) {
    const diff = diffOcrResults(mistralOk, geminiOk, ctx.config.dualVerifyDiffThreshold);

    const chosenResult = diff.chosenEngine === 'mistral' ? mistralOk : geminiOk;

    upsertDocumentContent(ctx.db, {
      documentId: ctx.document.id,
      extractedText: chosenResult.text,
      extractionMethod: 'ocr_dual',
      ocrConfidence: diff.agreementScore,
      pageCount: textResult?.pageCount || null,
    });

    return {
      success: true,
      result: {
        mode: 'dual-verify',
        agreementScore: diff.agreementScore,
        mismatchPages: diff.mismatchPages,
        chosenEngine: diff.chosenEngine,
        needsReview: diff.needsReview,
        mistralTimeMs: mistralOk.processingTimeMs,
        geminiTimeMs: geminiOk.processingTimeMs,
      },
    };
  }

  // Fallback (shouldn't reach here)
  return { success: true, result: { mode: 'dual-verify', fallback: true } };
}

async function runMistralPrimaryGeminiVerify(ctx: PipelineContext): Promise<StepResult> {
  // Run Mistral first
  const mistralResult = await ocrWithMistral(ctx.storagePath, ctx.document.mimeType, ctx.abortSignal);

  upsertOcrOutput(ctx.db, {
    documentId: ctx.document.id, engine: 'mistral',
    rawText: mistralResult.text, pageTexts: mistralResult.pageTexts || null,
    confidence: mistralResult.confidence || null,
    processingTimeMs: mistralResult.processingTimeMs,
    modelVersion: mistralResult.modelVersion || null,
    providerRequestId: mistralResult.providerRequestId || null,
  });

  // Always verify with Gemini in this mode — confidence from OCR APIs is
  // unreliable or absent, so we always run the verification pass.
  // The config threshold is used by the diff logic, not as a gate here.
  const confidence = mistralResult.confidence ?? null;
  const shouldVerify = true; // always verify in this mode
  if (shouldVerify) {
    // Run Gemini as verification
    try {
      const geminiResult = await ocrWithGemini(ctx.storagePath, ctx.document.mimeType, ctx.abortSignal);
      upsertOcrOutput(ctx.db, {
        documentId: ctx.document.id, engine: 'gemini',
        rawText: geminiResult.text, pageTexts: geminiResult.pageTexts || null,
        confidence: geminiResult.confidence || null,
        processingTimeMs: geminiResult.processingTimeMs,
        modelVersion: geminiResult.modelVersion || null,
        providerRequestId: geminiResult.providerRequestId || null,
      });

      const diff = diffOcrResults(mistralResult, geminiResult, ctx.config.dualVerifyDiffThreshold);
      const chosenResult = diff.chosenEngine === 'mistral' ? mistralResult : geminiResult;

      const textResult = ctx.previousResults.text_extraction as TextExtractionResult | undefined;
      upsertDocumentContent(ctx.db, {
        documentId: ctx.document.id,
        extractedText: chosenResult.text,
        extractionMethod: 'ocr_dual',
        ocrConfidence: diff.agreementScore,
        pageCount: textResult?.pageCount || null,
      });

      return {
        success: true,
        result: { mode: 'mistral-primary-gemini-verify', verified: true, agreementScore: diff.agreementScore },
      };
    } catch {
      // Gemini verification failed -- use Mistral anyway
    }
  }

  // Use Mistral result
  const textResult = ctx.previousResults.text_extraction as TextExtractionResult | undefined;
  upsertDocumentContent(ctx.db, {
    documentId: ctx.document.id,
    extractedText: mistralResult.text,
    extractionMethod: 'ocr_mistral',
    ocrConfidence: confidence,
    pageCount: textResult?.pageCount || null,
  });

  return {
    success: true,
    result: { mode: 'mistral-primary-gemini-verify', verified: false },
    modelName: mistralResult.modelVersion,
  };
}
