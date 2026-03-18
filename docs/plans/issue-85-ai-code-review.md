# Issue #85 Implementation Plan: AI Code Review with Customizable Prompts

## Summary

Add one-click AI code review triggered from WorkspaceDiffView. Claude reviews the workspace diff and returns file/line-level comments rendered inline. Users can customize the review prompt per repository, choose the review model, and set thinking levels.

## Current State

The codebase already has relevant infrastructure:

1. **Workflow prompt system** (`apps/desktop/src/lib/workflowPrompts.ts`):
   - `buildReviewWorkflowMessage()` constructs review messages
   - `loadRepoWorkflowPrompts()` / `saveRepoWorkflowPrompts()` handle per-repo persistence
   - Review prompt already configurable in Settings > Workflows tab

2. **Diff viewer** (`apps/desktop/src/components/workspaces/WorkspaceDiffView.tsx` + `DiffViewer.tsx`):
   - Unified and side-by-side diff views
   - Inline comment infrastructure already exists (comment state, rendering via MarkdownRenderer)
   - `WorkspaceDiffView.test.tsx` already tests inline comment creation/saving

3. **Settings** (`apps/desktop/src/components/settings/SettingsPanel.tsx`):
   - Model selector with `AVAILABLE_MODELS`
   - `thinkingBudgetTokens` and `effort` settings already exist
   - Workflows tab already shows review/pr/branch/memory prompts

4. **Chat API** (`apps/server/src/routes/chat.ts`):
   - `ChatRequest` supports `model`, `thinkingBudgetTokens`, `effort`
   - SSE streaming already works

## Files to Modify

| File | Change |
|------|--------|
| `apps/desktop/src/components/workspaces/WorkspaceDiffView.tsx` | Add Review button, integrate code review comments, add review loading/error state |
| `apps/desktop/src/hooks/useSettings.ts` | Add `codeReviewModel`, `codeReviewEffort` settings fields |
| `apps/desktop/src/components/settings/SettingsPanel.tsx` | Add code review model/effort selectors in Workflows tab |
| `apps/desktop/src/lib/workflowPrompts.ts` | Add `buildCodeReviewPrompt()` that formats diff + custom prompt |
| `packages/shared/src/types.ts` | Add `CodeReviewComment`, `CodeReviewResult` types |
| `apps/server/src/routes/index.ts` | Register new code-review route |

## Files to Create

| File | Purpose |
|------|---------|
| `apps/server/src/routes/code-review.ts` | POST `/api/workspaces/:id/code-review` endpoint (SSE stream) |
| `apps/server/src/routes/code-review.test.ts` | Tests for code review endpoint |
| `apps/desktop/src/components/workspaces/CodeReviewDialog.tsx` | Modal to edit review prompt before sending |
| `apps/desktop/src/components/workspaces/CodeReviewSummary.tsx` | Summary card + comment navigation index |

## Implementation Steps

- [ ] **Step 1: Shared types** — Add `CodeReviewComment` (file, line, severity, body) and `CodeReviewResult` (summary, comments[]) to `packages/shared/src/types.ts`
- [ ] **Step 2: Backend endpoint** — Create `apps/server/src/routes/code-review.ts` with POST `/api/workspaces/:id/code-review` that reads workspace diff, calls Claude, streams back structured comments
- [ ] **Step 3: Backend tests** — Write `code-review.test.ts` testing endpoint with mock Claude response
- [ ] **Step 4: Settings additions** — Add `codeReviewModel` and `codeReviewEffort` to `AppSettings` in `useSettings.ts`, expose in Workflows section of SettingsPanel
- [ ] **Step 5: CodeReviewDialog** — Modal component that shows editable review prompt + send button
- [ ] **Step 6: Review button** — Add "Review" button to WorkspaceDiffView toolbar; right-click opens CodeReviewDialog; left-click submits with current settings
- [ ] **Step 7: Comment integration** — Parse streamed review response, render AI comments inline in DiffViewer with distinct styling (AI badge, color)
- [ ] **Step 8: CodeReviewSummary** — Summary card above diff showing issue count by severity + click-to-jump navigation
- [ ] **Step 9: Manual verification** — Start dev server, trigger review on a workspace with changes, verify comments appear

## Testing Strategy

### Regression tests (write first, must fail before implementation)
- `code-review.test.ts`: Endpoint returns 404 for unknown workspace, 200 with SSE stream for valid workspace
- `WorkspaceDiffView.test.tsx`: Review button renders, clicking triggers review, AI comments render with badge

### New functionality tests
- `code-review.test.ts`: Structured comments are parsed correctly from Claude response
- `CodeReviewDialog.test.tsx`: Dialog opens with current prompt, editable, submits correctly
- `CodeReviewSummary.test.tsx`: Summary renders issue counts, click-to-jump works

## Risk Areas

- **Prompt injection**: Sanitize user-edited prompts before sending to Claude
- **Large diffs**: Cap diff size sent to Claude (e.g., max 50 files or 10k lines); add warning
- **Comment persistence**: AI review comments are session-only (not persisted to DB) — acceptable for MVP
- **Streaming parsing**: Claude response must be parsed into structured `CodeReviewComment` objects; need robust JSON extraction

## Commit Strategy

1. `feat(#85): add CodeReviewComment/Result types` — types only
2. `test(#85): add regression tests for code-review endpoint` — tests first (red)
3. `feat(#85): add backend code-review endpoint with SSE streaming` — make tests green
4. `feat(#85): add codeReviewModel/effort settings` — settings additions
5. `feat(#85): add Review button and CodeReviewDialog to WorkspaceDiffView` — UI trigger
6. `feat(#85): render AI review comments inline with badge styling` — display
7. `feat(#85): add CodeReviewSummary with navigation index` — summary

## Library Research

No new dependencies needed. Reuses:
- Claude Agent SDK (already integrated)
- Existing SSE streaming infrastructure
- Existing MarkdownRenderer for comment bodies
- Existing DiffViewer inline comment system
