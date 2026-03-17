# Issues 121-139 Wave 4

## Feature Description

Process the next GitHub issue wave from the current integration line by starting on `codex/wave3-merge`, creating isolated issue worktrees, and running up to ten tmux-backed subagents in parallel. This wave covers the newest open bug-fix and UX tickets around workspace lifecycle, team creation, memory path resolution, export feedback, and chat/status-bar behavior.

## Priority and Dependencies

1. `#121` memory directory path resolves from `apps/server` instead of project root
2. `#123` Create Team dialog has outdated model IDs
3. `#124` duplicate workspace error leaks internal branch naming
4. `#125` `/export` and session export menu provide no feedback
5. `#128` scroll-to-bottom affordance for long chat histories
6. `#131` project delete does not clean up workspace branches
7. `#132` workspace chat history is lost when switching views
8. `#137` Team creation validation error does not clear while editing
9. `#138` `/compact` action toast needs explicit duration regression coverage and status audit
10. `#139` StatusBar permission mode ignores settings
11. `#122` New Chat loaded/forked-session regression is already expected to be covered on the current line; validate and document during integration before marking on GitHub.

Notes:

- Every issue branch must start by checking whether `codex/wave4-merge` already contains the functional fix. If the fix already exists, the task becomes regression coverage plus handoff documentation only.
- Frontend Vitest must run from `apps/desktop` so nested worktrees do not pollute discovery.
- Browser verification should reuse the existing dev instance on port `1420` when available.
- GitHub updates must use `env -u GITHUB_TOKEN -u GH_TOKEN gh ...` if the default environment token is read-only.

## Acceptance Criteria

- [x] Live issue details were pulled directly from GitHub before work started.
- [x] A new integration branch `codex/wave4-merge` was created from `codex/wave3-merge`.
- [ ] Ten isolated issue worktrees are created for the first parallel batch.
- [ ] Every worked issue gets either:
  - [ ] a failing test first, then a fix, then passing regression coverage, or
  - [ ] regression coverage only when the fix already exists on the integration line.
- [ ] `docs/plans/` contains the wave plan plus per-issue handoff notes with short manual browser-control verification steps.
- [ ] `docs/plans/INDEX.md` remains current.
- [ ] GitHub issues touched in this wave receive the `partially-done` label and a handoff comment pointing to the integration branch or commit with manual test notes.
- [ ] All issue branches are merged into `codex/wave4-merge`.
- [ ] Targeted frontend and server validation pass on `codex/wave4-merge`.
- [ ] A cleanup/review wave resolves integration conflicts and red tests before any merge to `main`.
- [ ] `codex/wave4-merge` lands on `main` only if `main` is still clean at merge time.

## First Parallel Batch

- [ ] `#121` memory path resolution
- [ ] `#123` Create Team model IDs
- [ ] `#124` duplicate workspace error messaging
- [ ] `#125` export feedback toast
- [ ] `#128` chat scroll-to-bottom affordance
- [ ] `#131` project delete workspace branch cleanup
- [ ] `#132` workspace chat history reload
- [ ] `#137` Team dialog validation clearing
- [ ] `#138` compact toast duration audit/regression
- [ ] `#139` permission mode status bar binding

## Integration and Review

- [ ] Validate `#122` on the current integration line and add a handoff note if no code change is needed.
- [ ] Merge issue branches into `codex/wave4-merge`.
- [ ] Run targeted frontend Vitest from `apps/desktop`.
- [ ] Run targeted Bun/server tests from `apps/server`.
- [ ] Perform manual curl and browser verification notes for each worked issue.
- [ ] Run a short cleanup/review pass for regression and merge mistakes.
- [ ] Update GitHub issues with status labels, comments, and handoff guidance.
- [ ] Merge `codex/wave4-merge` to `main` only if `main` remains clean.
