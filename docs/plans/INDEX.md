# Plans

Feature plans with checklists. Each plan is a markdown file with a checklist that gets checked off as work progresses.

## Files

| File | Description |
|------|-------------|
| [issue-112-browser-automation.md](issue-112-browser-automation.md) | Implementation plan and completed checklist for GitHub issue #112 covering Chrome automation, screenshots, recordings, MCP presets, and workflow integration. |
| [issue-5-sdk-event-handling.md](issue-5-sdk-event-handling.md) | Complete implementation plan for GitHub issue #5: handling all 17+ SDKMessage event types. Covers shared types, event mapper, backend streaming, frontend reducer, and UI components across 6 implementation waves. |
| [issue-29-plan-mode-ui.md](issue-29-plan-mode-ui.md) | Plan Mode UI with approve/reject flow. Adds plan streaming types, PlanView component, plan decision endpoint, and event mapping for the Claude Agent SDK plan permission mode. |
| [issue-32-git-integration.md](issue-32-git-integration.md) | Git integration: status bar with branch display, clean/dirty indicator, file count badge. Backend endpoints for git status and diff. |
| [issues-78-83-84-91-110-117-wave7.md](issues-78-83-84-91-110-117-wave7.md) | Wave 7 coordination plan for open issues #78, #83, #84, #91, #110, and #117. Covers isolated worktrees, strict TDD, manual browser notes, and merge-branch validation. |
| [issues-78-83-84-91-110-117-wave8-completion.md](issues-78-83-84-91-110-117-wave8-completion.md) | Completed wave-8 integration plan covering issues #78, #83, #84, #91, #110, and #117, including validation results and GitHub closeout criteria. |
| [issues-112-116-wave9.md](issues-112-116-wave9.md) | Wave 9 coordination plan for issues #112-#116, covering isolated worktrees, tmux-backed Codex subagents, TDD expectations, and integration-branch closeout. |
| [issues-82-95-90-111-106-116-wave11.md](issues-82-95-90-111-106-116-wave11.md) | Wave 11 plan for CPU/memory diagnostics work covering settings toggle, status UI, and manual browser verification notes for issue #116. |
| [issue-116-wave13-handoff.md](issue-116-wave13-handoff.md) | Handoff note for issue #116 wave13 covering the persisted diagnostics toggle, status-bar resource display, targeted test coverage, and the remaining manual browser verification step. |
| [issue-72-wave152-handoff.md](issue-72-wave152-handoff.md) | Handoff note for GitHub issue #72, including regression coverage and short manual browser verification steps for the export filename header behavior. |
| [issue-74-wave152-handoff.md](issue-74-wave152-handoff.md) | Handoff note for issue #74 wave152: no app logic changes in this branch, manual browser verification steps, and regression test coverage status. |
| [issues-75-80-wave-1.md](issues-75-80-wave-1.md) | Coordination plan for the first six-issue parallel worktree batch. Covers issues #75-#80, TDD expectations, subagent artifacts, and review/merge follow-up steps. |
| [issue-76-provider-support.md](issue-76-provider-support.md) | Issue #76 provider support for Anthropic/Bedrock/Vertex/custom configuration with persistence and env propagation tests. |
| [issue-77-command-palette.md](issue-77-command-palette.md) | Command palette (Cmd+K) plan for session/PR/settings navigation and fuzzy relevance-based action search. |
| [issue-118-wave152-handoff.md](issue-118-wave152-handoff.md) | Handoff and validation notes for GitHub issue #118 covering settings tabs overflow regression checks and manual browser verification steps. |
| [issue-114-multi-repo-editing.md](issue-114-multi-repo-editing.md) | Issue #114 plan for multi-repo editing with `/add-dir`, covering workspace directory persistence, Claude passthrough, and workspace UI management. |
| [issue-119-wave152-handoff.md](issue-119-wave152-handoff.md) | Handoff checklist for issue #119 covering model selector regression checks and manual browser verification notes. |
| [issue-115-ai-memory-update.md](issue-115-ai-memory-update.md) | Issue #115 MVP plan for prompting memory updates after review feedback and workspace merge, with repo-scoped memory persistence and existing Memory tab reuse. |
| [issue-117-wave7-handoff.md](issue-117-wave7-handoff.md) | Wave 7 handoff note for issue #117 covering fast model switching, persistence regressions, fork model carryover, and manual browser verification steps. |
| [issue-110-wave7-handoff.md](issue-110-wave7-handoff.md) | Wave 7 handoff note for issue #110 covering startup instruction injection, `systemPrompt` ordering, and manual browser/API verification steps. |
| [issue-73.md](issue-73.md) | Frontend regression for issue #73: session selection updates `activeSessionHasMessages` from message presence and preserves New Chat no-op behavior. |
| [issue-79-file-attachments.md](issue-79-file-attachments.md) | File picker and attachments: inline file picker, drag-and-drop, @ mentions, and previews. |
| [issue-75-ci-forwarding.md](issue-75-ci-forwarding.md) | Issue #75: forward failing CI checks to Claude for auto-fix, including stream detection and `Fix Errors` action wiring. |
| [issue-91-wave7-handoff.md](issue-91-wave7-handoff.md) | Wave 7 handoff for issue #91 covering slash autocomplete/fuzzy regression coverage, invalid command handling, and manual browser verification notes. |
| [issues-73-75-76-77-79-80-wave-5.md](issues-73-75-76-77-79-80-wave-5.md) | Wave-5 execution and verification for #73 plus partially-done issues #75-#80. |
| [issue-78-wave7-handoff.md](issue-78-wave7-handoff.md) | Regression handoff for Issue #78 Wave 7: linear issue payload validation coverage and manual browser verification scope (auth/search TODO). |
| [multi-workspace-worktrees.md](multi-workspace-worktrees.md) | Multi-workspace support via git worktrees. Users add projects (git repos), create isolated workspaces (worktrees with branches), each with its own Claude agent session. Includes project/workspace CRUD, diff review, merge/discard lifecycle, sidebar tree UI, and 6 implementation phases. |
| [issue-78-linear-integration.md](issue-78-linear-integration.md) | Linear issue integration for GitHub issue #78: link Linear issues to sessions/workspaces, inject issue context into chat prompts, and provide remaining connect/search roadmap. |
| [issue-80-diff-viewer.md](issue-80-diff-viewer.md) | Diff viewer enhancements for unified/side-by-side mode, range-aware diff review, inline comments, and file review actions. |
| [issue-84-wave7-handoff.md](issue-84-wave7-handoff.md) | Wave 7 handoff note for issue #84 covering plan-mode toggle wiring, plan decision flow coverage, and manual browser verification guidance. |
| [issues-75-80-handoff-status.md](issues-75-80-handoff-status.md) | Local handoff marker for feature wave issues #75-#80, including integrated branch status, landing blocker, and the next recommended ticket queue. |
| [issues-118-140-cleanup-wave.md](issues-118-140-cleanup-wave.md) | Follow-up cleanup wave for issues #118, #120, #126, #127, and #140, focused on regression coverage and issue handoff notes for fixes already present in `codex/wave1-merge`. |
| [issue-140-wave152-handoff.md](issue-140-wave152-handoff.md) | Wave 152 handoff note for issue #140: verification steps for the command-palette tools overflow affordance and existing test coverage. |
| [issues-73-75-76-77-79-80-wave-5.md](issues-73-75-76-77-79-80-wave-5.md) | Wave 5 execution plan for bug #73 plus partially-done issues #75, #76, #77, #79, and #80. Includes finish criteria, test plan, and integration flow. |
| [issue-141-wave-3-handoff.md](issue-141-wave-3-handoff.md) | Handoff note for issue #141 covering the stale `claudeSessionId` retry fix, targeted server regression coverage, and follow-up validation notes. |
| [issue-142-wave-3-handoff.md](issue-142-wave-3-handoff.md) | Handoff note for issue #142 documenting the export filename sanitization regression coverage and quick manual API verification guidance. |
| [issue-143-wave-3-handoff.md](issue-143-wave-3-handoff.md) | Handoff note for issue #143 recording the Add Project dialog touched-state regression coverage and browser verification note. |
| [issue-144-wave-3-handoff.md](issue-144-wave-3-handoff.md) | Handoff note for issue #144 covering the empty-session chat clearing fix, targeted frontend test, and manual UI check. |
| [issue-145-wave-3-handoff.md](issue-145-wave-3-handoff.md) | Handoff note for issue #145 documenting session sidebar right-click menu regression coverage and quick browser test steps. |
| [issue-146-wave-3-handoff.md](issue-146-wave-3-handoff.md) | Handoff note for issue #146 covering toaster host regression coverage and `/compact` manual verification guidance. |
| [issue-147-wave-3-handoff.md](issue-147-wave-3-handoff.md) | Handoff note for issue #147 recording Bun idle-timeout regression coverage and SSE smoke-test guidance. |
| [issue-148-wave-3-handoff.md](issue-148-wave-3-handoff.md) | Handoff note for issue #148 documenting Tauri minimum window size regression coverage and narrow-layout verification guidance. |
| [issue-149-wave-3-handoff.md](issue-149-wave-3-handoff.md) | Handoff note for issue #149 covering forked-session prompt replay regression coverage and end-to-end validation notes. |
| [issue-150-wave-3-handoff.md](issue-150-wave-3-handoff.md) | Handoff note for issue #150 documenting the shared `parseToolInput` utility implementation, tests, and follow-up guidance. |
| [issue-151-wave-3-handoff.md](issue-151-wave-3-handoff.md) | Handoff note for issue #151 covering tool-output sanitization, renderer integration, and manual verification notes. |
| [issues-141-151-wave-3.md](issues-141-151-wave-3.md) | Coordination plan for the new issue wave covering issues #141-#151, including regression-only tickets already fixed on the current integration line, the six-at-a-time worktree batches, and the final integration/cleanup flow. |
| [issue-120-126-127-wave152-handoff.md](issue-120-126-127-wave152-handoff.md) | Handoff note for issue cluster #120, #126, #127 covering slash-command regressions, shortcut behavior, reviewed tests, and manual verification steps. |
| [issues-121-139-wave-4.md](issues-121-139-wave-4.md) | Coordination plan for Wave 4 covering issues #121, #123, #124, #125, #128, #131, #132, #137, #138, and #139 plus the status-only handoff for #122, with isolated worktrees, strict TDD, GitHub updates, and merge-branch validation. |
| [issues-121-139-wave-4-handoff.md](issues-121-139-wave-4-handoff.md) | Wave 4 handoff status for issues #121, #122, #123, #124, #125, #128, #131, #132, #137, #138, and #139, including branch commits, targeted test results, manual verification notes, and the later follow-up that resolved the original #128 browser blocker. |
| [issue-128-scroll-affordance-followup.md](issue-128-scroll-affordance-followup.md) | Follow-up plan and completion notes for GitHub issue #128, replacing the brittle chat viewport DOM query with direct `ScrollArea` viewport bindings and documenting the final browser verification steps. |
| [multi-workspace-worktrees.md](multi-workspace-worktrees.md) | Multi-workspace support via git worktrees. Users add projects (git repos), create isolated workspaces (worktrees with branches), each with its own Claude agent session. Includes project/workspace CRUD, diff review, merge/discard lifecycle, sidebar tree UI, and 6 implementation phases. |
| [generative-ui-feature.md](generative-ui-feature.md) | Feature plan for modular generative UI: extending ToolCallBlock to use a registry-based tool-name → React component mapping, building rich display components (DiffSummaryDisplay, FileTreeDisplay, SearchResultsDisplay, DataTableDisplay, ProgressTracker), integrating useObject for structured generation, and a phased checklist (Phase 1: registry, Phase 2: core components, Phase 3: integration, Phase 4: useObject endpoint). |
| [issues-82-95-90-111-106-116-wave11.md](issues-82-95-90-111-106-116-wave11.md) | Wave 11 execution plan for issues #116, #95, #106, #111, #82, and #90. |
