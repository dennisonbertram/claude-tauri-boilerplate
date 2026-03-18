# Issue #111: Tracker-First Workspace Creation

## Feature Description

Turn workspace creation into a tracker-first flow. Users can start from a GitHub issue, PR, or branch and carry that context into the workspace and session.

## Acceptance Criteria

- [x] "Create Workspace" dialog has mode selection: Manual | Branch | GitHub Issue
- [x] GitHub Issue mode: search GitHub issues in-app, select one, auto-fill workspace name + branch + initial prompt
- [x] Branch mode: browse existing branches for a project, select one to create workspace from
- [x] Linked issue context (number, title, URL, repo) stored in workspace (`github_issue_*` fields)
- [x] Session creation auto-includes linked issue context in the initial prompt via `<github-issue>` block
- [x] Existing manual flow is preserved (backward compatible)

## Implementation Checklist

- [x] **DB schema** — Added `github_issue_number`, `github_issue_title`, `github_issue_url`, `github_issue_repo` columns to `workspaces` table
- [x] **DB migration** — `migrateGithubIssueColumns()` added to `schema.ts` and called in `createDb()`
- [x] **DB helpers** — `WorkspaceRow`, `mapWorkspace`, `createWorkspace` updated to include new fields
- [x] **Shared types** — `Workspace` interface updated with `githubIssue*` fields; `CreateWorkspaceRequest.githubIssue` now uses `number` (not `id`)
- [x] **Backend route** — `createWorkspaceSchema` updated; `githubIssue` passed separately to orchestrator
- [x] **Worktree orchestrator** — `createWorkspace` accepts optional `githubIssue` parameter
- [x] **GitHub issues endpoint** — `GET /api/projects/:projectId/github-issues?q=...` using `gh` CLI
- [x] **Branches endpoint** — `GET /api/projects/:projectId/branches` using `git branch`
- [x] **Tests (TDD)** — `github-issues.test.ts` with 16 tests covering parsing + HTTP routes
- [x] **App.ts** — New router registered
- [x] **Chat route** — GitHub issue context injected as `<github-issue>` block in system prompt
- [x] **workspace-api.ts** — `fetchGithubIssues`, `fetchProjectBranches` helpers + updated `createWorkspace` signature
- [x] **useWorkspaces hook** — `addWorkspace` accepts `githubIssue` parameter
- [x] **CreateWorkspaceDialog** — Mode tabs: Manual | Branch | GitHub Issue
- [x] **App.tsx** — Passes `projectId` to dialog; handles `githubIssue` in `handleCreateWorkspace`
- [x] **WorkspacePanel** — GitHub issue badge in header when `githubIssueNumber` is set

## Status: COMPLETE
