Implemented the work in this order:

1. Inspected current code first.
- `apps/server/src/routes/sessions.ts` already includes filename sanitization in export flow (`replace(/[^a-zA-Z0-9_-]/g, '_')`, collapse `_+`, trim ends), so no fix was needed there.

2. Added regression coverage only (no router code change).
- Added test to assert exports sanitize titles with parentheses into stable single-underscore filenames and avoid trailing-underscore artifacts in `Content-Disposition`:
  - [apps/server/src/routes/sessions-management.test.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-142/apps/server/src/routes/sessions-management.test.ts)

3. Added/update handoff doc.
- Created [docs/plans/issue-142-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-142/docs/plans/issue-142-wave-3-handoff.md) with issue status, files changed, test command/results, manual browser-control note, and risks/follow-up.

4. Targeted test run:
- Command: `cd apps/server && pnpm test -- src/routes/sessions-management.test.ts`
- Result: **pass** (`27 pass, 0 fail`)

No commit was made.
