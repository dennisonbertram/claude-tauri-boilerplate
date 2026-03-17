Implemented as requested with minimal scope.

- [apps/server/src/routes/chat.ts] (`/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-149/apps/server/src/routes/chat.ts`) already had the forked-session history injection logic (adds `<previous_conversation>` when a prior-session exists and `claudeSessionId` is absent), so no server code fix was needed.
- Added regression coverage in [apps/server/src/routes/chat.test.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-149/apps/server/src/routes/chat.test.ts): verifies forked session behavior sends DB message history in the injected prompt and does not set resume when `claudeSessionId` is missing.
- Added handoff note file [docs/plans/issue-149-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-149/docs/plans/issue-149-wave-3-handoff.md) with required fields:
  - issue status
  - files changed
  - tests run + pass/fail
  - short manual browser-control note
  - risks/follow-up

Tests run:
- `bun test apps/server/src/routes/chat.test.ts` → **passed** (25/25).

Manual browser-control verification note:
- Not run (server-only change).

Risks / follow-up:
- If forked sessions are created without persisted message history rows, context injection cannot recover prior conversation.
