import type { OcrResult } from './types';

export async function ocrWithGemini(filePath: string, mimeType: string, signal?: AbortSignal): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY environment variable is required for Gemini OCR');

  const startTime = Date.now();

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });

  const fileBuffer = await Bun.file(filePath).arrayBuffer();
  const base64 = Buffer.from(fileBuffer).toString('base64');

  const result = await model.generateContent([
    'Extract all text from this document. Preserve layout, tables, and structure. Output as clean markdown. Do not add commentary.',
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
  ]);

  const text = result.response.text();

  return {
    text,
    engine: 'gemini',
    processingTimeMs: Date.now() - startTime,
    modelVersion: 'gemini-2.5-flash-preview-04-17',
  };
}
