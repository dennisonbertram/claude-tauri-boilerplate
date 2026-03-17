Completed. I implemented a targeted sanitizer and wired it into generative tool rendering before output display, including web tool components and generic tool fallback formatting.

1. What was completed
- Added `apps/desktop/src/lib/sanitizeToolOutput.ts` with shared sanitization helpers:
  - strips control characters
  - caps text length with `DEFAULT_TOOL_OUTPUT_MAX_LENGTH`
  - validates URL protocols to allow only `http:`, `https:`, `file:` and rejects others
- Added focused unit tests for sanitizer behavior, covering:
  - clean text passthrough
  - control-character stripping
  - length capping
  - URL allowlist for http/https/file and blocking `javascript:` / `data:`
- Wired sanitization into:
  - [apps/desktop/src/components/chat/WebFetchDisplay.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/WebFetchDisplay.tsx)
  - [apps/desktop/src/components/chat/WebSearchDisplay.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/WebSearchDisplay.test.tsx)
  - [apps/desktop/src/components/chat/ToolCallBlock.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/ToolCallBlock.tsx) (generic fallback input/output sanitization)
- Updated component tests to verify integration:
  - [apps/desktop/src/components/chat/__tests__/WebFetchDisplay.test.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/__tests__/WebFetchDisplay.test.tsx)
  - [apps/desktop/src/components/chat/__tests__/WebSearchDisplay.test.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/__tests__/WebSearchDisplay.test.tsx)
- Added [docs/plans/issue-151-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/docs/plans/issue-151-wave-3-handoff.md) with status, file list, tests, manual note, risks.

2. Files changed
- [apps/desktop/src/lib/sanitizeToolOutput.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/lib/sanitizeToolOutput.ts)
- [apps/desktop/src/lib/__tests__/sanitizeToolOutput.test.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/lib/__tests__/sanitizeToolOutput.test.ts)
- [apps/desktop/src/components/chat/WebFetchDisplay.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/WebFetchDisplay.tsx)
- [apps/desktop/src/components/chat/WebSearchDisplay.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/WebSearchDisplay.tsx)
- [apps/desktop/src/components/chat/ToolCallBlock.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/ToolCallBlock.tsx)
- [apps/desktop/src/components/chat/__tests__/WebFetchDisplay.test.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/__tests__/WebFetchDisplay.test.tsx)
- [apps/desktop/src/components/chat/__tests__/WebSearchDisplay.test.tsx](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/apps/desktop/src/components/chat/__tests__/WebSearchDisplay.test.tsx)
- [docs/plans/issue-151-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-151/docs/plans/issue-151-wave-3-handoff.md)

3. Tests run (pass/fail)
- `cd apps/desktop && pnpm exec vitest run src/lib/__tests__/sanitizeToolOutput.test.ts src/components/chat/__tests__/WebFetchDisplay.test.tsx src/components/chat/__tests__/WebSearchDisplay.test.tsx`
- Result: **pass** (`42 passed`)

4. Manual browser-control verification note
- Not run in this environment.
- To validate manually when available: in `http://localhost:1420`, trigger `WebSearch` and `WebFetch` tool outputs and confirm unsafe URLs (`javascript:`/`data:`) are not clickable and render as safe placeholders, while valid `http/https/file` URLs remain clickable.

5. Risks / follow-up
- `WebSearchDisplay` now shows `Blocked URL` for invalid result URLs; if you prefer hiding those rows or different fallback text, I can adjust.
- `ToolCallBlock` sanitizes generic fallback strings, but notebook/image-specific rendering still deserves a follow-up audit if richer generative UI surfaces are added.
