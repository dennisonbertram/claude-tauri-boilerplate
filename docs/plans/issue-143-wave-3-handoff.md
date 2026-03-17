Scope completed: I determined `AddProjectDialog` already includes the open-reset behavior for touched state, so no component code fix was required. I added frontend regression coverage only, plus a Wave 3 handoff note.

- [apps/desktop/src/components/workspaces/__tests__/AddProjectDialog.test.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-143/apps/desktop/src/components/workspaces/__tests__/AddProjectDialog.test.tsx)
  - New tests verify:
    - No “Path is required” message on initial open.
    - No stale validation text appears after a validation state and reopen cycle.
- [docs/plans/issue-143-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/workspaces/issue-143/docs/plans/issue-143-wave-3-handoff.md)
  - Added issue status, files changed, tests with pass/fail, manual-browser note, and follow-up risk/failure note.

Tests run (apps/desktop target):
- `pnpm exec vitest run src/components/workspaces/__tests__/AddProjectDialog.test.tsx`
- Result: **pass** (`2 passed`)

No commit was made, and docs/plans/INDEX.md was not modified.  
Manual browser-control verification was not run; the handoff doc includes a short follow-up step.
