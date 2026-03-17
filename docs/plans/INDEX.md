# Plans

Feature plans with checklists. Each plan is a markdown file with a checklist that gets checked off as work progresses.

## Files

| File | Description |
|------|-------------|
| [issue-5-sdk-event-handling.md](issue-5-sdk-event-handling.md) | Complete implementation plan for GitHub issue #5: handling all 17+ SDKMessage event types. Covers shared types, event mapper, backend streaming, frontend reducer, and UI components across 6 implementation waves. |
| [issue-29-plan-mode-ui.md](issue-29-plan-mode-ui.md) | Plan Mode UI with approve/reject flow. Adds plan streaming types, PlanView component, plan decision endpoint, and event mapping for the Claude Agent SDK plan permission mode. |
| [issue-32-git-integration.md](issue-32-git-integration.md) | Git integration: status bar with branch display, clean/dirty indicator, file count badge. Backend endpoints for git status and diff. |
| [issue-76-provider-support.md](issue-76-provider-support.md) | Issue #76 provider support for Anthropic/Bedrock/Vertex/custom configuration with persistence and env propagation tests. |
| [issue-77-command-palette.md](issue-77-command-palette.md) | Command palette (Cmd+K) plan for session/PR/settings navigation and fuzzy relevance-based action search. |
| [issue-79-file-attachments.md](issue-79-file-attachments.md) | File picker and attachments: inline file picker, drag-and-drop, @ mentions, and previews. |
| [multi-workspace-worktrees.md](multi-workspace-worktrees.md) | Multi-workspace support via git worktrees. Users add projects (git repos), create isolated workspaces (worktrees with branches), each with its own Claude agent session. Includes project/workspace CRUD, diff review, merge/discard lifecycle, sidebar tree UI, and 6 implementation phases. |
| [issue-75-ci-forwarding.md](issue-75-ci-forwarding.md) | Issue #75: forward failing CI checks to Claude for auto-fix, including stream detection and `Fix Errors` action wiring. |
| [issue-78-linear-integration.md](issue-78-linear-integration.md) | Linear issue integration for GitHub issue #78: link Linear issues to sessions/workspaces, inject issue context into chat prompts, and provide remaining connect/search roadmap. |
| [issue-80-diff-viewer.md](issue-80-diff-viewer.md) | Diff viewer enhancements for unified/side-by-side mode, range-aware diff review, inline comments, and file review actions. |
| [issues-75-80-handoff-status.md](issues-75-80-handoff-status.md) | Local handoff marker for feature wave issues #75-#80, including integrated branch status, landing blocker, and the next recommended ticket queue. |
| [issues-118-140-cleanup-wave.md](issues-118-140-cleanup-wave.md) | Follow-up cleanup wave for issues #118, #120, #126, #127, and #140, focused on regression coverage and issue handoff notes for fixes already present in `codex/wave1-merge`. |
