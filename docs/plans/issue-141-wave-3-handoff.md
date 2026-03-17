Implemented.

- I inspected the existing stale-session recovery logic in `apps/server/src/routes/chat.ts`.
- I treated raw UUID session errors as a stale-session indicator (new test coverage added for this path), then updated the retry logic to clear the stale `claudeSessionId` and retry once without resume.

### What was completed
1. Added a regression test for stale-session recovery when the SDK throws the raw session UUID as the error message:
   - verifies one automatic retry without `resume`
   - verifies the first call resumes with the stale id, second call does not
   - verifies a new `claudeSessionId` is persisted after successful retry
2. Updated stale-session detection in `apps/server/src/routes/chat.ts` to treat raw exact-session-id errors as stale.
3. Ensured stale-session cleanup uses the caller session id when present, even if internal session state has not been created yet.

### Files changed
- [apps/server/src/routes/chat.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-141/apps/server/src/routes/chat.ts)
- [apps/server/src/routes/chat.test.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-141/apps/server/src/routes/chat.test.ts)
- [docs/plans/issue-141-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-141/docs/plans/issue-141-wave-3-handoff.md)

### Tests run
- `pnpm --filter @claude-tauri/server test src/routes/chat.test.ts`
- Result: `24 pass, 0 fail`

### Manual browser-control verification
- Not run in this pass (server-path-only change; no frontend/browser session was executed).

### Risks / follow-up
- The raw-UUID matcher is deliberately narrow (`error.message.trim() === currentResumeId`) and may miss stale-session failures with different wording; that's intentional for now to avoid false positives.
- Follow-up: run the broader server test set and perform one manual end-to-end `/api/chat` smoke check once available.