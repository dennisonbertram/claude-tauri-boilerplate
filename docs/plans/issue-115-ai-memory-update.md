# Issue #115: AI Memory Update from Review Feedback

## Goal

Add a bounded MVP that nudges the user to capture durable guidance in repo memory after review feedback or a workspace merge, while continuing to use the existing memory files and memory routes already in the app.

## Scope

- Prompt the user to update memory after they submit review feedback that changes durable guidance.
- Prompt the user to update memory after a successful workspace merge.
- Reuse the existing Settings -> Memory UI and `/api/memory` persistence routes.
- Keep future sessions using the same repo-scoped memory files already loaded by settings startup.

## Acceptance Criteria

- A review action with feedback surfaces a memory-update prompt.
- A successful merge surfaces a memory-update prompt.
- The prompt can take the user to the existing Memory tab in Settings.
- Memory edits continue to persist through the existing memory file routes.
- Reloading the app/session still loads the same repo memory files.

## Checklist

- [x] Add regression tests for the review-feedback memory prompt.
- [x] Add regression tests for the post-merge memory prompt.
- [x] Implement the prompt helper and wire it into review/merge flows.
- [x] Verify memory persistence and repo-scoped reuse with targeted tests.
- [x] Record implementation notes and validation results.

## Validation Notes

- Desktop regression tests now cover:
  - repo-scoped `reviewMemory` / `mergeMemory` prompt persistence
  - workflow settings UI for editing those prompts
  - review-feedback prompt flow into a queued memory draft
  - post-merge prompt flow into a queued memory draft
  - Memory tab consuming the queued draft into `MEMORY.md`, including the first-run case where no memory files exist yet
- Manual browser verification passed in this worktree:
  - Settings → Workflows shows the new `Review Memory Prompt` and `Merge Memory Prompt` editors.
  - Settings → Memory consumes a queued `MEMORY.md` draft even when the repo has no memory files yet.
  - Saving that draft creates `MEMORY.md` through the existing `/api/memory` route, and a follow-up `GET /api/memory/MEMORY.md` returns the persisted content.
