# Engineering Log

Record of bugs found, fixes applied, and technical decisions made during development.

## Format

Each entry follows this format:
```
### YYYY-MM-DD: [Brief Title]

**Type**: Bug Fix | Technical Decision | Refactor | Performance
**Impact**: High | Medium | Low
**Description**: What happened and what was done
**Regression Test**: Link to test file if applicable
**Related Issue**: GitHub issue link if applicable
```

---

### 2026-03-17: Issues 141-151 Wave 3 Integration

**Type**: Bug Fix
**Impact**: High
**Description**: Completed the wave-3 issue batch on `codex/wave3-merge` for GitHub issues `#141` through `#151`. Added regression coverage for fixes that were already present on the current integration line (`#142`, `#143`, `#145`, `#146`, `#147`, `#148`, `#149`), implemented missing code changes for stale-session recovery (`#141`), empty-session clearing on chat switch (`#144`), shared generative UI parser extraction (`#150`), and tool-output sanitization (`#151`), then merged all issue branches into a single integration branch and validated the combined result with targeted Bun/Vitest runs plus manual browser and curl smoke checks.

**Regression Test**: `apps/server/src/routes/chat.test.ts`, `apps/server/src/routes/sessions-management.test.ts`, `apps/server/src/index.test.ts`, `apps/desktop/src/components/workspaces/__tests__/AddProjectDialog.test.tsx`, `apps/desktop/src/components/sessions/SessionSidebar.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageSessionSwitch.test.tsx`, `apps/desktop/src/App.test.tsx`, `apps/desktop/src/hooks/useCommands.test.ts`, `apps/desktop/src/tauri-config.test.ts`, `apps/desktop/src/lib/__tests__/parseToolInput.test.ts`, `apps/desktop/src/lib/__tests__/sanitizeToolOutput.test.ts`, `apps/desktop/src/components/chat/__tests__/WebFetchDisplay.test.tsx`, `apps/desktop/src/components/chat/__tests__/WebSearchDisplay.test.tsx`
**Related Issue**: GitHub issues `#141`, `#142`, `#143`, `#144`, `#145`, `#146`, `#147`, `#148`, `#149`, `#150`, `#151`

### 2026-03-17: Persistent Toast Bug Found in Session Export

**Type**: Bug
**Impact**: Medium
**Description**: During browser automation testing, discovered that session export toasts (triggered by `/export` command) never auto-dismiss and have no close button. Multiple exports stack indefinitely as `data-visible="true"` toast elements, covering the status bar. The toasts use Sonner library (`data-sonner-toaster`). The fix is to ensure the `toast()` call for export success includes a `duration` (e.g., 4000ms) or that Sonner's default auto-dismiss behavior is not inadvertently disabled (e.g., by passing `duration: Infinity`).

**Regression Test**: None yet — needs one.
**Related Issue**: None filed yet.

### 2026-03-17: Issues 121-139 Wave 4 Integration

**Type**: Bug Fix
**Impact**: High
**Description**: Processed the Wave 4 issue batch on `codex/wave4-merge` for GitHub issues `#121`, `#122`, `#123`, `#124`, `#125`, `#128`, `#131`, `#132`, `#137`, `#138`, and `#139`. Added regression coverage for fixes that were already present on the integration line (`#121`, `#122`, `#124`, `#125`, `#131`, `#132`, `#137`, `#138`, `#139`), implemented the missing shared Team model source fix for `#123`, and merged the new chat scroll-affordance implementation for `#128`. Targeted Bun/Vitest and curl checks passed on the merge branch. Live browser verification also passed for Team dialog model values, stale validation clearing, export feedback, `/compact` auto-dismiss, status-bar permission labels, and the New Chat loaded-session path. The remaining blocker is `#128`: in the live browser, scrolling a long chat upward still does not surface the `Latest` affordance even after a merge-branch cleanup attempt, so the wave should stop on the integration branch until that behavior is resolved.

**Regression Test**: `apps/server/src/routes/memory.path-regression.test.ts`, `apps/server/src/routes/workspaces.test.ts`, `apps/desktop/src/components/__tests__/TeamCreationDialog.test.tsx`, `apps/desktop/src/hooks/useSessions.test.ts`, `apps/desktop/src/components/chat/__tests__/MessageList.test.tsx`, `apps/desktop/src/hooks/useCommands.test.ts`, `apps/desktop/src/components/__tests__/StatusBar.test.tsx`, `apps/desktop/src/components/__tests__/NewChatBehavior.test.tsx`
**Related Issue**: GitHub issues `#121`, `#122`, `#123`, `#124`, `#125`, `#128`, `#131`, `#132`, `#137`, `#138`, `#139`

---

### 2026-03-15: Settings Status Tab & SSE Data Pipeline Fix

**Type**: Bug Fix + Feature
**Impact**: High
**Description**:

**Settings Status Tab**: Added a "Status" tab to the Settings panel that displays live runtime info from the Claude Agent SDK `session:init` event: model name (`claude-opus-4-6[1m]`), SDK version (`2.1.76`), session ID, MCP server status with color-coded indicators (5 servers: Box, Gmail, Notion, Linear, Google Calendar), and a scrollable list of 116 available tools.

**Critical Data Pipeline Fix**: Discovered and fixed a gap where `useChat`'s data channel events (sent as `data-stream-event` from the server) were never being consumed by `useStreamEvents` on the frontend. Added `onData` callback to `useChat` in `ChatPage.tsx` that forwards data parts to `useStreamEvents.processEvent()`. This fix enables tool call display, thinking blocks, permission requests, cost tracking, context usage indicators, and the new Status tab to receive live data.

**SSE Protocol Fixes**:
- Changed server data channel from `type: 'data'` to `type: 'data-stream-event'` (AI SDK v6 protocol)
- Merged multiple Claude `blockIndex` text streams into a single AI SDK text stream, preventing duplicate empty assistant message bubbles
- Fixed event ordering: AI SDK protocol events (`start`, `text-start`) now sent before data channel events

**UI Improvements**:
- Fixed sidebar scroll: added `min-h-0 overflow-hidden` to prevent session list from expanding page height
- Added orange Claude avatar icon and "Claude" label to assistant messages
- Filtered empty assistant message placeholders from rendering
- Made Settings tab bar horizontally scrollable (9 tabs)

**Files Changed**: `ChatPage.tsx`, `SettingsPanel.tsx`, `MessageList.tsx`, `SessionSidebar.tsx`, `App.tsx`, `useStreamEvents.ts`, `chat.ts`, `error-handler.ts`, `index.css`

---

### 2026-03-14: Project Setup

**Type**: Technical Decision
**Impact**: High
**Description**: Established project documentation structure, TDD policy, worktree workflow, and agent conventions. Set up comprehensive docs/ folder with indexes, logging system, and runbooks.
