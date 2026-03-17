Implemented Issue #75 in a focused frontend-only slice: failing Bash CI outputs are now detected from stream events, surfaced as actionable UI, and wired to a `Fix Errors` flow.

### 1. Scope completed
- Added CI failure detection in stream reducer for `tool:result` events and stored structured context on each Bash `ToolCallState`.
- Added UI affordance for detected CI failures with:
  - summary
  - failing check list
  - `Fix Errors` action
- Passed action callback from streamed tool rendering up to chat submission path to trigger a remediation follow-up message.
- Added/updated tests for both reducer behavior and UI callback action.
- Added and indexed issue-specific documentation artifacts.

### 2. Files changed
- [apps/desktop/src/hooks/useStreamEvents.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/apps/desktop/src/hooks/useStreamEvents.ts)
- [apps/desktop/src/hooks/useStreamEvents.test.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/apps/desktop/src/hooks/useStreamEvents.test.ts)
- [apps/desktop/src/components/chat/ToolCallBlock.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/apps/desktop/src/components/chat/ToolCallBlock.tsx)
- [apps/desktop/src/components/chat/ToolCallBlock.test.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/apps/desktop/src/components/chat/ToolCallBlock.test.tsx)
- [apps/desktop/src/components/chat/MessageList.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/apps/desktop/src/components/chat/MessageList.tsx)
- [apps/desktop/src/components/chat/ChatPage.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/apps/desktop/src/components/chat/ChatPage.tsx)
- [docs/plans/issue-75-ci-forwarding.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/docs/plans/issue-75-ci-forwarding.md)
- [docs/plans/INDEX.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/docs/plans/INDEX.md)
- [docs/implementation/issue-75-wave-1-subagent.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/docs/implementation/issue-75-wave-1-subagent.md)
- [docs/implementation/INDEX.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/docs/implementation/INDEX.md)

### 3. Tests run
- Attempted targeted Vitest run:
  - `pnpm test src/hooks/useStreamEvents.test.ts src/components/chat/ToolCallBlock.test.tsx`
  - From: `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-75/apps/desktop`
  - Result: failed before execution (`vitest: command not found`), so tests could not run in this environment without installing dependencies.

### 4. Manual verification
- Direct browser/manual UI verification not performed in this environment.
- `gh issue view 75 ...` was also attempted for issue context as requested, but blocked by network:
  - `error connecting to api.github.com`
- Suggested browser-control smoke once the app is running:
  1. Open a chat that produces a failing Bash or CI-style tool result.
  2. Confirm the tool block renders the failure summary and a `Fix Errors` action.
  3. Click `Fix Errors` and verify the chat submits a remediation follow-up prompt.
  4. Confirm a new assistant/tool run starts with the failure context preserved.

### 5. Risks/blockers
- Main blocker: testing is blocked by missing `vitest` binary in this worktree (`pnpm` dependencies likely not installed or unavailable).
- CI-failure detection is text-heuristic-based (`extractCiFailuresFromToolResult`) and may miss uncommon CI log formats until validated against real pipeline output.
- Backend behavior was not changed; no backend smoke test was run (as scope was frontend-only).

### 6. Suggested next step
1. Install dependencies or ensure workspace tooling is available, rerun:
   - `pnpm test src/hooks/useStreamEvents.test.ts src/components/chat/ToolCallBlock.test.tsx`
2. Expand detector patterns if real CI logs show misses.
3. Add an additional integration-style test or manual run proving `Fix Errors` sends follow-up prompt and triggers a fresh tool run/retry path.
