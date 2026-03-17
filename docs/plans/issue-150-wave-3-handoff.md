Implemented the shared parser utility and migrated the existing ad‑hoc parsing path through a compatibility wrapper.

- Changed files
  - [apps/desktop/src/lib/parseToolInput.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-150/apps/desktop/src/lib/parseToolInput.ts)
  - [apps/desktop/src/lib/__tests__/parseToolInput.test.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-150/apps/desktop/src/lib/__tests__/parseToolInput.test.ts)
  - [apps/desktop/src/components/chat/file-utils.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-150/apps/desktop/src/components/chat/file-utils.ts)
  - [docs/plans/issue-150-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-150/docs/plans/issue-150-wave-3-handoff.md)

- What was completed
  - Added `parseToolInput<T>(input: unknown, schema: z.ZodSchema<T>)` returning discriminated union `{ success: true, data: T } | { success: false, ... }` and never throwing.
  - Added tests for valid JSON, malformed JSON, schema mismatch, `null`, and `undefined`.
  - Updated `chat/file-utils.ts` to delegate through the new shared helper and keep old caller behavior by returning `{}` when parsing fails.

- Tests run
  - `pnpm --filter @claude-tauri/desktop test src/lib/__tests__/parseToolInput.test.ts` (attempted, failed due environment)
  - Failure cause: `vitest` unavailable because dependencies were not installed, and `pnpm install` could not reach `registry.npmjs.org` (offline/ENOTFOUND), so tests could not execute in this environment.

- Manual browser-control verification note
  - Not run here. Suggested check: open `http://localhost:1420`, trigger tool outputs for Read/Write/Edit/Grep/WebSearch/WebFetch/Notebook/Glob and confirm malformed/skipped tool inputs still render as before.

- Issues encountered / follow-up
  - Main blocker: no network access to install dependencies in this sandbox, so runtime test execution was not possible.
  - No unrelated files were modified; no commit was made.