Overall: **FAIL**

There are a couple of real blockers that would keep this from working reliably end-to-end, even in a single-user local app.

## Verdicts

| Category | Verdict |
|---|---|
| Correctness | **FAIL** |
| Robustness | **FAIL** |
| Code quality | **FAIL** |
| OCR dual-engine | **FAIL** |
| Security | **PASS** |

---

## 1) Correctness — **FAIL**

### Show-stopper #1: `documents.status` DB constraint does not allow `enriching`
**Files:** `migrations.ts`, `db-pipeline.ts`

- `migrateDocumentsTable()` creates:
  ```sql
  status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('uploading', 'processing', 'ready', 'error'))
  ```
- But the pipeline claims work by doing:
  ```sql
  UPDATE documents SET status = 'enriching'
  ```
  in `claimNextUnenrichedDocument()`.

On a fresh DB, that update will fail with a CHECK constraint error.  
This is the biggest blocker.

**Impact:** pipeline cannot start processing documents on a fresh install.

---

### Show-stopper #2: retry/recovery logic is broken because attempts are never incremented
**Files:** `db-pipeline.ts`, `runner.ts`, `routes/pipeline.ts`

- `pipeline_step_runs` has:
  ```sql
  UNIQUE(document_id, step_name, attempt)
  ```
- `createStepRun()` always inserts `attempt ?? 1`
- `processNextDocument()` always calls `createStepRun(...)` with no computed next attempt
- `/retry/:documentId` changes failed runs to `pending`, but the worker does **not** reuse pending rows; it just tries to insert a fresh attempt 1 again
- `recoverStaleJobs()` resets docs to `ready`, but leaves old step runs in place

So any retry/recovery path will hit a unique constraint conflict on `(document_id, step_name, attempt)`.

**Impact:** retries and stale-job recovery do not work.

---

### Entity relationship insertion is broken
**File:** `entity-extraction.ts`

`buildRelationships()` returns objects like:
```ts
{ sourceValue, sourceType, targetValue, targetType, relationshipType, confidence }
```

But `insertEntityRelationships()` expects:
```ts
{ sourceEntityId, targetEntityId, relationshipType, confidence }
```

This line is wrong:
```ts
relationshipCount = insertEntityRelationships(ctx.db, ctx.document.id, relationships);
```

The comment says ID resolution happens internally, but it does not.

**Impact:** relationship insertion will fail whenever any relationships are generated.  
Because this step is non-critical, the full pipeline may still finish, but entity relationships are effectively broken.

---

### Unknown binary files will often be misread as text instead of going to OCR
**File:** `text-extraction.ts`

For unknown MIME types, code does:
```ts
try {
  return await handleTextFile(storagePath);
} catch {
  return handleImage();
}
```

`Bun.file(...).text()` often won't throw on binary formats like `.docx` / `.xlsx`; it'll just produce garbage text.

**Impact:** some binary docs may be marked `needsOcr: false` and stored as junk text.

---

## 2) Robustness — **FAIL**

### Crash recovery does not actually resume partial work
**Files:** `db-pipeline.ts`, `runner.ts`

`recoverStaleJobs()` resets document status from `enriching -> ready`, but `claimNextUnenrichedDocument()` only picks docs with **no** `document_content` row.

So if a crash happened **after OCR/text content was stored but before later steps** (chunking/entities/etc), that doc will never be reclaimed automatically.

**Impact:** partial enrichment can get stranded.

---

### Timeouts are mostly cosmetic
**File:** `runner.ts`

The worker creates an `AbortController`, but none of the step implementations meaningfully use `ctx.abortSignal`.

Examples:
- OCR provider calls don't pass a signal
- Claude Vision call doesn't use a signal
- text extraction doesn't use it
- embeddings fetch doesn't use it

So this:
```ts
setTimeout(() => abortController.abort(), timeoutMs)
```
does not actually stop work.

**Impact:** hung or slow provider calls won't be cancelled.

---

### Cancel endpoint does not cancel
**Files:** `routes/pipeline.ts`, `runner.ts`

`POST /cancel/:documentId` only sets:
```ts
updateDocument(db, documentId, { status: 'error' });
```

But the running worker:
- never checks whether the document was cancelled
- never aborts in-flight work
- will likely keep processing and later set the document back to `ready`

**Impact:** cancel is not reliable.

---

### Config has limits that are never enforced
**Files:** `db-pipeline.ts`, `runner.ts`, OCR/Claude files

These config values exist but are unused:
- `maxFileSizeBytes`
- `maxPageCount`

Large PDFs/images are read fully into memory and base64 encoded with no guard.

**Impact:** easy to hit provider/file-size issues or memory spikes.

---

### `nudgePipelineWorker()` is a no-op
**File:** `runner.ts`

Routes call it after trigger/retry, but it does nothing.

**Impact:** reprocessing waits until next poll interval, despite the API implying immediate action.

---

### Small but real bug: startup recovery logging is wrong
**File:** `runner.ts`

```ts
const recovered = recoverStaleJobs(db);
if (recovered > 0) { ... }
```

`recoverStaleJobs()` returns an object, not a number.

**Impact:** bad logic, and likely a TS error depending on settings.

---

## 3) Code quality — **FAIL**

There are some good parts:
- step-based pipeline is clean
- DB mapping functions are organized
- non-critical vs critical steps is a good fit for a desktop app

But too many implementation/comment mismatches hurt maintainability:

### Misleading behavior/comments
- `nudgePipelineWorker()` says "Kick the worker to process immediately" but is empty
- entity extraction comment says ID resolution happens internally; it doesn’t
- timeout/cancel structure suggests abort support that isn't actually wired through

### Retry model is incomplete
The code has:
- `attempt`
- `pending/running/failed`
- retry route
- stale recovery

…but the runner ignores all of that and always starts fresh attempt 1.

### Minor quality issues
- `modelName` / `modelVersion` are populated inconsistently in step results
- some unused imports / unused functions
- chunk char offsets look wrong when overlap is applied (`chunking.ts`)

If the duplicate/conflicting interface declarations in `packages/shared/src/types.ts` are real source, that’s also a separate build-quality concern.

---

## 4) OCR dual-engine — **FAIL**

This part is not sound yet.

### `chosenEngine` is hardcoded to Mistral
**File:** `ocr-diff.ts`

```ts
chosenEngine: 'mistral'
```

So dual-verify never actually chooses Gemini, no matter what the diff says.

---

### `mistral-primary-gemini-verify` basically never verifies
**File:** `ocr.ts`

Verification is triggered by:
```ts
const confidence = mistralResult.confidence || 1.0;
if (confidence < ctx.config.ocrConfidenceThreshold) { ... }
```

But `ocrWithMistral()` never sets `confidence`.

So `confidence` becomes `1.0`, meaning Gemini verification never runs.

**Impact:** this mode behaves like `mistral-only`.

---

### Diffing page-wise Mistral vs whole-document Gemini is flawed
**Files:** `ocr-gemini.ts`, `ocr-diff.ts`

- Mistral returns `pageTexts`
- Gemini returns only one flat `text`
- `diffOcrResults()` compares page arrays if present, otherwise splits on `---PAGE BREAK---`
- Gemini output does not insert those page markers

So on multi-page docs you end up comparing:
- Mistral: page 1, page 2, page 3...
- Gemini: one big blob on page 1, then empty strings for later pages

That will produce bad agreement scores and false mismatches.

---

### Threshold handling is inconsistent
`dualVerifyDiffThreshold` affects page mismatch calculation, but `needsReview` is hardcoded to:
```ts
const needsReview = agreementScore < 0.95;
```

So config is only partially respected.

---

## 5) Security — **PASS**

For a local desktop app, this is mostly fine.

### Good
- SQL uses parameter binding throughout
- Claude Vision is given a system prompt explicitly telling it to ignore document instructions
- Claude output is treated as data, not executable actions/tools
- inbox discovery is rooted in a fixed local documents directory

### Caveats
I would still tighten two things:

#### Path safety
Pipeline code trusts `ctx.storagePath` from the DB. If document creation anywhere else in the app can insert arbitrary paths, the pipeline can read arbitrary local files.

**Recommendation:** before OCR/Claude/text extraction, canonicalize and verify the path is under the allowed documents directory (or another approved root).

#### Claude output validation
Current validation is very light:
```ts
if (!structured.classification || !structured.entities) ...
```

**Recommendation:** schema-validate the JSON before storing/using it.  
This is more robustness than security, but it also reduces prompt-injection weirdness.

So: **PASS**, but with one important path-validation caveat.

---

# Biggest fixes to make first

1. **Fix the `documents.status` CHECK constraint** to include `enriching`  
   or stop using `enriching` as a persisted DB state.

2. **Fix retries/recovery**
   - either compute `attempt = max(attempt) + 1`
   - or reuse/update existing pending runs
   - and make recovery resume correctly

3. **Fix entity relationship insertion**
   - fetch inserted entity IDs
   - map relationships to actual `sourceEntityId` / `targetEntityId`

4. **Fix OCR verification logic**
   - don’t hardcode `chosenEngine`
   - don’t gate verify on a confidence field that never exists
   - compare whole-doc-to-whole-doc unless both engines provide page splits

5. **Make cancel/timeout real**
   - pass `AbortSignal` into provider calls/fetch
   - check for cancelled docs between steps

---

## Bottom line

This is a good MVP shape structurally, but **not shippable yet** because of two real blockers:

- fresh DBs likely can’t enter `enriching`
- retries/recovery are broken by step-run attempt handling

If those are fixed, the rest becomes an iterative cleanup pass rather than a rewrite.
