# Plans

Feature plans with checklists. Each plan is a markdown file with a checklist that gets checked off as work progresses.

## Files

| File | Description |
|------|-------------|
| [issue-5-sdk-event-handling.md](issue-5-sdk-event-handling.md) | Complete implementation plan for GitHub issue #5: handling all 17+ SDKMessage event types. Covers shared types, event mapper, backend streaming, frontend reducer, and UI components across 6 implementation waves. |
| [issue-29-plan-mode-ui.md](issue-29-plan-mode-ui.md) | Plan Mode UI with approve/reject flow. Adds plan streaming types, PlanView component, plan decision endpoint, and event mapping for the Claude Agent SDK plan permission mode. |
| [issue-32-git-integration.md](issue-32-git-integration.md) | Git integration: status bar with branch display, clean/dirty indicator, file count badge. Backend endpoints for git status and diff. |
| [multi-workspace-worktrees.md](multi-workspace-worktrees.md) | Multi-workspace support via git worktrees. Users add projects (git repos), create isolated workspaces (worktrees with branches), each with its own Claude agent session. Includes project/workspace CRUD, diff review, merge/discard lifecycle, sidebar tree UI, and 6 implementation phases. |
| [issue-78-linear-integration.md](issue-78-linear-integration.md) | Linear issue integration for GitHub issue #78: link Linear issues to sessions/workspaces, inject issue context into chat prompts, and provide remaining connect/search roadmap. |
