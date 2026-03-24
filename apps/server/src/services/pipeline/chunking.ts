import { createHash } from 'crypto';
import type { PipelineContext, StepResult } from './types';
import { getDocumentContent, insertChunks, deleteChunksForDocument } from '../../db';

export async function executeChunking(ctx: PipelineContext): Promise<StepResult> {
  const content = getDocumentContent(ctx.db, ctx.document.id);
  if (!content?.extractedText) {
    return { success: true, skip: true, result: { reason: 'No extracted text to chunk' } };
  }

  const { chunkTargetTokens, chunkOverlapTokens, embeddingProvider, embeddingModel } = ctx.config;
  const text = content.extractedText;

  // Split into chunks
  const chunks = splitIntoChunks(text, chunkTargetTokens, chunkOverlapTokens);

  if (chunks.length === 0) {
    return { success: true, skip: true, result: { reason: 'Text too short to chunk' } };
  }

  // Generate embeddings if API key is available
  let embeddings: Float32Array[] | null = null;
  let embeddingDim: number | null = null;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && embeddingProvider === 'openai') {
    try {
      const result = await generateOpenAIEmbeddings(
        chunks.map(c => c.content),
        embeddingModel || 'text-embedding-3-small',
        openaiKey,
        ctx.abortSignal,
      );
      embeddings = result.embeddings;
      embeddingDim = result.dim;
    } catch (error) {
      // Non-fatal: store chunks without embeddings
      console.warn('[pipeline] Embedding generation failed:', error);
    }
  }

  // Delete existing chunks (idempotent reprocessing)
  deleteChunksForDocument(ctx.db, ctx.document.id);

  // Insert chunks
  const chunkRecords = chunks.map((chunk, i) => ({
    chunkIndex: i,
    content: chunk.content,
    contentHash: createHash('sha256').update(chunk.content).digest('hex'),
    tokenCount: chunk.tokenCount,
    charOffsetStart: chunk.charOffsetStart,
    charOffsetEnd: chunk.charOffsetEnd,
    pageNumber: chunk.pageNumber || null,
    embedding: embeddings?.[i] ? Buffer.from(embeddings[i].buffer) : null,
    embeddingModel: embeddings ? embeddingModel : null,
    embeddingDim: embeddingDim,
    overlapTokens: chunkOverlapTokens,
  }));

  const inserted = insertChunks(ctx.db, ctx.document.id, chunkRecords);

  return {
    success: true,
    result: {
      chunkCount: inserted,
      totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
      hasEmbeddings: !!embeddings,
      embeddingModel: embeddings ? embeddingModel : null,
      embeddingDim,
    },
  };
}

interface ChunkData {
  content: string;
  tokenCount: number;
  charOffsetStart: number;
  charOffsetEnd: number;
  pageNumber?: number;
}

function splitIntoChunks(text: string, targetTokens: number, overlapTokens: number): ChunkData[] {
  const chunks: ChunkData[] = [];

  // Approximate tokens: ~4 chars per token for English
  const charsPerToken = 4;
  const targetChars = targetTokens * charsPerToken;
  const overlapChars = overlapTokens * charsPerToken;

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = '';
  let currentStart = 0;
  let charOffset = 0;

  for (const para of paragraphs) {
    const paraWithBreak = currentChunk ? '\n\n' + para : para;

    if (currentChunk.length + paraWithBreak.length > targetChars && currentChunk.length > 0) {
      // Current chunk is full, save it
      chunks.push({
        content: currentChunk.trim(),
        tokenCount: Math.ceil(currentChunk.length / charsPerToken),
        charOffsetStart: currentStart,
        charOffsetEnd: currentStart + currentChunk.length,
      });

      // Start new chunk with overlap
      if (overlapChars > 0 && currentChunk.length > overlapChars) {
        const overlapText = currentChunk.substring(currentChunk.length - overlapChars);
        currentChunk = overlapText + '\n\n' + para;
        currentStart = currentStart + currentChunk.length - overlapChars - para.length - 2;
      } else {
        currentChunk = para;
        currentStart = charOffset;
      }
    } else {
      currentChunk += paraWithBreak;
    }

    charOffset += para.length + 2; // +2 for the \n\n
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      tokenCount: Math.ceil(currentChunk.length / charsPerToken),
      charOffsetStart: currentStart,
      charOffsetEnd: currentStart + currentChunk.length,
    });
  }

  return chunks;
}

async function generateOpenAIEmbeddings(
  texts: string[],
  model: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ embeddings: Float32Array[]; dim: number }> {
  const BATCH_SIZE = 100;
  const allEmbeddings: Float32Array[] = [];
  let dim = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    // Retry with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: batch,
            encoding_format: 'float',
          }),
          signal,
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited -- wait and retry
            const waitMs = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }
          throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
        }

        const data = await response.json() as {
          data: Array<{ embedding: number[] }>;
        };

        for (const item of data.data) {
          allEmbeddings.push(new Float32Array(item.embedding));
          dim = item.embedding.length;
        }
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (lastError) throw lastError;
  }

  return { embeddings: allEmbeddings, dim };
}
