Implemented. I found the regression still present, added a focused frontend test first, then applied a minimal fix in `ChatPage`, and updated the required handoff note.

- **Completed**
  - Cleared chat message state when switching to a different non-null session (before fetching persisted messages), so old messages are removed immediately when moving to a new empty session.
  - Added a regression test for session-switch clearing behavior.
  - Added/update handoff doc for issue #144 with status/tests/manual note/risks.

- **Files changed**
  - [`apps/desktop/src/components/chat/ChatPage.tsx`](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-144/apps/desktop/src/components/chat/ChatPage.tsx)
  - [`apps/desktop/src/components/chat/__tests__/ChatPageSessionSwitch.test.tsx`](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-144/apps/desktop/src/components/chat/__tests__/ChatPageSessionSwitch.test.tsx)
  - [`docs/plans/issue-144-wave-3-handoff.md`](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-144/docs/plans/issue-144-wave-3-handoff.md)

- **Tests run (file-scoped)**
  - Command:
    - `cd apps/desktop && pnpm exec vitest run src/components/chat/__tests__/ChatPageSessionSwitch.test.tsx`
  - Result: **pass** (`1 passed`)

- **Manual browser-control verification**
  - Not executed in this step.
  - Suggested check: create/select two sessions with visible messages, then create/select a new empty session via “New Chat” and verify the previous messages disappear immediately from the chat area.

- **Risks / follow-up**
  - Regression appears localized to the empty-session UI transition path only.
  - Primary follow-up is manual browser verification against the integrated branch.
