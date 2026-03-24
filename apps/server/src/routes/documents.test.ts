import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createDocument, getDocument, listDocuments } from '../db';
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

// ─── DELETE /api/documents/bulk ──────────────────────────────────────────────

describe('DELETE /api/documents/bulk', () => {
  test('returns 400 when ids is missing', async () => {
    const res = await app.request('/api/documents/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when ids is empty array', async () => {
    const res = await app.request('/api/documents/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when body is invalid JSON', async () => {
    const res = await app.request('/api/documents/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('deletes multiple documents from DB', async () => {
    const doc1 = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'bulk1.txt',
      storagePath: '/tmp/bulk1.txt',
      mimeType: 'text/plain',
      sizeBytes: 100,
    });
    const doc2 = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'bulk2.txt',
      storagePath: '/tmp/bulk2.txt',
      mimeType: 'text/plain',
      sizeBytes: 200,
    });
    const doc3 = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'bulk3.txt',
      storagePath: '/tmp/bulk3.txt',
      mimeType: 'text/plain',
      sizeBytes: 300,
    });

    const res = await app.request('/api/documents/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [doc1.id, doc2.id] }),
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.deletedCount).toBe(2);

    // Verify doc1 and doc2 are gone
    expect(getDocument(db, doc1.id)).toBeNull();
    expect(getDocument(db, doc2.id)).toBeNull();

    // doc3 should still exist
    expect(getDocument(db, doc3.id)).not.toBeNull();
  });

  test('handles non-existent ids gracefully', async () => {
    const doc = createDocument(db, {
      id: crypto.randomUUID(),
      filename: 'exists.txt',
      storagePath: '/tmp/exists.txt',
      mimeType: 'text/plain',
      sizeBytes: 100,
    });

    const res = await app.request('/api/documents/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [doc.id, 'nonexistent-id'] }),
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.success).toBe(true);
    // Only 1 actually existed and was deleted
    expect(body.deletedCount).toBe(1);

    expect(getDocument(db, doc.id)).toBeNull();
  });

  test('deletes uploaded documents and cleans up files', async () => {
    // Upload two real files
    const formData1 = new FormData();
    formData1.append('file', new File([new Uint8Array([1, 2, 3])], 'bulk-file1.txt', { type: 'text/plain' }));
    const upload1 = await app.request('/api/documents/upload', { method: 'POST', body: formData1 });
    const uploadBody1 = await upload1.json() as any;

    const formData2 = new FormData();
    formData2.append('file', new File([new Uint8Array([4, 5, 6])], 'bulk-file2.txt', { type: 'text/plain' }));
    const upload2 = await app.request('/api/documents/upload', { method: 'POST', body: formData2 });
    const uploadBody2 = await upload2.json() as any;

    const id1 = uploadBody1.document.id;
    const id2 = uploadBody2.document.id;
    const path1 = uploadBody1.document.storagePath;
    const path2 = uploadBody2.document.storagePath;

    // Verify files exist
    expect(await Bun.file(path1).exists()).toBe(true);
    expect(await Bun.file(path2).exists()).toBe(true);

    // Bulk delete
    const res = await app.request('/api/documents/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id1, id2] }),
    });
    expect(res.status).toBe(200);

    // Verify files are gone
    expect(await Bun.file(path1).exists()).toBe(false);
    expect(await Bun.file(path2).exists()).toBe(false);

    // Verify DB records are gone
    expect(getDocument(db, id1)).toBeNull();
    expect(getDocument(db, id2)).toBeNull();
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
