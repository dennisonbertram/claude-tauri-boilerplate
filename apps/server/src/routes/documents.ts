import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDocument, getDocument, listDocuments, updateDocument, deleteDocument } from '../db';
import { mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';

const DOCUMENTS_DIR = join(process.env.HOME || '~', '.claude-tauri', 'documents');

export function createDocumentsRouter(db: Database) {
  const router = new Hono();

  // POST /upload — multipart form upload
  router.post('/upload', async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || typeof file === 'string') {
      return c.json({ error: 'No file provided', code: 'VALIDATION_ERROR' }, 400);
    }

    const id = crypto.randomUUID();
    const ext = extname(file.name || 'file') || '';
    const storageFilename = `${id}${ext}`;

    mkdirSync(DOCUMENTS_DIR, { recursive: true });
    const storagePath = join(DOCUMENTS_DIR, storageFilename);

    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(storagePath, arrayBuffer);

    const document = createDocument(db, {
      id,
      filename: file.name || 'untitled',
      storagePath,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      status: 'ready',
      sessionId: (typeof body['sessionId'] === 'string' ? body['sessionId'] : null),
    });

    return c.json({ document }, 201);
  });

  // GET / — list documents
  router.get('/', (c) => {
    const status = c.req.query('status');
    const mimeType = c.req.query('mimeType');
    const search = c.req.query('search');

    const documents = listDocuments(db, {
      status: status || undefined,
      mimeType: mimeType || undefined,
      search: search || undefined,
    });

    return c.json(documents);
  });

  // GET /:id — get single document
  router.get('/:id', (c) => {
    const id = c.req.param('id');
    // Avoid matching the "file" sub-route
    if (id === 'upload') return c.notFound();
    const document = getDocument(db, id);
    if (!document) {
      return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json(document);
  });

  // GET /:id/file — serve actual file
  router.get('/:id/file', async (c) => {
    const id = c.req.param('id');
    const document = getDocument(db, id);
    if (!document) {
      return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    }

    const file = Bun.file(document.storagePath);
    const exists = await file.exists();
    if (!exists) {
      return c.json({ error: 'File not found on disk', code: 'NOT_FOUND' }, 404);
    }

    const isInline = document.mimeType.startsWith('image/') || document.mimeType === 'application/pdf';
    const disposition = isInline ? 'inline' : `attachment; filename="${document.filename}"`;

    return new Response(file.stream(), {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': disposition,
      },
    });
  });

  // GET /:id/content — serve raw text content for preview
  router.get('/:id/content', async (c) => {
    const id = c.req.param('id');
    const document = getDocument(db, id);
    if (!document) {
      return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    }

    // Only serve text-based mime types
    const textMimePatterns = [
      'text/',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript',
      'application/x-yaml',
      'application/toml',
      'application/sql',
      'application/x-sh',
    ];
    const isText = textMimePatterns.some((p) => document.mimeType.startsWith(p));
    // Also check common text file extensions for cases where mime type is generic
    const textExtensions = [
      '.md', '.mdx', '.txt', '.log', '.json', '.csv', '.tsv',
      '.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go', '.java',
      '.c', '.cpp', '.h', '.rb', '.php', '.swift', '.kt',
      '.sh', '.bash', '.zsh', '.yaml', '.yml', '.toml', '.xml',
      '.html', '.css', '.scss', '.sql', '.svg',
    ];
    const ext = extname(document.filename).toLowerCase();
    const isTextByExt = textExtensions.includes(ext);

    if (!isText && !isTextByExt) {
      return c.json(
        { error: 'Content preview not available for this file type', code: 'UNSUPPORTED_TYPE' },
        415,
      );
    }

    const file = Bun.file(document.storagePath);
    const exists = await file.exists();
    if (!exists) {
      return c.json({ error: 'File not found on disk', code: 'NOT_FOUND' }, 404);
    }

    // Limit to 500KB
    const MAX_SIZE = 500 * 1024;
    const size = file.size;
    let content: string;
    if (size > MAX_SIZE) {
      const buffer = await file.slice(0, MAX_SIZE).text();
      content = buffer + '\n\n... (truncated, file is ' + (size / 1024).toFixed(0) + ' KB)';
    } else {
      content = await file.text();
    }

    return new Response(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  });

  // PATCH /:id — update tags
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const document = getDocument(db, id);
    if (!document) {
      return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON in request body', code: 'VALIDATION_ERROR' }, 400);
    }

    const data = bodyRaw as Record<string, unknown>;
    if (!data.tags || !Array.isArray(data.tags)) {
      return c.json({ error: 'tags must be an array of strings', code: 'VALIDATION_ERROR' }, 400);
    }

    const updated = updateDocument(db, id, { tags: data.tags as string[] });
    return c.json(updated);
  });

  // POST /:id/open — open document with system default app
  router.post('/:id/open', async (c) => {
    const id = c.req.param('id');
    const document = getDocument(db, id);
    if (!document) {
      return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    }

    try {
      const proc = Bun.spawn(['open', document.storagePath]);
      await proc.exited;
      if (proc.exitCode !== 0) {
        return c.json({ error: 'Failed to open file', code: 'OPEN_ERROR' }, 500);
      }
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: 'Failed to open file', code: 'OPEN_ERROR' }, 500);
    }
  });

  // DELETE /:id — delete document and file
  router.delete('/:id', (c) => {
    const id = c.req.param('id');
    const document = getDocument(db, id);
    if (!document) {
      return c.json({ error: 'Document not found', code: 'NOT_FOUND' }, 404);
    }

    const storagePath = deleteDocument(db, id);
    if (storagePath) {
      try {
        unlinkSync(storagePath);
      } catch {
        // File may already be gone — that's fine
      }
    }

    return c.json({ success: true });
  });

  return router;
}
