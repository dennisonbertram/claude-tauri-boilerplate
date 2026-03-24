Here’s the implementation review, based on the actual code in this snapshot.

## Verdict

| Area | Verdict |
|---|---|
| 1) Runner correctness | **FAIL** |
| 2) OCR dual-engine | **FAIL** |
| 3) Entity extraction | **FAIL** |
| 4) DB schema/migrations | **PASS** |
| 5) API routes | **FAIL** |
| 6) Overall | **FAIL** |

## What looks correctly fixed
I can verify the major previously reported fixes are now present in code:

- **Atomic claim** of the next document via `UPDATE ... RETURNING`  
  - `apps/server/src/db/db-pipeline.ts -> claimNextUnenrichedDocument`
- **Startup stale-job recovery**
  - `recoverStaleJobs()` + `recoverOnStartup()`
- **OCR dual-verify now compares whole-document text**, not only page splits
  - `apps/server/src/services/pipeline/ocr-diff.ts`
- **Dual-engine fallback behavior** when one OCR engine fails
  - `apps/server/src/services/pipeline/ocr.ts -> runDualVerify`
- **Mistral-primary mode now always verifies with Gemini**
  - `runMistralPrimaryGeminiVerify`
- **Entity reprocessing deletes old entities first**
  - `deleteEntitiesForDocument()` before insert
- **Relationships are resolved using inserted DB entity IDs**
  - `getEntitiesForDocument()` + normalized lookup map
- **`enriching` status exists in schema and migration path**
  - `schema.ts`, `migrations.ts`
- **Pipeline tables are created by migration**
  - `migrateDocumentPipelineTables`
- **Pipeline router is mounted and worker is started**
  - `app.ts`

So: the earlier fixes do appear to have been applied.  
But there are still blocker-level issues.

---

## 1) Runner correctness — **FAIL**

### What is good
- Atomic document claim is correct.
- Stale recovery exists.
- Step runs are durable and attempts increment properly.
- Cancellation is checked between steps.

### Remaining issues

#### 1.1 Retry/recovery is broken for partially processed documents
**Root cause:** the worker only claims documents with:

- `documents.status = 'ready'`
- **and** no `document_content` row

Code:
- `claimNextUnenrichedDocument()` in `db-pipeline.ts`

That means:

- If OCR/text extraction succeeded and later steps failed/stalled,
- `recoverStaleJobs()` can set the doc back to `ready`,
- `/retry/:documentId` can mark failed runs as `pending`,
- **but the worker will never pick that document up again**, because `document_content` already exists.

This breaks:
- stale recovery for later pipeline stages
- retry for non-critical step failures
- partial resume behavior in general

This is the biggest correctness issue in the runner.

#### 1.2 Timeouts are not actually enforced for most steps
The runner creates an `AbortController` and timeout, but most steps do not honor it.

Examples:
- `runSingleEngine()` does **not pass** `ctx.abortSignal` to OCR functions
- `ocrWithMistral()` accepts `signal` but does not use it
- `ocrWithGemini()` accepts `signal` but does not use it
- `executeClaudeVisionExtraction()` does not use abort/cancel support

So step timeout currently means “abort signal was fired,” not “the work actually stops.”

---

## 2) OCR dual-engine — **FAIL**

### What is good
- Whole-document diffing fix is present.
- Dual-engine path stores both OCR outputs.
- One-engine-success fallback is implemented.
- Mistral-primary mode now always verifies with Gemini.

### Remaining issues

#### 2.1 Configured diff threshold is only partially respected
In `ocr-diff.ts`:

```ts
export function diffOcrResults(a, b, threshold = 0.05)
```

But then:

```ts
const needsReview = agreementScore < 0.95;
```

So `threshold` affects page mismatch checks, but **not** `needsReview` or the main review cutoff.  
If the user changes `dualVerifyDiffThreshold`, behavior stays hardcoded at 95%.

#### 2.2 Single-engine OCR path drops abort propagation
In `ocr.ts`:

```ts
const result = await ocrFn(ctx.storagePath, ctx.document.mimeType);
```

`ctx.abortSignal` is not passed at all in `runSingleEngine()`.

#### 2.3 OCR step metadata is stored in the wrong field
In `runSingleEngine()` and the Mistral-primary fallback path, the code returns:

```ts
modelName: result.modelVersion
```

instead of setting `modelVersion`.

So `pipeline_step_runs.model_name` gets the version string, while `model_version` stays empty.

---

## 3) Entity extraction — **FAIL**

### What is good
- Existing entities are deleted before reinsertion.
- Relationship IDs are now resolved from actual inserted entity rows, which is the right fix.

### Remaining issues

#### 3.1 Relationship extraction is effectively dead
`buildRelationships()` only creates relationships when both entities share `pageNumber`:

```ts
const samePage = a.pageNumber && b.pageNumber && a.pageNumber === b.pageNumber;
```

But the Claude Vision prompt does **not ask for `pageNumber` at all**.

Prompt fields in `claude-vision.ts`:
- `type`
- `value`
- `normalizedValue`
- `confidence`
- `sourceText`

No `pageNumber`.

So in normal operation, `pageNumber` will usually be absent, and relationship count will usually be **zero**.

#### 3.2 Deduplication happens before invalid types are normalized
Flow today:

1. dedupe by raw `entity.type`
2. then map invalid types to `'other'`

That means two different unknown types can survive dedupe, then both become `'other'`, creating duplicate semantic entities.

---

## 4) DB schema / migrations — **PASS**

This area looks solid in this snapshot.

### What is good
- `documents.status` includes `enriching` in both schema and migration path.
- Pipeline tables exist with appropriate constraints and indexes.
- OCR outputs are unique per `(document_id, engine)`.
- Entity relationships have FK cascades through entity deletion.
- JSON columns have `json_valid(...)` checks.
- `pipeline_config` exists and supports persisted overrides.

### Minor note
There are a couple of stale comments, but I don’t see a blocker in the schema/migration layer itself.

---

## 5) API routes — **FAIL**

### What is good
- Router is mounted.
- Status/config/content/chunks/entities/OCR endpoints exist.
- Trigger/retry/cancel endpoints are present.

### Remaining issues

#### 5.1 `/retry/:documentId` is functionally ineffective for many real cases
This route sets failed step runs to `pending`, but does not solve the claim problem.

If a document already has `document_content`, the worker will not reclaim it, so retry does nothing for:
- later non-critical failures
- recovered stale jobs after OCR/text succeeded

#### 5.2 `/cancel/:documentId` is not a real cancel
It only does:

```ts
updateDocument(db, documentId, { status: 'error' });
```

It does **not** abort the running step.  
Since many steps ignore abort anyway, cancellation is only observed between steps, not during a long-running OCR/LLM call.

#### 5.3 Config updates are not validated, and nested config merge is shallow
`PUT /config` accepts arbitrary JSON and stores it directly.

Also `getPipelineConfig()` does:

```ts
return { ...DEFAULT_PIPELINE_CONFIG, ...overrides }
```

That is a shallow merge.

So if the client sends:

```json
{ "stepTimeouts": { "ocr": 1000 } }
```

it replaces the whole `stepTimeouts` object, dropping defaults for all other steps.

That’s a real config correctness bug.

---

## 6) Overall — **FAIL**

### Bottom line
The previously reported fixes are visibly present, which is good.

However, I would **not** sign this off yet because there are still important functional issues:

1. **Resume/retry logic is incomplete**  
   partially processed docs are not reclaimable once `document_content` exists

2. **Timeout/cancel is mostly not enforced**  
   abort signals are created but not honored by the real long-running work

3. **Entity relationship extraction is effectively non-functional**  
   because the upstream prompt doesn’t provide the `pageNumber` the relationship builder requires

4. **Config API can silently create bad runtime config**  
   due to no validation + shallow merge

---

## Extra issue noticed outside the requested buckets
Not part of the PASS/FAIL categories, but worth noting:

- `splitIntoChunks()` in `chunking.ts` appears to compute `charOffsetStart` incorrectly after the first overlapped chunk. The overlap restart math resets the new chunk start incorrectly.

---

If you want, I can turn this into a **short actionable fix list ordered by severity**.
