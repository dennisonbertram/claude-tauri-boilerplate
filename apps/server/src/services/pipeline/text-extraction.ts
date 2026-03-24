import { extname } from 'node:path';
import { getDocumentProxy, extractText } from 'unpdf';
import type { PipelineContext, StepResult, TextExtractionResult, PageAnalysis } from './types';

const TEXT_MIME_PATTERNS = [
  'text/',
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-yaml',
  'application/toml',
  'application/sql',
  'application/x-sh',
];

const TEXT_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.log', '.json', '.csv', '.tsv',
  '.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.rb', '.php', '.swift', '.kt',
  '.sh', '.bash', '.zsh', '.yaml', '.yml', '.toml', '.xml',
  '.html', '.css', '.scss', '.sql', '.svg',
]);

/** Minimum average chars per page to consider a PDF as having embedded text */
const MIN_CHARS_PER_PAGE = 50;

/** Binary document formats that need OCR, not text reading */
const BINARY_EXTENSIONS = new Set([
  '.docx', '.xlsx', '.xls', '.pptx', '.ppt',
  '.doc', '.odt', '.ods', '.odp',
  '.rtf', '.epub', '.mobi',
]);

export async function executeTextExtraction(ctx: PipelineContext): Promise<StepResult> {
  const { document, storagePath } = ctx;
  const mimeType = document.mimeType;

  try {
    const ext = extname(document.filename).toLowerCase();

    // Binary document formats — can't read as text, need OCR
    if (BINARY_EXTENSIONS.has(ext)) {
      return handleImage(); // route to OCR
    }

    // Text-based files: read directly
    const isTextMime = TEXT_MIME_PATTERNS.some((p) => mimeType.startsWith(p));
    const isTextExt = TEXT_EXTENSIONS.has(ext);

    if (isTextMime || isTextExt) {
      return handleTextFile(storagePath);
    }

    if (mimeType === 'application/pdf') {
      return handlePdf(storagePath);
    }

    if (mimeType.startsWith('image/')) {
      return handleImage();
    }

    // Unknown type — check if it looks like text by reading a small sample
    try {
      const file = Bun.file(storagePath);
      const sample = Buffer.from(await file.slice(0, 512).arrayBuffer());
      // Check for null bytes — a strong indicator of binary content
      const hasNullBytes = sample.includes(0);
      if (hasNullBytes) {
        return handleImage(); // binary file, route to OCR
      }
      return handleTextFile(storagePath);
    } catch {
      return handleImage();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Text extraction failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleTextFile(storagePath: string): Promise<StepResult> {
  const file = Bun.file(storagePath);
  const exists = await file.exists();
  if (!exists) {
    return { success: false, error: `File not found: ${storagePath}` };
  }

  const text = await file.text();

  const result: TextExtractionResult = {
    text,
    needsOcr: false,
    pageCount: 1,
    method: 'direct_read',
  };

  return { success: true, result };
}

async function handlePdf(storagePath: string): Promise<StepResult> {
  const file = Bun.file(storagePath);
  const exists = await file.exists();
  if (!exists) {
    return { success: false, error: `PDF file not found: ${storagePath}` };
  }

  let data: Uint8Array;
  try {
    data = new Uint8Array(await file.arrayBuffer());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to read PDF file: ${message}` };
  }

  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    doc = await getDocumentProxy(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Corrupt or unsupported PDF: ${message}` };
  }

  try {
    const { totalPages, text: fullText } = await extractText(doc, { mergePages: false });

    // extractText with mergePages:false returns text as string[] (one per page)
    const pageTexts = Array.isArray(fullText) ? fullText : [fullText];

    const pages: PageAnalysis[] = pageTexts.map((pageText, i) => {
      const content = typeof pageText === 'string' ? pageText : '';
      return {
        pageNumber: i + 1,
        hasEmbeddedText: content.trim().length >= MIN_CHARS_PER_PAGE,
        textContent: content,
        charCount: content.length,
      };
    });

    const totalChars = pages.reduce((sum, p) => sum + p.charCount, 0);
    const avgCharsPerPage = totalPages > 0 ? totalChars / totalPages : 0;
    const needsOcr = avgCharsPerPage < MIN_CHARS_PER_PAGE;

    const combinedText = pages.map((p) => p.textContent).join('\n\n');

    const result: TextExtractionResult = {
      text: needsOcr ? null : combinedText,
      needsOcr,
      pageCount: totalPages,
      pages,
      method: needsOcr ? 'needs_ocr' : 'embedded',
    };

    return { success: true, result };
  } finally {
    doc.destroy();
  }
}

function handleImage(): StepResult {
  const result: TextExtractionResult = {
    text: null,
    needsOcr: true,
    pageCount: 1,
    method: 'needs_ocr',
  };

  return { success: true, result };
}
