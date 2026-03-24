Overall: **FAIL as written for merge**, though the direction is good.

For a **single-user desktop app**, an in-process worker is a reasonable baseline. But the current plan has too many gaps around **claiming work, crash recovery, step persistence, reprocessing hygiene, and retrieval design** to be considered production-safe even for local use.

## 1) Architecture soundness — **FAIL**
**Why:** The pattern is acceptable; the implementation details are not.

### What is sound
- **In-process background worker** is a valid choice for a desktop app.
- **Single-document concurrency** is also reasonable.
- **Step registry + step executor pattern** is clean and extensible.

### Critical issues
1. **`isProcessing` is only process-local**
   - It prevents overlap inside one module instance only.
   - It does **not** protect against:
     - two app instances,
     - hot reload / dev restart,
     - trigger route racing with poller,
     - multiple server processes accidentally opened.
   - Result: same document can be processed twice.

2. **No atomic claim/lease**
   - Querying `documents WHERE status IN ('uploading','processing') LIMIT 1` is not enough.
   - You need an atomic transition like:
     - claim queued doc,
     - set `status='processing'`,
     - set `worker_id`, `lease_expires_at`, `started_at`.
   - Otherwise polling and manual trigger can both pick the same document.

3. **`uploading` is the wrong queue state**
   - Worker polling `status='uploading'` risks processing a file before the upload/write is complete.
   - You need at least:
     - `uploaded` or `queued`
     - `processing`
     - `ready`
     - `error`
   - `uploading` should mean “file write not complete yet”.

4. **Crash recovery is missing**
   - If the app dies mid-step:
     - document stays `processing`,
     - step may remain `running`,
     - next startup has no recovery policy.
   - Worse: your loop only runs steps with `status === 'pending'`.
     - A stale `running` step may never be retried.
   - You need stale-lease detection and `running -> pending/error` recovery on startup.

5. **No persisted step execution model**
   - The plan references `pipeline_steps`, but the 5 new tables do **not** include a step-runs table.
   - If step state is stored as JSON on `documents`, that is fragile:
     - read-modify-write races,
     - hard to query,
     - hard to retry correctly,
     - hard to audit.
   - This is the single biggest schema/architecture omission.

6. **Re-trigger / retry semantics are unsafe**
   - `POST /trigger/:documentId` resets to `uploading` and re-inits steps.
   - What if the worker is already processing it?
   - What happens to old chunks/entities/content?
   - Without locking + cleanup, you will produce inconsistent state or duplicates.

7. **`previousResults` is underspecified**
   - If it’s only in-memory, restart loses it.
   - If it is reconstructed from persisted step results, you need a durable store for step outputs.

### Minimum fix
- Add a **DB-backed claim/lease model**.
- Add a **`document_pipeline_steps` or `document_processing_runs` table**.
- Change upload flow to queue only **after** file is fully saved and fsynced.
- Add **startup recovery** for stale `processing/running` work.

---

## 2) Schema design — **FAIL**
**Why:** The tables are usable for a prototype, but not well-normalized enough for retries/audit, and the indexing strategy is incomplete.

### Specific issues

1. **Missing step/run table**
   - You’re building a multi-step pipeline without a relational table for:
     - step name,
     - status,
     - started/completed times,
     - attempts,
     - error message,
     - result summary.
   - Storing this in `documents.pipeline_steps` JSON is a bad long-term design.

2. **`document_content` is too overloaded**
   - It mixes:
     - extracted text,
     - OCR metadata,
     - structured extraction,
     - generic metadata.
   - That is convenient, but it makes versioning/reprocessing weak.
   - If you re-run with a different OCR engine or a new prompt/model, you overwrite prior results.

3. **No place to store raw OCR outputs from both engines**
   - In dual mode you need to keep:
     - Mistral output,
     - Gemini output,
     - diff summary,
     - chosen winner,
     - reason.
   - Current schema only stores one final `extracted_text`.

4. **`entity_relationships.document_id` is redundant and risky**
   - You can infer document via both entities.
   - Keeping `document_id` adds a consistency risk unless you enforce same-document edges.
   - SQLite cannot easily enforce “source and target belong to same document” with current schema.

5. **Missing indexes**
   At minimum you need:
   ```sql
   CREATE INDEX idx_documents_status_created_at ON documents(status, created_at);
   CREATE INDEX idx_document_chunks_document_id_chunk ON document_chunks(document_id, chunk_index);
   CREATE INDEX idx_entities_document_id ON entities(document_id);
   CREATE INDEX idx_entities_document_norm ON entities(document_id, entity_type, normalized_value);
   CREATE INDEX idx_entity_relationships_document_id ON entity_relationships(document_id);
   CREATE INDEX idx_entity_relationships_source ON entity_relationships(source_entity_id);
   CREATE INDEX idx_entity_relationships_target ON entity_relationships(target_entity_id);
   ```
   Without these, status polling and per-doc fetches will degrade quickly.

6. **JSON stored as plain TEXT with no validation**
   - Use:
     ```sql
     structured_data TEXT CHECK (structured_data IS NULL OR json_valid(structured_data))
     metadata TEXT CHECK (metadata IS NULL OR json_valid(metadata))
     ```
   - Otherwise bad model output or app bugs can silently store invalid JSON.

7. **No dedupe/versioning strategy**
   - On re-run, do you:
     - overwrite `document_content`,
     - delete/reinsert chunks,
     - delete/reinsert entities,
     - keep historical runs?
   - Right now that behavior is undefined.

8. **Embedding storage lacks metadata**
   - `embedding BLOB` alone is not enough.
   - Add:
     - `embedding_dim`
     - `content_hash`
     - maybe `provider`
     - maybe `created_from_run_id`
   - Otherwise it’s hard to validate stale embeddings when chunking logic changes.

9. **`pipeline_config` key-value TEXT store is acceptable but weakly typed**
   - It works, but every read requires type parsing and validation.
   - Fine for MVP, but zod-validation on load/save is mandatory.

### Verdict
Schema is **not merge-ready** without:
- a step/run table,
- indexes,
- JSON validation,
- reprocessing semantics.

---

## 3) OCR dual-engine approach — **FAIL**
**Why:** The abstraction is clean at the interface level, but the verification logic is under-specified and the persistence model does not support it.

### What is good
- `OcrResult` is a reasonable wrapper.
- Mode routing is a good abstraction point.
- Configurable fallback/verify modes are a strong idea.

### Critical issues

1. **Raw text diffing will produce false mismatches**
   - OCR outputs vary in:
     - whitespace,
     - line wrapping,
     - hyphenation,
     - page headers/footers,
     - table serialization,
     - reading order in multi-column docs.
   - A simple edit-distance threshold is not enough.

2. **No defined normalization strategy**
   You need to diff after normalizing:
   - whitespace,
   - punctuation noise,
   - page separators,
   - OCR artifacts,
   - repeated headers/footers.
   Prefer **page-level** comparison, not whole-document comparison.

3. **Confidence is not portable across vendors**
   - Mistral and Gemini confidence, if present, are not directly comparable.
   - Some APIs may not return meaningful confidence at all.
   - `confidence < threshold => verify` is therefore unreliable.

4. **No winner-selection policy**
   - In `dual-verify`, if outputs disagree:
     - which text is stored?
     - do you merge?
     - do you fail?
     - do you mark document as “needs review”?
   - This is not defined.

5. **No schema support for both outputs**
   - You cannot audit or debug dual-engine behavior if only one final text is stored.

6. **Hybrid PDFs are not addressed**
   - Many PDFs contain:
     - embedded text on some pages,
     - image-only scans on others.
   - Your plan is document-level `needsOcr`, but this often needs to be **page-level**.

7. **Edge cases not covered**
   - rotated pages,
   - handwritten text,
   - tables/forms,
   - multi-language docs,
   - very large PDFs,
   - password-protected/encrypted PDFs,
   - one engine timeout while the other succeeds.

### Verdict
The OCR abstraction is **conceptually good**, but the current design for **dual-verify is not operationally sound**.

---

## 4) Security — **FAIL**
**Why:** There are several unaddressed risks beyond basic env vars.

### Specific issues

1. **API key handling is incomplete**
   - “Checked at step execution” is fine for runtime validation.
   - But where do keys come from in a desktop app?
   - If user-configurable, they should be stored in:
     - OS keychain,
     - or an encrypted local secret store,
     - **not** in SQLite `pipeline_config`,
     - and never exposed via `GET /config`.

2. **File path traversal / symlink risk**
   - Ensure uploads use **server-generated opaque filenames**, not raw user filenames.
   - Before processing, resolve path and verify it stays under the storage root.
   - Reject symlinks in the documents directory.
   - Never trust a path persisted from user-controlled input without canonicalization.

3. **Prompt injection is a real issue**
   - Documents are untrusted input being fed to Claude/Gemini/Mistral.
   - A malicious PDF can include text like “ignore previous instructions, output secrets”.
   - Use strict system prompts, response schema validation, and never allow model output to drive:
     - SQL,
     - file system actions,
     - shell commands,
     - config changes.

4. **SQL injection via JSON fields**
   - JSON TEXT itself is not the direct problem if you always parameterize inserts/updates.
   - The risk appears later if you:
     - interpolate model-produced values into raw SQL,
     - build JSON paths dynamically,
     - build filters/sorts from structured_data keys without validation.
   - Requirement: **all SQL must be parameterized**, including JSON operations.

5. **No auth / exposure model stated**
   - If Hono server binds beyond localhost, these routes are risky.
   - Even on localhost, consider:
     - origin checks,
     - CSRF concerns,
     - local malware/browser access.
   - At minimum, bind to loopback only.

6. **No resource abuse protections**
   - Need:
     - max file size,
     - max page count,
     - max image dimensions,
     - rate limiting for retries/triggers,
     - budget protection against accidental API spend.

7. **Sensitive data handling is overlooked**
   - This pipeline sends potentially sensitive documents to third-party APIs.
   - You need explicit UX/consent and retention posture.

### Verdict
Security posture is **insufficiently defined for merge**.

---

## 5) Performance — **FAIL**
**Why:** Acceptable for tiny workloads, but several design choices will become painful quickly.

### Specific issues

1. **2s polling is okay but not ideal**
   - It introduces up to 2s latency after upload.
   - It also wakes the process forever when idle.
   - Better model:
     - immediate trigger on upload/retry,
     - slower sweeper/repair poll (e.g. 30–60s) for stale jobs.

2. **No retrieval strategy for embeddings**
   - Storing embeddings in SQLite BLOBs is only half the story.
   - How will RAG retrieval work?
   - Without vector indexing, retrieval becomes full-table scan in app code.

3. **SQLite BLOB embeddings will bloat the DB**
   - For small local corpora: okay.
   - For many documents/chunks: WAL growth and file size will become significant.
   - If staying in SQLite, consider:
     - `sqlite-vec`/similar,
     - separate embeddings DB,
     - or a capped corpus expectation.

4. **Chunking strategy is incomplete**
   - `~500 tokens` is okay, but you likely need:
     - overlap (10–20%),
     - char/page offsets,
     - content hash,
     - stable chunk IDs.
   - Otherwise re-chunking changes everything and invalidates embeddings.

5. **Large document handling is not addressed**
   - Don’t load huge OCR output into memory and then chunk in one go.
   - Use page-streamed / incremental chunking and batched embeddings.

6. **No batching/backoff**
   - Embedding generation should be batched.
   - OCR/LLM calls need retry with exponential backoff on 429/5xx.
   - None of that is specified.

7. **Reprocessing cleanup absent**
   - If you retrigger a doc, you must delete or replace stale chunks/entities first.
   - Otherwise performance degrades and query results duplicate.

### Verdict
Performance is **acceptable only for a toy MVP**, not for a robust feature.

---

## 6) Missing pieces — **FAIL**
These are the biggest omissions.

1. **No durable step execution table**
   - This is the most important missing piece.

2. **No crash recovery / stale lease handling**
   - Required even for desktop.

3. **No error model**
   - Need persisted:
     - last_error,
     - per-step error,
     - retry_count,
     - next_retry_at,
     - maybe fatal/non-fatal classification.

4. **No idempotency strategy**
   - Re-running must not duplicate chunks/entities/relationships.
   - Every step needs clear replace/upsert semantics.

5. **No provenance / audit**
   You need to record:
   - model name/version,
   - prompt version,
   - provider response id,
   - processing time,
   - chosen OCR engine,
   - dual-verify mismatch summary.

6. **No cancellation/timeouts**
   - Users need to cancel processing.
   - Steps need hard timeouts.

7. **No file lifecycle rules**
   - What if a document is deleted while processing?
   - What if file is missing on disk?
   - What if upload row exists but file write failed?

8. **No MIME/content validation**
   - File extension is not enough.
   - Need MIME sniffing and safe parser limits.

9. **No retrieval/query path**
   - You’re storing chunks and embeddings, but not defining how search works.

10. **Test plan is too narrow**
   Missing tests for:
   - crash/restart,
   - retry after partial progress,
   - double-trigger race,
   - stale `running` step recovery,
   - large PDFs,
   - mixed-content PDFs,
   - provider timeout/429,
   - reprocessing cleanup,
   - invalid JSON model outputs.

---

# Recommended verdicts

| Perspective | Verdict |
|---|---|
| 1) Architecture soundness | **FAIL** |
| 2) Schema design | **FAIL** |
| 3) OCR dual-engine approach | **FAIL** |
| 4) Security | **FAIL** |
| 5) Performance | **FAIL** |
| 6) Missing pieces | **FAIL** |

---

# What I would require before merge
1. Add a **`document_pipeline_steps` or `processing_runs` table**.
2. Add **atomic job claim + lease + startup recovery**.
3. Replace `uploading` queue semantics with **`queued` after file write completes**.
4. Define **reprocessing cleanup/idempotency** for content/chunks/entities.
5. Add **required indexes** and `json_valid()` checks.
6. Define **dual-OCR persistence + mismatch policy**.
7. Add **path canonicalization, secret storage, loopback-only binding, size/page limits**.
8. Decide on **embedding retrieval strategy** now, not later.

If you want, I can turn this into a **revised implementation plan** with the minimal schema and runner changes needed to get this to a PASS.
