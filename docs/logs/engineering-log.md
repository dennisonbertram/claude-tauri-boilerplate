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

### 2026-03-17: Persistent Toast Bug Found in Session Export

**Type**: Bug
**Impact**: Medium
**Description**: During browser automation testing, discovered that session export toasts (triggered by `/export` command) never auto-dismiss and have no close button. Multiple exports stack indefinitely as `data-visible="true"` toast elements, covering the status bar. The toasts use Sonner library (`data-sonner-toaster`). The fix is to ensure the `toast()` call for export success includes a `duration` (e.g., 4000ms) or that Sonner's default auto-dismiss behavior is not inadvertently disabled (e.g., by passing `duration: Infinity`).

**Regression Test**: None yet — needs one.
**Related Issue**: None filed yet.

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
