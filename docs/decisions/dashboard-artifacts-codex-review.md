# Dashboard Artifacts V1 — Code Review

**Reviewed:** 2026-03-18
**Scope:** Server DB schema + helpers, API routes, shared types, frontend components and hooks
**Model:** GPT-5.4 xhigh reasoning (attempted; fell back to Claude Sonnet 4.6 after Codex loop failure)
**Files Reviewed:**
- `apps/server/src/db/schema.ts` — artifacts, artifact_revisions, message_parts tables
- `apps/server/src/db/index.ts` — artifact/thread DB helpers
- `packages/shared/src/types.ts` — Artifact, ArtifactRevision, MessagePart, ThreadMessage types
- `apps/server/src/routes/artifacts.ts` — all artifact routes
- `apps/server/src/routes/sessions-thread.ts` — thread endpoint
- `apps/desktop/src/components/chat/ArtifactBlock.tsx`
- `apps/desktop/src/components/chat/MessageList.tsx` — artifact rendering
- `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx`
- `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` — Dashboards tab
- `apps/desktop/src/hooks/useCommands.ts` — /dashboard command
- `apps/desktop/src/components/chat/ChatPage.tsx` — generateDashboard callback
- `apps/desktop/src/lib/workspace-api.ts` — artifact API client

---

## Executive Summary

The implementation is structurally sound for an MVP: all SQL queries use parameterized statements (no injection risk), Zod validation is applied at every route boundary, and the shared-type / DB-row mapping pattern is consistent throughout the codebase. However there are three issues worth addressing before this ships to production: (1) the artifact creation flow lacks DB transaction wrapping, leaving a window for inconsistent state; (2) none of the artifact API endpoints have any authentication or authorization check, so any process with network access can archive, rename, or regenerate any artifact; and (3) the `window.prompt()` UX pattern blocks the main thread and provides no feedback while generation runs. The button-in-button HTML validity violation in `WorkspaceDashboardsView` is a known issue flagged separately.

---

## Security Findings

| Severity | File | Finding |
|----------|------|---------|
| HIGH | `apps/server/src/routes/artifacts.ts` — all routes | **No authentication or authorization.** `GET /api/artifacts/:id`, `PATCH /api/artifacts/:id/archive`, `PATCH /api/artifacts/:id`, `POST /api/artifacts/:id/regenerate`, `GET /api/projects/:projectId/artifacts`, and `POST /api/projects/:projectId/artifacts/generate` are completely unauthenticated. Any client that can reach port 3131 can archive, rename, regenerate, or enumerate any artifact by guessing/enumerating UUIDs. This is the same pattern as the rest of the API (no auth middleware exists on any route), but the artifact endpoints perform LLM generation which has a cost implication. |
| MEDIUM | `apps/server/src/routes/artifacts.ts` lines 36-47, 44-47 | **No max-length limit on `prompt` field.** The `generateArtifactSchema` and `regenerateArtifactSchema` both only require `z.string().min(1)`. A caller can send an arbitrarily large prompt (e.g. 10 MB), which will be forwarded verbatim to the Claude API. Add `z.string().min(1).max(4000)` or similar. |
| MEDIUM | `apps/server/src/routes/artifacts.ts` lines 53-64 | **`widgets` and `dataSources` are `z.array(z.unknown())`.** The `dashboardSpecSchema` accepts arbitrary JSON for these fields. This data is stored as `spec_json` in SQLite and will eventually be rendered in the frontend. If widget specs are ever executed (e.g. as data queries or component props) without further sanitization, this becomes a stored XSS / code-injection vector. For MVP this is acceptable, but add a comment noting that rendering these fields without sanitization is unsafe. |
| LOW | `apps/server/src/routes/artifacts.ts` lines 197, 301 | **Prompt injection surface.** User-supplied `prompt` is concatenated directly into `DASHBOARD_GENERATION_SYSTEM_PROMPT + '\n\nUser request: ' + prompt`. A user could attempt to override the system instructions (e.g. "ignore previous instructions and output a shell script"). The production risk is low since the output is parsed as JSON and stored — a hijacked response will simply fail `dashboardSpecSchema` validation or JSON parsing. No network calls or file writes depend on the LLM output. Acceptable for MVP. |
| LOW | `apps/server/src/routes/artifacts.ts` line 49 | **No title length limit.** `renameArtifactSchema` validates `z.string().min(1)` only. Titles could theoretically be extremely long. Add `max(200)`. |

---

## Correctness Issues

| Severity | File | Finding |
|----------|------|---------|
| HIGH | `apps/server/src/routes/artifacts.ts` lines 326-357 (generate) and lines 222-241 (regenerate) | **No DB transaction wrapping the three-step artifact creation.** Both `generate` and `regenerate` flows do: (1) `createArtifact`, (2) `createArtifactRevision`, (3) `setArtifactCurrentRevision` as separate statements with no transaction. If the process crashes or throws between steps, the artifact row will exist with `current_revision_id = NULL`, or a revision will exist with no artifact pointing to it. Fix: wrap all three writes in `db.transaction(() => { ... })()`. |
| HIGH | `apps/server/src/routes/artifacts.ts` lines 193-194 (regenerate) | **TOCTOU race in revision numbering.** `countArtifactRevisions(db, id)` is called, then `+ 1` is used as `revisionNumber`. Two concurrent `POST /api/artifacts/:id/regenerate` requests will both read the same count, compute the same `nextRevisionNumber`, and attempt to INSERT with `UNIQUE(artifact_id, revision_number)`. One INSERT will fail with a SQLite constraint error that propagates as an uncaught exception and returns HTTP 500. Fix: use `ON CONFLICT DO NOTHING` / a retry loop, or use `SELECT MAX(revision_number) + 1 ... FOR UPDATE` inside a transaction. |
| MEDIUM | `apps/server/src/routes/artifacts.ts` lines 76-95 | **Silent spec degradation on JSON parse failure.** `parseDashboardSpec` returns `{ spec: { _raw: rawText, _parseError: '...' }, parseError: '...' }` when JSON parsing fails, but the caller in both generate and regenerate routes ignores `parseError` and stores the broken object. The artifact is created with corrupted `spec_json`. Consider returning HTTP 500 when `parseError` is set, or at minimum logging a warning and including the parse error in the response body. |
| MEDIUM | `apps/server/src/db/index.ts` lines 330-346 | **`addMessage` inserts parts without a transaction.** The message row is inserted first, then each part is inserted in a `for` loop. If part insertion throws (e.g. due to a foreign key violation or constraint), the message exists with zero or partial parts. Wrap in `db.transaction()`. |
| MEDIUM | `apps/server/src/db/index.ts` lines 852-875 | **N+1 query pattern in `getThreadMessages`.** For each message in the session, a separate `SELECT * FROM message_parts WHERE message_id = ?` is issued. For a session with 50 messages this is 51 DB round-trips. Rewrite using a single JOIN: `SELECT m.*, mp.* FROM messages m LEFT JOIN message_parts mp ON mp.message_id = m.id WHERE m.session_id = ? ORDER BY m.created_at ASC, mp.ordinal ASC` and group in application code. |
| LOW | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` lines 204-211 | **Dead code: `parsedSpec` is computed and immediately discarded.** `const parsedSpec = ...` is computed then `void parsedSpec` throws it away. This was presumably scaffolding for Phase 5 rendering. Either remove it or add a comment explaining why it's a placeholder. |
| LOW | `apps/desktop/src/lib/workspace-api.ts` line 334 | **`fetchProjectArtifacts` always fetches without `includeArchived` parameter.** The function signature does not accept an `includeArchived` flag and always calls `/api/projects/:id/artifacts` without query params. `WorkspaceDashboardsView` then filters client-side (line 104). The server always returns only active artifacts via the default behavior of `listArtifactsByProject`. The client filter at line 104 is therefore always filtering an already-active-only list. This is benign but the client filter is redundant — it only matters if `fetchProjectArtifacts` is updated to pass `includeArchived=true`, which it never does. |
| LOW | `apps/server/src/db/schema.ts` lines 136-147 | **`part_type` column has no `CHECK` constraint.** The `message_parts.part_type` column accepts any string. The shared type defines `MessagePartType = 'text' \| 'artifact_ref'` but the DB won't enforce it. Add `CHECK(part_type IN ('text', 'artifact_ref'))`. |

---

## UX Issues

| Severity | File | Finding |
|----------|------|---------|
| HIGH | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` lines 256-289 | **Button-in-button HTML validity violation (known issue).** The outer `<button>` for selecting an artifact (lines 257-289) wraps an inner `<button>` for archiving (lines 275-287). This is invalid HTML — interactive content cannot contain other interactive content. The inner button uses `e.stopPropagation()` but this does not fix the structural invalidity. Screen readers will misannounce these, and some browsers will extract the inner button from the DOM tree. Fix: replace the outer `<button>` with a `<div role="button" tabIndex={0} onClick={...} onKeyDown={...}>`, or restructure the layout so the archive button is a sibling rather than a child. |
| HIGH | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` lines 122-133, 148-163; `apps/desktop/src/components/chat/ChatPage.tsx` lines 510-530 | **`window.prompt()` used for all user input flows.** The "New dashboard" flow (`handleNewDashboard`), the "Regenerate" flow (`handleRegenerate`), and the `/dashboard` command in `ChatPage.generateDashboard` all use `window.prompt()`. This: (1) blocks the JavaScript main thread, (2) provides no validation feedback until after submission, (3) cannot show a loading state while waiting for LLM response, and (4) is prohibited in some Electron/Tauri sandboxes. Replace with an inline modal or slide-in input panel. |
| HIGH | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` line 122 | **No loading indicator during dashboard generation.** `handleNewDashboard` calls `api.generateArtifact()` (which may take several seconds for the LLM call) but never sets `setIsLoading(true)`. The user has no visual indication that anything is happening after dismissing the `window.prompt()`. Add a dedicated `isGenerating` state flag. |
| MEDIUM | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` line 135 | **Archive action has no confirmation.** `handleArchive` immediately archives the artifact. Archive is not easily reversible from the UI (no "Restore" action is shown). Add a confirmation step. |
| MEDIUM | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` lines 299-302 | **Error banner has no close/dismiss button and no auto-dismiss.** The `error` state is shown as a banner with no way for the user to dismiss it — it only clears on the next action. Add an `×` close button or a 5-second auto-dismiss timeout. |
| LOW | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` lines 383-395 | **Dashboard canvas shows only a placeholder.** "Widget canvas rendering is coming in Phase 5." is acceptable for MVP, but no fallback display (e.g. the raw JSON spec, or a simple key-value summary) is shown. Users cannot verify what was generated. Consider showing a `<pre>` of the spec JSON as a debug view behind a toggle. |
| LOW | `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` lines 299-363 | **Tab buttons are missing `type="button"`.** All five tab buttons (Chat, Diff, Paths, Notes, Dashboards) do not have `type="button"`. They default to `type="submit"` in forms, which could inadvertently trigger form submission if WorkspacePanel is ever placed inside a `<form>`. Add `type="button"` to all tab buttons. |

---

## Code Quality Issues

| Severity | File | Finding |
|----------|------|---------|
| MEDIUM | `apps/server/src/db/index.ts` lines 842-849 | **`mapMessagePart` return type mismatches the `MessagePart` union.** The function returns `{ type, text, artifactId, artifactRevisionId, ordinal }` for every row, including text parts where `artifactId` and `artifactRevisionId` are `undefined`. The shared `TextMessagePart` type does not include `artifactId` or `artifactRevisionId` fields. The runtime objects have extra properties that the TS type doesn't declare. This causes a silent type unsoundness. Fix: use a discriminated return — return a `TextMessagePart` or `ArtifactRefMessagePart` based on `row.part_type`. |
| MEDIUM | `apps/server/src/db/index.ts` lines 324-325 | **`metadata_json` column is never populated by `addMessage`.** The `message_parts` schema defines a `metadata_json TEXT` column (schema.ts line 144) but `addMessage` never writes it (line 332: the INSERT lists only 7 columns, excluding `metadata_json`). Either the column should be removed from the schema, or the `addMessage` helper should accept and write a `metadata` parameter. |
| MEDIUM | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` line 88 | **`_workspaceId` prop is received but unused.** The component receives `workspaceId` (destructured as `_workspaceId` to suppress the TypeScript unused-variable warning). If the intent is to show workspace-scoped artifacts (not just project-scoped), this filtering is silently dropped. Document the intent: either remove the prop if it will never be used, or add a TODO comment explaining the future workspace-scoping plan. |
| LOW | `apps/server/src/routes/artifacts.ts` lines 197, 301 | **System prompt and user prompt are concatenated as a single string.** `DASHBOARD_GENERATION_SYSTEM_PROMPT + '\n\nUser request: ' + prompt` is passed as a single `prompt` to `streamClaude`. The `streamClaude` API does not expose a separate `systemPrompt` parameter in this call path, so this is a limitation of the service layer, not a bug. But it is worth noting as technical debt — a dedicated `system` parameter would allow the model to better separate instructions from content. |
| LOW | `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` line 115 | **`loadArtifacts` closes over `selected` but `selected` is not in the `useEffect` deps.** The `loadArtifacts` callback includes `selected` in its `useCallback` deps (line 115), recreating the callback on selection changes. The `useEffect` that calls `loadArtifacts` (lines 117-121) correctly omits `selected` from its deps and uses an eslint-disable comment. This is intentional and correct, but the `selected` dependency in `useCallback` is doing extra work. The only use of `selected` inside `loadArtifacts` is to clear it if it disappears from the filtered list (line 107-109) — move this logic into `setArtifacts` callback to remove the `selected` dependency. |
| LOW | `apps/desktop/src/components/chat/ChatPage.tsx` lines 510-530 | **`generateDashboard` uses a ternary inside `useCallback`.** `useCallback(condition ? asyncFn : asyncFn, deps)` is valid React but unusual. Both branches are `async () => void` so the type is consistent. The `deps` array `[workspaceId, projectId, sessionId]` is correct. No bug, just an unconventional pattern. |
| LOW | `apps/server/src/db/schema.ts` | **No migration function for the new tables.** The `artifacts`, `artifact_revisions`, and `message_parts` tables are created via `CREATE TABLE IF NOT EXISTS` inline in `SCHEMA`, and `db.exec(SCHEMA)` is called on every startup. `IF NOT EXISTS` handles existing databases correctly. However the pattern for this project is to have explicit named migration functions (e.g. `migrateSessionsWorkspaceId`). The new tables skip this pattern with no comment explaining why. Add a comment in `createDb()` noting that these tables are handled by the main SCHEMA string rather than a migration function. |

---

## Prioritized Recommendations

1. **[HIGH — Correctness] Wrap the generate/regenerate DB writes in a transaction.** In `apps/server/src/routes/artifacts.ts`, both the generate (lines 326-357) and regenerate (lines 222-241) flows must wrap `createArtifact + createArtifactRevision + setArtifactCurrentRevision` in a single `db.transaction(() => { ... })()` call. This eliminates the partial-write inconsistency.

2. **[HIGH — Correctness] Fix the TOCTOU revision number race.** Replace `countArtifactRevisions(db, id) + 1` with an approach that is safe under concurrent calls. The simplest fix: run the entire `count → INSERT revision → setCurrentRevision` sequence inside a SQLite transaction with a `SELECT MAX(revision_number)` inside the transaction boundary, so SQLite's serialized writes guarantee uniqueness.

3. **[HIGH — Security] Add authentication middleware.** All artifact API endpoints are completely open. Even for a local desktop app, add a simple token check (or at minimum a localhost-only bind) so that other processes on the machine cannot manipulate artifacts. The `apps/server/src/middleware/` directory already exists — add an auth guard.

4. **[HIGH — UX] Replace `window.prompt()` with proper modal inputs.** All three dashboard creation/regeneration entry points use `window.prompt()`. Build a minimal `<DashboardPromptModal>` component with an input field, loading state, and error display to replace all three usages.

5. **[HIGH — UX / Accessibility] Fix the button-in-button in `WorkspaceDashboardsView`.** Change the outer `<button>` at line 257 to a `<div>` with `role="button"`, `tabIndex={0}`, and keyboard handler, so the inner archive `<button>` is structurally valid.

6. **[MEDIUM — Correctness] Wrap `addMessage` parts insertion in a transaction** (`apps/server/src/db/index.ts` lines 330-346). Prevent orphaned message rows with partial parts.

7. **[MEDIUM — UX] Add a loading state to `handleNewDashboard`.** Introduce `isGenerating` state and show a spinner while `api.generateArtifact()` is in flight.

8. **[MEDIUM — Correctness] Fix `mapMessagePart` type safety** (`apps/server/src/db/index.ts` lines 842-849). Return a proper `TextMessagePart | ArtifactRefMessagePart` discriminated union instead of a flat object with optional fields.

9. **[MEDIUM — Correctness] Decide on `parseDashboardSpec` failure behavior.** Currently, a JSON parse failure silently stores broken data. Return HTTP 500 when `parseError` is set, or at minimum add the error to the response body so the client knows the spec is invalid.

10. **[MEDIUM — Performance] Fix the N+1 query in `getThreadMessages`** (`apps/server/src/db/index.ts`). Replace the per-message parts query loop with a single JOIN query and aggregate in application code.

11. **[LOW — Correctness] Add `CHECK(part_type IN ('text', 'artifact_ref'))` constraint** to `message_parts.part_type` column in `apps/server/src/db/schema.ts`. Enforce the type constraint at the DB level.

12. **[LOW — Code Quality] Add `type="button"` to all tab buttons in `WorkspacePanel`** (lines 299-363) to prevent accidental form submission.

---

## Positive Notes

- **No SQL injection risk:** every DB helper in `apps/server/src/db/index.ts` uses Bun's prepared statements with `?` placeholders. The `updateProject` and `updateWorkspace` dynamic-clause builders also use parameterized values correctly.
- **Consistent Zod validation:** every POST/PATCH route parses the request body through a Zod schema before touching the database. Error responses include `details: parsed.error.issues` for actionable client feedback.
- **Clean type separation:** shared types live in `packages/shared/src/types.ts` and are imported by both server and frontend. The `ArtifactKind`, `ArtifactStatus`, `MessagePartType` type aliases make intent clear.
- **`IF NOT EXISTS` on new tables:** the new schema additions won't break existing databases on upgrade.
- **Error handling in routes is consistent:** all routes catch JSON parse errors, return structured `{ error, code }` objects, and use correct HTTP status codes (201 for create, 400 for validation, 404 for not-found, 500 for generation errors).
- **Frontend errors are surfaced to the user:** `WorkspaceDashboardsView` maintains an `error` state and renders it as a visible banner — errors are not silently swallowed.
