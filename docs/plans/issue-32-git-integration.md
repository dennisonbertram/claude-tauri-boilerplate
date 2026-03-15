# Issue #32: Git Integration -- Branch Display, Diff Views, and Commit UI

## Description

Add basic git integration UI elements: a status bar showing the current branch, clean/dirty state, and modified file count. Backend endpoints provide git status and diff data.

## Acceptance Criteria

- [x] `GET /api/git/status` returns branch name, clean/dirty, modified/staged files
- [x] `GET /api/git/diff` returns the current diff output
- [x] `GitStatusBar.tsx` shows branch name with git icon, clean/dirty dot, file count badge
- [x] Status bar integrated into app footer
- [x] Backend tests pass (7 tests)
- [x] Frontend tests pass (8 tests)
- [x] All existing tests still pass

## Implementation Checklist

- [x] Add `GitStatus`, `GitDiff`, `GitFileStatus` types to shared package
- [x] Implement `createGitRouter()` with `/status` and `/diff` endpoints
- [x] Register git router in `app.ts`
- [x] Write backend tests (`git.test.ts`) -- 7 tests covering status shape, branch validation, file status parsing, clean/dirty consistency, non-git directories, diff output
- [x] Write frontend tests (`GitStatusBar.test.tsx`) -- 8 tests covering branch rendering, clean/dirty indicators, file count badge, error states, fetch failures, icon presence
- [x] Implement `GitStatusBar.tsx` component with polling
- [x] Integrate into `App.tsx` footer

## Status: DONE
