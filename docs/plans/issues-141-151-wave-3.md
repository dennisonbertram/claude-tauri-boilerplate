# Issues 141-151 Wave 3

## Feature Description

Process the new GitHub issue wave for issues `#141` through `#151` using isolated git worktrees, six subagents in parallel for the first batch, and a follow-up cleanup/integration pass. This wave should start from `codex/wave2-cleanups`, not raw `main`, because several adjacent fixes already exist there and on the current code line.

## Priority and Dependencies

1. `#141` stale `claudeSessionId` retry loop
2. `#149` forked sessions missing Claude conversation history
3. `#147` SSE stream drop around 20 seconds
4. `#148` narrow-width chat layout break
5. `#145` session right-click context menu
6. `#146` `/compact` feedback toast visibility
7. `#142` export filename underscore sanitization
8. `#143` Add Project dialog eager validation
9. `#144` New Chat does not clear empty session UI
10. `#150` shared `parseToolInput` utility for generative UI
11. `#151` sanitize tool output for generative UI rendering

Notes:

- `#150` should land before or with `#151` because the sanitization work will likely share parsing and type-safe utility boundaries.
- `#141`, `#142`, `#143`, `#144`, `#145`, `#146`, and `#149` appear to already have code-level fixes on the current integration line. For those issues, the default action is regression coverage plus handoff documentation unless a gap is found during branch inspection.
- `#147` also appears to have a likely fix (`idleTimeout: 0` in the Bun server entrypoint), but it still needs explicit regression coverage and validation.
- `#148` appears to be addressed by the existing Tauri `minWidth: 800` config, but it still needs regression coverage and manual verification guidance.

## Acceptance Criteria

- [x] Live issue details are pulled from GitHub and reflected in the execution plan.
- [x] A new integration branch is created from `codex/wave2-cleanups`.
- [x] Up to six isolated issue worktrees are created for the first batch.
- [x] Every worked issue gets either:
  - [x] failing test first, then fix, then passing regression coverage, or
  - [x] regression coverage only when the fix already exists on the integration line.
- [x] `docs/plans/` contains wave-level handoff status and manual browser-control verification notes for every worked issue.
- [x] `docs/plans/INDEX.md` stays current.
- [ ] GitHub issues touched in this wave receive the `partially-done` label and a handoff comment pointing to the integration branch/commit with manual verification notes.
- [x] All issue branches are merged into a single wave integration branch and validated there.
- [x] A cleanup/review pass resolves red tests and integration conflicts before any merge to `main`.
- [ ] The wave lands on `main` only if `main` is clean at merge time; otherwise it stops on the integration branch with a blocker note.

## First Batch

- [x] `#141` regression coverage / stale session recovery validation
- [x] `#142` regression coverage / export filename sanitization
- [x] `#143` regression coverage / Add Project touched-state validation
- [x] `#144` regression coverage / empty-session message clearing
- [x] `#145` regression coverage / right-click context menu
- [x] `#146` regression coverage / visible compact feedback

## Second Batch

- [x] `#147` regression coverage / SSE idle-timeout protection
- [x] `#148` regression coverage / narrow-width protection
- [x] `#149` regression coverage / forked session history replay
- [x] `#150` implement shared `parseToolInput` utility and migrate callers
- [x] `#151` implement output sanitization utilities and migrate renderers

## Integration and Review

- [x] Merge first-batch branches into `codex/wave3-merge`
- [x] Run targeted frontend/server tests on the integrated branch
- [x] Merge second-batch branches into `codex/wave3-merge`
- [x] Run cleanup review for conflicts, red tests, and integration regressions
- [x] Validate browser/server behavior from the integration branch
- [ ] Update GitHub issues with branch, commit, manual test notes, and handoff guidance
- [ ] Merge `codex/wave3-merge` to `main` if `main` remains clean
