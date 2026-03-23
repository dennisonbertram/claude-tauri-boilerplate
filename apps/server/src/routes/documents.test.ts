import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createDocument, getDocument } from '../db';
import { createDocumentsRouter } from './documents';
import { errorHandler } from '../middleware/error-handler';

let db: Database;
let app: Hono;

beforeEach(() => {
  db = createDb(':memory:');

  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/documents', createDocumentsRouter(db));
});

afterEach(() => {
  if (db) db.close();
});

// ─── POST /api/documents/upload ──────────────────────────────────────────────

describe('POST /api/documents/upload', () => {
  test('uploads a document and returns 201 with document data', async () => {
    const fileContent = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const formData = new FormData();
    formData.append('file', new File([fileContent], 'test.txt', { type: 'text/plain' }));

    const res = await app.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(201);

    const body = await res.json() as any;
    expect(body.document).toBeDefined();
    expect(body.document.filename).toBe('test.txt');
    expect(body.document.mimeType).toStartWith('text/plain');
    expect(body.document.sizeBytes).toBe(5);
    expect(body.document.status).toBe('ready');
    expect(body.document.tags).toEqual([]);
    expect(body.document.pipelineSteps).toEqual([]);
    expect(body.document.id).toBeDefined();
    expect(body.document.storagePath).toContain(body.document.id);
  });

  test('returns 400 when no file provided', async () => {
    const formData = new FormData();
    formData.append('other', 'value');

    const res = await app.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── GET /api/documents ──────────────────────────────────────────────────────

describe('GET /api/documents', () => {
  test('returns empty array when no documents', async () => {
    const res = await app.request('/api/documents');
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  test('returns all documents', async () => {
    createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'doc1.pdf',
      storagePath: '/tmp/doc1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'doc2.txt',
      storagePath: '/tmp/doc2.txt',
      mimeType: 'text/plain',
      sizeBytes: 512,
    });

    const res = await app.request('/api/documents');
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body).toHaveLength(2);
  });

  test('filters by status', async () => {
    createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'ready.pdf',
      storagePath: '/tmp/ready.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      status: 'ready',
    });
    createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'processing.pdf',
      storagePath: '/tmp/processing.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      status: 'processing',
    });

    const res = await app.request('/api/documents?status=ready');
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body).toHaveLength(1);
    expect(body[0].filename).toBe('ready.pdf');
  });

  test('filters by mimeType', async () => {
    createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'doc.pdf',
      storagePath: '/tmp/doc-mime.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'doc.txt',
      storagePath: '/tmp/doc-mime.txt',
      mimeType: 'text/plain',
      sizeBytes: 512,
    });

    const res = await app.request('/api/documents?mimeType=text/plain');
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body).toHaveLength(1);
    expect(body[0].filename).toBe('doc.txt');
  });

  test('searches by filename', async () => {
    createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'report-2024.pdf',
      storagePath: '/tmp/report-search.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'invoice.pdf',
      storagePath: '/tmp/invoice-search.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 512,
    });

    const res = await app.request('/api/documents?search=report');
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body).toHaveLength(1);
    expect(body[0].filename).toBe('report-2024.pdf');
  });
});

// ─── GET /api/documents/:id ──────────────────────────────────────────────────

describe('GET /api/documents/:id', () => {
  test('returns 404 for non-existent document', async () => {
    const res = await app.request('/api/documents/nonexistent-id');
    expect(res.status).toBe(404);

    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns document by id', async () => {
    const doc = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'myfile.txt',
      storagePath: '/tmp/myfile-get.txt',
      mimeType: 'text/plain',
      sizeBytes: 256,
    });

    const res = await app.request(`/api/documents/${doc.id}`);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.id).toBe(doc.id);
    expect(body.filename).toBe('myfile.txt');
    expect(body.mimeType).toBe('text/plain');
    expect(body.sizeBytes).toBe(256);
  });
});

// ─── GET /api/documents/:id/file ────────────────────────────────────────────

describe('GET /api/documents/:id/file', () => {
  test('returns 404 for non-existent document', async () => {
    const res = await app.request('/api/documents/nonexistent-id/file');
    expect(res.status).toBe(404);
  });

  test('serves file with correct headers for uploaded document', async () => {
    // Upload a real file first
    const fileContent = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const formData = new FormData();
    formData.append('file', new File([fileContent], 'hello.txt', { type: 'text/plain' }));

    const uploadRes = await app.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    const uploadBody = await uploadRes.json() as any;
    const docId = uploadBody.document.id;

    const res = await app.request(`/api/documents/${docId}/file`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toStartWith('text/plain');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');

    const text = await res.text();
    expect(text).toBe('Hello');
  });

  test('serves image file with inline disposition', async () => {
    const fileContent = new Uint8Array([137, 80, 78, 71]); // PNG header bytes
    const formData = new FormData();
    formData.append('file', new File([fileContent], 'image.png', { type: 'image/png' }));

    const uploadRes = await app.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    const uploadBody = await uploadRes.json() as any;
    const docId = uploadBody.document.id;

    const res = await app.request(`/api/documents/${docId}/file`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Disposition')).toBe('inline');
  });
});

// ─── PATCH /api/documents/:id ────────────────────────────────────────────────

describe('PATCH /api/documents/:id', () => {
  test('returns 404 for non-existent document', async () => {
    const res = await app.request('/api/documents/nonexistent-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['test'] }),
    });
    expect(res.status).toBe(404);
  });

  test('updates tags successfully', async () => {
    const doc = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'taggable.txt',
      storagePath: '/tmp/taggable.txt',
      mimeType: 'text/plain',
      sizeBytes: 100,
    });

    const res = await app.request(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['important', 'review'] }),
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.tags).toEqual(['important', 'review']);
  });

  test('returns 400 when tags is not an array', async () => {
    const doc = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'bad-tags.txt',
      storagePath: '/tmp/bad-tags.txt',
      mimeType: 'text/plain',
      sizeBytes: 100,
    });

    const res = await app.request(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: 'not-an-array' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('tag update persists in DB', async () => {
    const doc = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'persist-tags.txt',
      storagePath: '/tmp/persist-tags.txt',
      mimeType: 'text/plain',
      sizeBytes: 100,
    });

    await app.request(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['persisted'] }),
    });

    const fetched = getDocument(db, doc.id);
    expect(fetched?.tags).toEqual(['persisted']);
  });
});

// ─── DELETE /api/documents/:id ──────────────────────────────────────────────

describe('DELETE /api/documents/:id', () => {
  test('returns 404 for non-existent document', async () => {
    const res = await app.request('/api/documents/nonexistent-id', {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });

  test('deletes document from DB', async () => {
    const doc = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'deleteme.txt',
      storagePath: '/tmp/deleteme-test.txt',
      mimeType: 'text/plain',
      sizeBytes: 100,
    });

    const res = await app.request(`/api/documents/${doc.id}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.success).toBe(true);

    // Verify it's gone from DB
    const fetched = getDocument(db, doc.id);
    expect(fetched).toBeNull();
  });

  test('deletes uploaded document and cleans up file', async () => {
    // Upload a real file
    const fileContent = new Uint8Array([72, 101, 108, 108, 111]);
    const formData = new FormData();
    formData.append('file', new File([fileContent], 'cleanup.txt', { type: 'text/plain' }));

    const uploadRes = await app.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    const uploadBody = await uploadRes.json() as any;
    const docId = uploadBody.document.id;
    const storagePath = uploadBody.document.storagePath;

    // Verify file exists
    const fileExists = await Bun.file(storagePath).exists();
    expect(fileExists).toBe(true);

    // Delete
    const res = await app.request(`/api/documents/${docId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);

    // Verify file is gone
    const fileExistsAfter = await Bun.file(storagePath).exists();
    expect(fileExistsAfter).toBe(false);

    // Verify DB record is gone
    const fetched = getDocument(db, docId);
    expect(fetched).toBeNull();
  });
});
