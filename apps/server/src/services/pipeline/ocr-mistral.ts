import type { OcrResult } from './types';

export async function ocrWithMistral(filePath: string, mimeType: string, signal?: AbortSignal): Promise<OcrResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY environment variable is required for Mistral OCR');

  const startTime = Date.now();

  // Read file as base64
  const fileBuffer = await Bun.file(filePath).arrayBuffer();
  const base64 = Buffer.from(fileBuffer).toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // Use Mistral's OCR endpoint via the SDK
  const { Mistral } = await import('@mistralai/mistralai');
  const client = new Mistral({ apiKey });

  // Mistral OCR API - use the ocr.process endpoint
  const result = await client.ocr.process({
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      documentUrl: dataUrl,
    },
  });

  // Extract text from pages
  const pageTexts = result.pages?.map((p: { markdown?: string; text?: string }) => p.markdown || p.text || '') ?? [];
  const fullText = pageTexts.join('\n\n---PAGE BREAK---\n\n');

  return {
    text: fullText,
    pageTexts,
    engine: 'mistral',
    processingTimeMs: Date.now() - startTime,
    modelVersion: 'mistral-ocr-latest',
    providerRequestId: (result as unknown as { id?: string }).id,
  };
}
