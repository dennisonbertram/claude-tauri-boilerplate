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

### 2026-03-25: Plaid hosted-link flow rejected invalid delivery_method

**Type**: Bug Fix
**Impact**: High
**Description**: Reproduced the Finance `Connect Bank Account` flow against live Plaid sandbox credentials and found two separate Plaid integration bugs. First, link token creation was failing with Plaid `INVALID_FIELD` because the server sent `hosted_link.delivery_method: 'DELIVERY_METHOD_HOSTED'` for both initial connect and reauth. Second, the frontend API layer expected camelCase link-session fields while the server returned snake_case fields, which could open a blank popup by calling `window.open(undefined, '_blank')`; the finalize call also sent `publicToken` while the server required `public_token`. Added regression coverage for both server and desktop API behavior, removed the invalid hosted-link delivery field from both Plaid route payloads, normalized link-session responses to camelCase in the desktop API layer, and changed finalize requests to send `public_token`. Manual verification confirmed the live API now returns a hosted Plaid URL and the frontend connect flow issues `POST /api/plaid/link/start` successfully.
**Regression Test**: `apps/server/src/routes/plaid.test.ts`, `apps/server/src/services/plaid-encryption.test.ts`, `apps/desktop/src/lib/api/plaid-api.test.ts`, `apps/desktop/src/components/finance/__tests__/ConnectBankButton.test.tsx`
**Related Issue**: GitHub issue `#435`

### 2026-03-25: Plaid browser callback finalizes from state-only redirects

**Type**: Bug Fix
**Impact**: High
**Description**: Fixed the remaining browser/dev-mode Plaid Hosted Link handoff so the app works after account confirmation instead of landing on an empty callback shell. The server now appends the generated session `state` to custom browser callback URIs, and `/api/plaid/link/finalize` can resolve the `public_token` from Plaid `link/token/get` when Hosted Link redirects back without it. The desktop callback parser and finalize client were updated to allow state-only browser callbacks, and the Plaid sandbox testing doc plus agent guidance now point to the working `agent-browser` flow and sandbox credentials.
**Regression Test**: `apps/server/src/routes/plaid.test.ts`, `apps/desktop/src/lib/__tests__/plaid-link.test.ts`, `apps/desktop/src/lib/api/plaid-api.test.ts`
**Related Issue**: GitHub issue `#435`

---

### 2026-03-25: Welcome screen pre-chat selectors now explain optionality and scope

**Type**: Bug Fix
**Impact**: Medium
**Description**: Fixed GitHub issue `#425` by adding helper copy to the welcome-screen profile, project, and model selectors so users can tell what each choice affects before sending the first message. The profile selector now explains that it is optional and sets agent behavior for the chat, the project selector is framed as optional workspace context, and the model selector clarifies that it affects the current session while updating the saved default model. The change preserves the composer as the dominant primary action and was manually verified in the live browser against the worktree dev app.
**Regression Test**: `apps/desktop/src/components/chat/__tests__/WelcomeScreen.selectors.test.tsx`, `apps/desktop/src/components/chat/__tests__/WelcomeScreen.profiles.test.tsx`, `apps/desktop/src/components/chat/__tests__/WelcomeScreen.model.test.tsx`
**Related Issue**: GitHub issue `#425`

---

### 2026-03-25: Desktop Vitest warning cleanup for async effects and nested interactive markup

**Type**: Bug Fix
**Impact**: High
**Description**: Cleaned up the remaining noisy desktop frontend Vitest output without masking real issues. Fixed two actual nested-button bugs by restructuring the session delete confirmation row and the grep file-header copy control so interactive elements are siblings instead of nested buttons. Reduced async warning noise by isolating unrelated status/settings fetch work in focused tests, adding a scroll-area test double that preserves viewport refs while avoiding Base UI mount chatter, skipping repeated secure-credential fallback warnings during tests, and updating copy/shortcut/session hook tests to await state changes correctly. Also prevented `ProjectSidebar` from scheduling empty workspace-status updates when no workspaces are present.
**Regression Test**: `apps/desktop/src/components/__tests__/StatusBar.test.tsx`, `apps/desktop/src/components/__tests__/PermissionMode.regression.test.tsx`, `apps/desktop/src/components/settings/SettingsPanel.test.tsx`, `apps/desktop/src/components/sessions/SessionSidebar.test.tsx`, `apps/desktop/src/components/chat/__tests__/FileOperations.test.tsx`, `apps/desktop/src/components/chat/__tests__/DiffViewer.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageTransport.test.tsx`, `apps/desktop/src/hooks/useSessions.test.ts`
**Related Issue**: N/A

---

### 2026-03-22: Welcome message should auto-send only once

**Type**: Bug Fix
**Impact**: Medium
**Description**: `ChatPage` now tracks when an initial welcome message has already been auto-sent, preventing duplicate sends when `sessionId` changes while the same `initialMessage` remains present during a short render window. This keeps first-message flow from creating duplicate prompt submissions during session bootstrap.
**Regression Test**: `apps/desktop/src/components/chat/__tests__/ChatPageSessionSwitch.test.tsx`
**Related Issue**: GitHub issue `#297`

---

### 2026-03-25: Release readiness cleanup for build, auth, and test stability

**Type**: Bug Fix
**Impact**: High
**Description**: Cleared a pre-push release blocker sweep across server and desktop. Fixed a syntax error in `apps/server/src/db/migrations.ts` that broke builds, aligned auth fallback behavior with the documented unauthenticated timeout/error contract in `apps/server/src/services/auth.ts`, repaired outdated desktop test fixtures so TypeScript and workspace/profile typing compile cleanly, and consolidated Claude SDK route/service tests onto a shared module mock helper to avoid cross-file mocking instability under Bun. Also corrected an over-specific prompt expectation in `apps/server/src/routes/chat.test.ts` so grouped chat-route runs match actual prompt assembly behavior.
**Regression Test**: `apps/server/src/routes/chat-commands.test.ts`, `apps/server/src/routes/chat-workspace.test.ts`, `apps/server/src/routes/chat.test.ts`, `apps/server/src/routes/chat-errors.test.ts`
**Related Issue**: N/A

---

### 2026-03-22: Browser testing process moved to agent-browser

**Type**: Technical Decision
**Impact**: Medium
**Description**: Updated the project's default browser testing process to use the `agent-browser` CLI instead of the Playwright MCP preset. The `/browser` workflow prompt, browser-testing runbook, repo MCP defaults, and agent instructions now point to `agent-browser` commands and artifact paths under `.claude/browser-artifacts/agent-browser`. The Settings > MCP presets were also narrowed so `agentation` remains available as a separate visual-feedback MCP tool rather than being conflated with `agent-browser`.
**Regression Test**: `apps/desktop/src/lib/workflowPrompts.test.ts`, `apps/desktop/src/components/__tests__/McpPanel.test.tsx`
**Related Issue**: N/A

---

### 2026-03-19: Hardening review converted into top-three implementation tickets

**Type**: Technical Decision
**Impact**: High
**Description**: Converted the boilerplate hardening review into a concrete, scoped follow-up pass focused on the three highest-risk items that do not require changing the current Claude runtime choice. Added `docs/plans/runtime-hardening-pass-top-3.md` and opened GitHub issues `#231` (request-scoped env isolation), `#232` (sensitive log redaction), and `#233` (workspace path boundary enforcement). This establishes the initial hardening queue the user can implement directly.
**Regression Test**: Not applicable yet — implementation work is tracked per issue.
**Related Issue**: GitHub issues `#231`, `#232`, `#233`

### 2026-03-19: Runtime hardening pass implemented for env isolation, safe logging, and workspace path boundaries

**Type**: Bug Fix
**Impact**: High
**Description**: Implemented the top-three runtime hardening pass. Request-scoped Claude/provider/auth env handling now uses SDK `options.env` snapshots instead of mutating global `process.env`. Chat logging was reduced to allowlisted metadata, with raw prompt/body/context logging removed and sidecar stdout/stderr forwarding gated behind explicit redacted debug logging. Workspace file access now uses a shared documented allowlist policy: `additionalDirectories` are restricted to the project repo root and workspace worktree root, while attachment references are limited to existing files inside the workspace root, including canonical/symlink escape rejection. Also split auto-namer implementation into `auto-namer-impl.ts` so its direct tests remain stable when route-level tests mock the public service module.
**Regression Test**: `apps/server/src/services/claude.test.ts`, `apps/server/src/routes/auth.test.ts`, `apps/server/src/services/auto-namer.test.ts`, `apps/server/src/services/context-summary.test.ts`, `apps/server/src/routes/workspaces.test.ts`, `apps/server/src/routes/chat-workspace.test.ts`, `apps/server/src/utils/paths.test.ts`
**Related Issue**: GitHub issues `#231`, `#232`, `#233`

---

### 2026-03-19: ISSUE-007 — Slug-like project names displayed in Workspaces sidebar

**Type**: Bug Fix
**Impact**: Medium
**Description**: Projects added when an older version of the code was running (or inserted directly into the DB) could have names like "reconcile-ws-fG6AeG" stored in the `projects.name` column. The `addProject` service already derives the name correctly via `basename(canonical)` for new projects, but existing rows with slug-style names were displayed raw in the sidebar. Root cause: display layer had no defensive fallback. Fix: added `getProjectDisplayName()` helper in `apps/desktop/src/lib/project-display.ts` that detects slug-like names (suffix of 5-8 mixed-case alphanumeric characters) and falls back to `basename(repoPathCanonical)`. `ProjectSidebar.tsx` now calls this helper instead of using `project.name` directly. No DB migration required — purely a display-layer change.
**Regression Test**: `apps/desktop/src/lib/__tests__/project-display.test.ts` (17 tests for the utility), plus 2 new tests in `apps/desktop/src/components/workspaces/__tests__/ProjectSidebar.test.tsx`.
**Related Issue**: ISSUE-007

---

### 2026-03-19: Session search query parameter not passed to listSessions

**Type**: Bug Fix
**Impact**: Medium
**Description**: The GET `/api/sessions` route handler called `listSessions(db)` without forwarding the `q` query parameter sent by the frontend. As a result, the sidebar search input had no effect — all sessions were always returned regardless of the search term. Fix: extract `c.req.query('q')` in the route handler and pass it to `listSessions(db, searchQuery)`, which already supported the optional search parameter.
**Regression Test**: `apps/server/src/routes/sessions.test.ts` — three new tests: matching query filters results, non-matching query returns empty array, empty query returns all sessions.
**Related Issue**: —

---

### 2026-03-18: Issue 85 AI code review feature implementation

**Type**: New Feature
**Impact**: High
**Description**: Implemented AI-powered code review for workspace diffs (issue #85). Added `POST /api/workspaces/:id/code-review` backend endpoint that fetches the workspace diff, calls Claude via `streamClaude`, and parses the JSON response into a structured `CodeReviewResult`. Frontend additions: `CodeReviewDialog` for editing the prompt before review, `CodeReviewSummary` for displaying the review result with severity badges and a comment index, and inline AI comment rendering in `WorkspaceDiffView` with an AI badge. Settings: added `codeReviewModel`, `codeReviewEffort`, and `codeReview` workflow prompt to `AppSettings`. Left-click Review button starts with defaults; right-click opens the dialog to customize prompt/model/effort.
**Regression Test**: `apps/server/src/routes/code-review.test.ts` (5 tests)
**Related Issue**: #85

---

### 2026-03-18: Issue 90 workspace notes/scratchpad with .context directory

**Type**: Feature
**Impact**: Medium
**Description**: Implemented GitHub issue #90. Created GET/PUT `/api/workspaces/:id/notes` endpoints that read/write `.context/notes.md` in the workspace worktree. On workspace creation, the orchestrator now creates `.context/notes.md` and adds `.context` to the repo's `.git/info/exclude` so the directory is invisible to git (no changes in status/diffs/changed-files). Added a Notes tab to WorkspacePanel with a textarea editor, markdown preview toggle (uses existing MarkdownRenderer), debounced auto-save, and a brief "Saved" confirmation. Notes are injected as `<notes>...</notes>` context block in the chat system prompt when a workspaceId is provided.
**Regression Test**: `apps/server/src/routes/workspace-notes.test.ts` (9 tests)
**Related Issue**: GitHub issue `#90`

### 2026-03-18: Issue #102 LaTeX and Mermaid rendering in MarkdownRenderer

**Type**: Feature
**Impact**: Medium
**Description**: Implemented GitHub issue `#102` - LaTeX math rendering and Mermaid diagram support in chat messages. Added `remark-math` + `rehype-katex` plugins to the existing `react-markdown` pipeline for inline (`$...$`) and block (`$$...$$`) LaTeX. Created `MermaidDiagram.tsx` component with async rendering, loading state, error state, fullscreen modal with pan/zoom, and dark/light theme support via mermaid's built-in theme config. Modified the `pre` renderer in `MarkdownRenderer` to pass-through without wrapping when a mermaid child is detected (preventing a spurious `<pre>` around the diagram). `KaTeX CSS` is imported directly in the component. 13 new TDD tests cover LaTeX inline/block rendering, mermaid diagram detection, error handling, unicode support, and the expand button.
**Regression Test**: `apps/desktop/src/components/chat/__tests__/MarkdownRendererLatexMermaid.test.tsx`
**Related Issue**: GitHub issue `#102`

### 2026-03-18: Issue 103 notifications, sounds, unread indicators, quit confirmation

**Type**: Feature
**Impact**: Medium
**Description**: Implemented GitHub issue `#103`. Added browser Notification API integration via `notifications.ts` service with `requestNotificationPermission`, `sendNotification`, and `playNotificationSound` (Web Audio API). Added `useUnread` hook for transient per-workspace unread tracking. Extended `useSubagents` with an `onRootTaskComplete` callback that fires when a root-level agent task reaches a terminal state. Threaded `onTaskComplete` through `ChatPage` and `WorkspacePanel`. Wired everything in `AppLayout`: requests notification permission on load, plays sound and shows desktop notification on task completion, marks workspaces unread, clears unread when workspace is selected. Added `beforeunload` handler for quit confirmation when agents are running. Added a Notifications tab to SettingsPanel with permission UI, sound selector with test button, and unread indicator toggle.
**Regression Test**: `apps/desktop/src/lib/__tests__/notifications.test.ts`, `apps/desktop/src/hooks/__tests__/useUnread.test.ts`
**Related Issue**: GitHub issue `#103`

---

### 2026-03-18: Issue #111 Tracker-first workspace creation

**Type**: Feature
**Impact**: High
**Description**: Implemented issue #111 — tracker-first workspace creation. Added `github_issue_*` columns to the workspaces DB table with a migration function. Changed `githubIssue` schema to use `number` (integer) instead of `id` (string) to match how GitHub identifies issues. Created two new backend endpoints: `GET /api/projects/:id/github-issues` (proxies to `gh` CLI) and `GET /api/projects/:id/branches` (git branch listing). Updated `CreateWorkspaceDialog` to have three modes: Manual (existing), Branch (select existing branch), GitHub Issue (search + select from GitHub). Added `<github-issue>` context block injection in the chat route when a workspace has linked GitHub issue data. Added a linked issue badge in WorkspacePanel header.
**Regression Test**: `apps/server/src/routes/github-issues.test.ts` (16 tests)
**Related Issue**: GitHub issue `#111`
### 2026-03-18: Issue 158 workflow memory 404 bootstrap fix

**Type**: Bug Fix
**Impact**: Medium
**Description**: Completed GitHub issue `#158` by removing the normal-startup workflow prompt `404` path from the desktop settings bootstrap. Instead of probing each `workflow-*.md` file individually through `/api/memory/:filename`, the desktop now loads `/api/memory` once and derives any repository workflow prompt overrides from the returned file list. That preserves the clean empty-state fallback when no overrides exist while eliminating the browser-visible missing-file request noise. Targeted regression coverage passed for both the workflow prompt loader and settings hydration path. Live browser verification was attempted but blocked in this sandbox because local dev-server port binding returned `EPERM`.
**Regression Test**: `apps/desktop/src/lib/workflowPrompts.test.ts`, `apps/desktop/src/hooks/useSettings.test.ts`
**Related Issue**: GitHub issue `#158`

### 2026-03-18: Persistent dashboard artifacts V1 Phase 1 foundation

**Type**: Technical Decision + Refactor
**Impact**: High
**Description**: Started Persistent Dashboard Artifacts V1 with a compatibility-first data-layer foundation. Added durable `artifacts`, `artifact_revisions`, and `message_parts` tables with indexes and migration safety, updated DB write paths so new messages always persist `message_parts`, and introduced a thread-read fallback that synthesizes a text part for legacy messages that only have `messages.content`. This preserves existing sessions while enabling durable inline artifact references for upcoming `/dashboard` flows.
**Regression Test**: `apps/server/src/db/db-artifacts.test.ts`, `apps/server/src/db/db.test.ts`
**Related Issue**: N/A

### 2026-03-18: Persistent dashboard artifacts baseline verification note

**Type**: Technical Decision
**Impact**: Low
**Description**: Re-ran targeted baseline suites called out as historical red tests in prior handoff notes before beginning this feature sweep. On this branch, the targeted suites (`auto-namer`, `ImageFeatures`, and `SettingsPanel`) all passed, so no unrelated baseline-fix scope was required for Phase 1.
**Regression Test**: `docs/testing/persistent-dashboard-artifacts-v1-baseline-2026-03-18.md`
**Related Issue**: N/A

### 2026-03-18: Issue 92 assistant response metadata completed

**Type**: Bug Fix
**Impact**: Medium
**Description**: Completed the remaining assistant-response transparency work for GitHub issue `#92`. Added per-message response metadata in the chat transcript, including duration, aggregate token totals, hoverable model/cache details, changed-file chips sourced from the workspace diff hook, and a one-click copy-as-markdown action. Existing retryable error handling in `ErrorBanner` and context-usage hover/pulse behavior in `ContextIndicator` already covered the rest of the issue acceptance criteria and were preserved unchanged. Manual browser verification was attempted, but the sandbox blocked local Vite listeners with `listen EPERM`, so only automated coverage could be completed in this environment.
**Regression Test**: `apps/desktop/src/components/chat/__tests__/MessageList.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageTransport.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageErrorBanner.test.tsx`, `apps/desktop/src/components/chat/__tests__/ContextIndicator.test.tsx`
**Related Issue**: GitHub issue `#92`

### 2026-03-18: Issue 100 Bash display controls completed

**Type**: Bug Fix
**Impact**: Medium
**Description**: Completed the remaining `BashDisplay` scope for GitHub issue `#100`, matching the earlier partially-done handoff comment on the issue. Added a focusable terminal wrapper with `Cmd/Ctrl+F` search focus, `Cmd/Ctrl+K` clear behavior, output-line filtering that disables truncation while searching, and a full-height toggle for long command output. Manual browser verification against the live Vite component confirmed search focus, filtered output, truncation restoration after clear, and the height toggle class change. Browser console output still included unrelated pre-existing workflow-memory `404`s and a dev-font `403`, but no new Bash display errors were introduced.
**Regression Test**: `apps/desktop/src/components/chat/__tests__/BashDisplay.test.tsx`
**Related Issue**: GitHub issue `#100`

### 2026-03-18: Issue 87 thinking controls completed

**Type**: Bug Fix
**Impact**: Medium
**Description**: Completed GitHub issue `#87` by wiring the missing chat-level thinking controls. Added `Option+T` visibility toggling, `Cmd+Shift+.` expand-all behavior for thinking blocks, a persisted `thinkingBudgetTokens` setting in the Model tab, and backend Claude SDK wiring that converts the stored budget into `thinkingConfig.budgetTokens` for each chat request. Browser verification confirmed the budget control renders and persists in Settings, and chat-page keyboard verification confirmed `Option+T` flips the stored thinking visibility preference on a live session.
**Regression Test**: `apps/desktop/src/components/chat/__tests__/ChatPageShortcuts.test.tsx`, `apps/desktop/src/components/chat/__tests__/MessageList.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageTransport.test.tsx`, `apps/desktop/src/components/settings/SettingsPanel.test.tsx`, `apps/desktop/src/hooks/useSettings.test.ts`, `apps/server/src/services/claude.test.ts`
**Related Issue**: GitHub issue `#87`

### 2026-03-18: Issue 113 appearance controls completed

**Type**: Bug Fix
**Impact**: Medium
**Description**: Closed the remaining acceptance gaps for GitHub issue `#113` on `codex/issue-113-wave13`. Added persisted settings for `monoFontFamily` and `tabDensity`, exposed both controls in `Settings > Appearance`, applied the selected monospace stack through the `--chat-mono-font` CSS variable, and tightened the settings tab chrome for compact density. The browser verification pass confirmed the new controls render and the selected Courier stack and wide chat width are applied to the live UI.
**Regression Test**: `apps/desktop/src/hooks/useSettings.test.ts`, `apps/desktop/src/hooks/useTheme.test.ts`, `apps/desktop/src/components/settings/SettingsPanel.test.tsx`, `apps/desktop/src/components/__tests__/SettingsTabsOverflow.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatInput.test.tsx`, `apps/desktop/src/components/chat/__tests__/MessageList.test.tsx`
**Related Issue**: GitHub issue `#113`

### 2026-03-18: Issue 114 multi-repo workspace attachments

**Type**: Bug Fix
**Impact**: Medium
**Description**: Added persistent workspace `additionalDirectories`, routed `/add-dir <path>` from chat into the workspace Paths flow, forwarded multi-repo attachments into Claude query options, and updated the Paths UI to show repo-derived labels plus repo/path filtering. Verified the backend with successful and invalid `PATCH /api/workspaces/:id` curl checks plus a streamed `/api/chat` request, and verified the frontend in the browser by reloading the app and confirming the attached `shared` directory persisted in the Paths tab.

**Regression Test**: `apps/server/src/db/db-workspaces.test.ts`, `apps/server/src/routes/workspaces.test.ts`, `apps/server/src/routes/chat-workspace.test.ts`, `apps/server/src/services/claude.test.ts`, `apps/desktop/src/components/workspaces/__tests__/WorkspacePanel.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageSlashCommands.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageTransport.test.tsx`, `apps/desktop/src/hooks/useCommands.test.ts`
**Related Issue**: GitHub issue `#114`

### 2026-03-18: Issue 115 memory-update prompt flow completed

**Type**: Bug Fix
**Impact**: Medium
**Description**: Completed GitHub issue `#115` in the issue worktree by replacing the earlier toast-only memory nudges with a real repo-memory update flow. Added repo-scoped `reviewMemory` and `mergeMemory` workflow prompts stored through the existing `/api/memory` files, wired review-feedback and post-merge actions to queue a pending `MEMORY.md` draft, and updated the Memory tab to consume that draft directly into the editor so saving persists through the normal memory routes and future sessions keep using the same repository memory files. Follow-up manual verification found and fixed a first-run bug where the queued draft was dropped when the repo had no memory files yet.

**Regression Test**: `apps/desktop/src/lib/workflowPrompts.test.ts`, `apps/desktop/src/lib/__tests__/memoryUpdatePrompt.test.ts`, `apps/desktop/src/components/settings/SettingsPanel.test.tsx`, `apps/desktop/src/components/__tests__/MemoryPanel.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageTransport.test.tsx`, `apps/desktop/src/components/workspaces/__tests__/WorkspacePanel.test.tsx`, `apps/desktop/src/hooks/useSettings.test.ts`
**Related Issue**: GitHub issue `#115`

### 2026-03-18: Issue 112 browser automation workflow landed

**Type**: Feature + Bug Fix
**Impact**: High
**Description**: Completed GitHub issue `#112` on the issue worktree by adding a repo-root Playwright MCP default for headed Chrome automation, Settings > MCP preset installation cards, a dedicated browser tool renderer for screenshots, recordings, page text, and console output, and updated `/browser` workflow guidance. Manual verification exposed a monorepo integration bug where the MCP router read and wrote `.mcp.json` relative to `apps/server` instead of the repo root, so the browser server config was invisible to the UI/API when the backend launched from its package directory. The route now resolves the repo-root config and prefers it over stale nested copies.

**Regression Test**: `apps/desktop/src/components/__tests__/McpPanel.test.tsx`, `apps/desktop/src/components/chat/__tests__/BrowserAutomationDisplay.test.tsx`, `apps/desktop/src/lib/workflowPrompts.test.ts`, `apps/server/src/routes/mcp.test.ts`
**Related Issue**: GitHub issue `#112`

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

### 2026-03-17: Issue 128 live scroll affordance follow-up

**Type**: Bug Fix
**Impact**: Medium
**Description**: Resolved the remaining live-browser gap for GitHub issue `#128`. The previous implementation in `MessageList` depended on querying the `ScrollArea` viewport after render and manually wiring scroll listeners, which proved brittle in the real app even though unit tests passed. The fix adds explicit `viewportRef` and `viewportProps` support to the shared `ScrollArea` wrapper and binds the chat affordance directly to the real viewport element. Live browser verification now matches the tests: scrolling up in a long chat shows the `Latest` button, and clicking it returns the user to the newest messages before hiding the affordance again.
**Regression Test**: `apps/desktop/src/components/ui/scroll-area.test.tsx`, `apps/desktop/src/components/chat/__tests__/MessageList.test.tsx`
**Related Issue**: GitHub issue `#128`

### 2026-03-17: Issue 116 resource usage toggle wiring

**Type**: Bug Fix
**Impact**: Medium
**Description**: Completed the missing desktop wiring for GitHub issue `#116` by adding `showResourceUsage` to persisted settings, exposing a Status-tab toggle in Settings, and keeping the existing status-bar diagnostics segment dormant until the toggle is enabled. Also repaired the stale Settings tab-count regression so the desktop suite matches the current 12-tab panel layout.
**Regression Test**: `apps/desktop/src/hooks/useSettings.test.ts`, `apps/desktop/src/components/settings/SettingsPanel.test.tsx`, `apps/desktop/src/components/__tests__/StatusBar.test.tsx`, `apps/desktop/src/components/__tests__/SettingsTabsOverflow.test.tsx`
**Related Issue**: GitHub issue `#116`

---

### 2026-03-17: Generative UI registry foundation landed

**Type**: Refactor
**Impact**: Medium
**Description**: Replaced `ToolCallBlock`'s hardcoded routing with a registry-backed generative UI foundation under `apps/desktop/src/components/chat/gen-ui/`. Added shared tool input parsing with `empty/partial/parsed/invalid` states, centralized sanitization for rendered tool data, migrated the existing specialized tool displays to the shared contract, and documented the follow-on persistence model as separate tool artifacts rather than message-content overloading. Also repaired two stale desktop tests (`ChatInput` query brittleness and `ChatPageErrorBanner` missing hook mocks) so the full workspace suite passes again.
**Regression Test**: `apps/desktop/src/components/chat/gen-ui/registry.test.tsx`, `apps/desktop/src/components/chat/gen-ui/toolData.test.ts`, `apps/desktop/src/components/chat/ToolCallBlock.test.tsx`, `apps/desktop/src/components/chat/__tests__/FileOperations.test.tsx`, `apps/desktop/src/components/chat/__tests__/SearchDisplay.test.tsx`, `apps/desktop/src/components/chat/__tests__/WebSearchDisplay.test.tsx`, `apps/desktop/src/components/chat/__tests__/WebFetchDisplay.test.tsx`, `apps/desktop/src/components/chat/__tests__/NotebookEditDisplay.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatInput.test.tsx`, `apps/desktop/src/components/chat/__tests__/ChatPageErrorBanner.test.tsx`
**Related Issue**: GitHub issues `#150`, `#151`

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

## 2026-03-18
### Chat route malformed JSON handling regression fix
- **What:** Added a regression test for `POST /api/chat` malformed JSON input and updated the chat route to catch `c.req.json()` parse errors, returning HTTP 400 with `{ "error": "Malformed JSON request body" }` instead of surfacing a 500.
- **Why:** Manual API investigation documented that invalid JSON was returning 500, which treats client input errors as server faults and makes error handling noisy.
- **Result:** Targeted server tests pass, and manual curl verification now returns 400 for malformed JSON bodies.

### Context summary feature
- **What:** Added `GET /api/sessions/:id/summary` endpoint, `generateContextSummary` service, `useContextSummary` hook, and rendered the summary as subtle italic text below the chat input.
- **Why:** Gives users a quick reminder of what a session is about without needing to scroll through messages. Uses Claude Haiku for low cost and fast response.
- **Result:** Server endpoint generates a one-phrase summary via Haiku (debounced 2s, skipped during streaming). Summary appears below the input bar at 40% opacity. 7 new tests added, all passing.

## 2026-03-19
### Persistent Dashboard Artifacts V1 complete (Phases 1-4)
- **What:** Implemented full artifact pipeline: SQLite schema (artifacts, artifact_revisions, message_parts), backend CRUD/generate/regenerate/archive routes, frontend Dashboards tab in WorkspacePanel, `/dashboard` slash command, ArtifactBlock inline renderer.
- **Why:** Enables workspace chat to generate persistent, revisioned dashboards that survive page reload.
- **Result:** All phases complete, 57+ new tests passing. Dashboard generation confirmed working end-to-end via curl verification. All seven new artifact endpoints return correct responses and status codes.

## 2026-04-04
### Settings dialog Escape-key close regression
- **What:** Added a regression test asserting that pressing `Escape` closes `SettingsPanel`, then fixed `SettingsPanel` by wiring a window `keydown` listener (active only while open) that calls `onClose()` when `Escape` is pressed.
- **Why:** Manual UI test documentation flagged that Escape dismissal was inconsistent for dialogs; settings lacked any Escape handler, so keyboard-based dismissal did nothing.
- **Result:** The new regression test fails on old behavior and passes after the fix; the settings panel now closes via Escape key as expected.
