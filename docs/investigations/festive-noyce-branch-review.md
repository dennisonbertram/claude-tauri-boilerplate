# Branch Review: `claude/festive-noyce`

**Commits** (2 total on top of main):
1. `96da4f9` — feat: add document management with upload, preview, and file organization
2. `e0a1c9f` — fix(ci): add packageManager field for pnpm/action-setup@v4

**Files changed**: 18 files, +2466 / -205 lines

---

## What the Branch Adds

### Feature: Full Document Management System

A complete document upload, storage, preview, and management feature spanning backend API, database layer, shared types, and frontend UI.

### API Endpoints (`apps/server/src/routes/documents.ts`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/documents/upload` | Multipart form upload (file + optional sessionId) |
| `GET` | `/api/documents` | List documents with optional `status`, `mimeType`, `search` filters |
| `GET` | `/api/documents/:id` | Get single document metadata |
| `GET` | `/api/documents/:id/file` | Serve the raw file (inline for images/PDFs, attachment otherwise) |
| `GET` | `/api/documents/:id/content` | Serve raw text content for text-based files (capped at 500KB) |
| `PATCH` | `/api/documents/:id` | Update tags (array of strings) |
| `POST` | `/api/documents/:id/open` | Open file with macOS `open` command |
| `DELETE` | `/api/documents/:id` | Delete document record + file from disk |

### UI Components (`apps/desktop/src/components/documents/`)

- **DocumentsView** — Main view with gallery/table toggle, search bar, drag-and-drop upload zone
- **DocumentCard** — Grid card with file icon, name, size, date
- **DocumentTable** — Tabular list view
- **DocumentUploadZone** — Drag-and-drop overlay for file uploads
- **DocumentContextMenu** — Right-click menu (open, delete, tag, open on computer)
- **DocumentPreviewModal** — In-app preview modal supporting text content preview and image/PDF rendering

### Frontend Data Layer

- **`useDocuments` hook** — React hook wrapping CRUD operations (fetch, upload, remove, updateTags) with local state
- **`documents-api.ts`** — Typed API client functions for all endpoints
- **`format-utils.ts`** — File size formatting helpers

### Shared Types (`packages/shared/src/types.ts`)

- `Document` — Core document interface (id, filename, storagePath, mimeType, sizeBytes, status, pipelineSteps, tags, sessionId, timestamps)
- `DocumentStatus` — `'uploading' | 'processing' | 'ready' | 'error'`
- `DocumentPipelineStep` — Step tracking interface (name, status, result, error, timestamps)
- `UploadDocumentResponse` — API response wrapper

---

## How Document Upload Works

### Storage

Files are stored on the local filesystem at `~/.claude-tauri/documents/`. Each file is renamed to `{uuid}{original-extension}` to avoid collisions. The directory is created on first upload via `mkdirSync(recursive: true)`.

### DB Schema (`documents` table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `filename` | TEXT | Original filename |
| `storage_path` | TEXT UNIQUE | Absolute path on disk |
| `mime_type` | TEXT | From upload |
| `size_bytes` | INTEGER | File size |
| `status` | TEXT | `uploading`, `processing`, `ready`, `error` |
| `pipeline_steps` | TEXT (JSON) | Array of pipeline step objects |
| `tags` | TEXT (JSON) | Array of tag strings |
| `session_id` | TEXT | Optional FK to sessions |
| `created_at` / `updated_at` | TEXT | ISO timestamps |

Indexes on: `status`, `created_at`, `mime_type`.

Migration is idempotent (`migrateDocumentsTable`) — checks if the table exists before creating.

### Upload Flow

1. Frontend: user drops files or clicks upload button
2. `useDocuments.upload()` iterates files, calls `uploadDocument()` per file
3. `uploadDocument()` sends multipart `POST /api/documents/upload`
4. Server generates UUID, derives storage filename (`{uuid}{ext}`), writes to `~/.claude-tauri/documents/`
5. Creates DB row with status `'ready'` (no async processing currently)
6. Returns document metadata to frontend
7. Frontend prepends new documents to local state

### File Serving

- `/api/documents/:id/file` — streams the file with appropriate `Content-Type` and `Content-Disposition` (inline for images/PDFs, attachment for others)
- `/api/documents/:id/content` — returns plain text for text-based files, 500KB cap with truncation notice

---

## Pipeline/Processing Infrastructure

The schema includes `pipeline_steps` (JSON array of `DocumentPipelineStep`) and a `status` field with states `uploading → processing → ready | error`. However, **no actual processing pipeline is implemented yet**. All uploads go directly to `status: 'ready'` with an empty `pipeline_steps` array.

The `DocumentPipelineStep` interface defines:
- `name`, `status` (`pending | running | completed | failed | skipped`)
- `result` (arbitrary), `error` (string)
- `startedAt`, `completedAt` timestamps

The `updateDocument` DB function supports updating `status`, `tags`, and `pipelineSteps`, providing the write path for a future pipeline. The schema is ready for processing stages (e.g., text extraction, embedding, chunking) but none are wired up.

---

## Test Coverage

`apps/server/src/routes/documents.test.ts` — 390 lines of tests covering upload, list, get, update tags, delete, file serving, and content preview endpoints.
