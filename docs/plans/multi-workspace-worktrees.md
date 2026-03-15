# Multi-Workspace Support via Git Worktrees

## Description

Add multi-workspace support to claude-tauri-boilerplate. Users can register local git repositories as **projects**, then create isolated **workspaces** for each project. Each workspace is backed by a git worktree and has its own Claude session using the SDK `cwd` option. This enables parallel coding tasks on one repository with reduced cross-context conflict.

This revised plan keeps the MVP narrow: project/worktree lifecycle, workspace-scoped chat, diff review, and safe merge/discard operations.

## Acceptance Criteria

- [ ] Users can add a local git repository as a project via folder picker or typed path.
- [ ] Repo path is canonicalized and validated as a git repository before persistence.
- [ ] Existing projects can be edited (name, default branch, setup command) and removed.
- [ ] Projects expose health status (`ok`, `missing_repo`, `invalid_repo`) in list/detail payloads.
- [ ] Users can create workspaces within a project.
- [ ] Workspace creation is atomic from the user perspective (`worktree + branch + DB row + setup run`) with rollback on failures.
- [ ] Workspaces use deterministic naming/validation:
  - unique workspace name within project.
  - unique branch within project (`workspace/<slug>`).
- [ ] Each workspace gets a dedicated Claude session context by passing `cwd` to the SDK and persists `workspace_id` on sessions.
- [ ] Users can switch workspace context in UI and load that workspace's chat history.
- [ ] Users can view diffs and changed files for a workspace.
- [ ] Users can merge workspace branch changes and discard workspace branches safely.
- [ ] Setup command can be canceled on long/hung runs and timed out.
- [ ] Merge conflicts and invalid state transitions return clear, recoverable errors.
- [ ] DB schema migration creates `projects`, `workspaces`, and nullable `sessions.workspace_id` with indexes and FK constraints.
- [ ] Endpoint responses and errors are deterministic and documented with status codes.
- [ ] Backend tests cover happy path + critical failure modes (name collisions, invalid repo, deleted repo, setup timeout, merge conflict, delete mid-setup).

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Tauri v2 Desktop Shell                                               │
│  ┌─────────────────────────┐  ┌───────────────────────────────────┐   │
│  │ React Frontend          │  │ Hono/Bun Sidecar                  │   │
│  │                         │  │                                   │   │
│  │ Project/Workspace UI     │  │ API Routes                        │   │
│  │ (tree + chat context)    │  │  ├─ ProjectService                │   │
│  │                         │  │  ├─ WorktreeOrchestrator          │   │
│  │                         │  │  ├─ WorktreeService               │   │
│  │                         │  │  └─ ClaudeSessionService           │   │
│  └─────────────────────────┘  └───────────────────────────────────┘   │
│                                           │                           │
│                                    query(cwd=worktree)                 │
│                                           │                           │
│                                     ┌─────▼─────┐                     │
│                                     │ Claude SDK │                     │
│                                     └─────┬─────┘                     │
│                                           │                             │
│                                SQLite (projects, workspaces, sessions)   │
└──────────────────────────────────────────────────────────────────────┘
```

### Key design decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Git operations | Wrap `git` CLI in a narrow command runner service (`Bun.spawn`/`child_process`) | Better control over timeout, cancellation, stderr capture, and strict args. |
| Worktree path | `~/.claude-tauri/worktrees/<project-id>/<workspace-id>/` | Deterministic, no collisions, supports recovery scanning. |
| Process model | One Claude query per workspace message/request; do not keep long-lived per-workspace daemon | Keeps behavior close to existing chat model and avoids process leak risk. |
| Setup execution | Async job with `workspace_setup` state, timeout, and explicit cancel endpoint | Prevents UI hangs and supports hang recovery for `pnpm install`-style commands. |
| Branch naming | `workspace/<slug>` with strict validation and collision check | Predictable branch namespace and conflict prevention. |
| SDK API | Prefer current stable query path with `{ cwd }` option (`query`) | Reduces dependency churn. |
| Backwards compatibility | `workspace_id` in `sessions` nullable with `ON DELETE SET NULL` | Existing global sessions remain valid. |

### Architecture fixes from review

- Add a dedicated `WorktreeOrchestrator` (not just direct route/service calls) to enforce state transitions and rollback behavior.
- Separate `GitCommandRunner` from `WorktreeService` so command injection controls and mocking tests are centralized.
- Treat filesystem state as eventually consistent: keep DB as source-of-truth state transitions (`creating`, `ready`, etc.) and reconcile on read by verifying worktree exists.

## Database Schema Changes

### New table: `projects`

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  repo_path TEXT NOT NULL UNIQUE,
  repo_path_canonical TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL DEFAULT 'main',
  setup_command TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- `repo_path` stores user-supplied display path.
- `repo_path_canonical` stores `realpath()` result used for safety checks.

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_canonical_path ON projects(repo_path_canonical);
```

### New table: `workspaces`

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  worktree_path TEXT NOT NULL UNIQUE,
  worktree_path_canonical TEXT NOT NULL UNIQUE,
  base_branch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating'
    CHECK(status IN ('creating', 'setup_running', 'ready', 'active', 'merging', 'discarding', 'merged', 'archived', 'error')),
  claude_session_id TEXT,
  setup_pid INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name),
  UNIQUE(project_id, branch)
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_workspaces_project_id ON workspaces(project_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON workspaces(updated_at);
```

### Modified table: `sessions`

```sql
ALTER TABLE sessions ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);
```

### Migration notes

- Ensure migration runs in ordered blocks with a temporary fallback for `ALTER TABLE` in existing SQLite variants.
- Backfill `workspace_id` for legacy rows as `NULL`.
- Add a recovery migration step that marks orphaned `creating/setup_running` workspaces as `error` with a diagnostic message if repository is missing or command state is stale.

## API Endpoints

### Project endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/projects` | GET | List all projects (include workspace count + health) |
| `/api/projects` | POST | Add a project |
| `/api/projects/:id` | GET | Get project details |
| `/api/projects/:id` | PATCH | Update project settings (name, setup_command, default_branch) |
| `/api/projects/:id` | DELETE | Remove project and cascade-delete its workspaces |

### Workspace endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/projects/:projectId/workspaces` | GET | List workspaces for a project |
| `/api/projects/:projectId/workspaces` | POST | Create a new workspace |
| `/api/workspaces/:id` | GET | Get workspace details |
| `/api/workspaces/:id` | PATCH | Update workspace name/status metadata |
| `/api/workspaces/:id` | DELETE | Delete workspace (best-effort remove worktree, optional branch delete) |
| `/api/workspaces/:id/diff` | GET | Get diff for the workspace (paginated/limit) |
| `/api/workspaces/:id/changed-files` | GET | List changed files |
| `/api/workspaces/:id/merge` | POST | Merge branch into base branch |
| `/api/workspaces/:id/discard` | POST | Discard workspace changes and remove worktree |
| `/api/workspaces/:id/setup/cancel` | POST | Cancel running setup command |
| `/api/workspaces/:id/reconcile` | POST | Re-scan and repair workspace state |

### Chat endpoint changes

Existing `POST /api/chat` accepts optional:

```json
{
  "messages": [...],
  "sessionId": "...",
  "workspaceId": "ws-123"
}
```

When `workspaceId` is provided:
1. Validate workspace exists and is not terminally failed.
2. Resolve canonical worktree path.
3. Pass `cwd` to SDK `query()` using worktree path.
4. Link message/session to `workspace_id`.
5. Set workspace status transitions (`active` / `ready`) as needed.

### Error handling standardization

- 400: validation errors (bad path, invalid name, bad branch name, invalid transition).
- 404: missing project/workspace/session.
- 409: conflict (branch exists, duplicate workspace name, concurrent mutation). |
- 423: locked (`setup_running`, `merging`, `discarding` disallow destructive actions).
- 500: git command failures with sanitized `errorMessage` and `hint`.

All errors should include a stable `code` and `details` object to support UI actions.

## Frontend Components

### New components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ProjectSidebar` | `components/workspaces/ProjectSidebar.tsx` | Tree view: projects -> workspaces |
| `AddProjectDialog` | `components/workspaces/AddProjectDialog.tsx` | Add project path + validation feedback |
| `CreateWorkspaceDialog` | `components/workspaces/CreateWorkspaceDialog.tsx` | Create workspace (name + base branch picker) |
| `WorkspacePanel` | `components/workspaces/WorkspacePanel.tsx` | Main workspace context panel |
| `WorkspaceDiffView` | `components/workspaces/WorkspaceDiffView.tsx` | Render diff + changed file list |
| `WorkspaceStatusBadge` | `components/workspaces/WorkspaceStatusBadge.tsx` | Status state indicator |
| `WorkspaceMergeDialog` | `components/workspaces/WorkspaceMergeDialog.tsx` | Merge/discard confirmation |
| `SetupProgressBanner` | `components/workspaces/SetupProgressBanner.tsx` | Show setup state + cancel action |

### Modified components

| Component | Change |
|-----------|--------|
| `App.tsx` | Add workspaces route/tab and selection context |
| `ChatPage.tsx` | Accept and pass optional `workspaceId` |
| `StatusBar.tsx` | Show active workspace + branch/status |

### Sidebar hierarchy

```text
┌─────────────────────────┐
│ [Chat] [Workspaces] [Teams] │
├─────────────────────────┤
│ PROJECTS                    │
│ > my-app          [+]      │
│   ● auth-feature  (active)  │
│   ○ fix-nav       (ready)   │
│ > api-server       [+]      │
│   ● rate-limit   (setup_running)
│                             │
│ [Health] repo missing      │
│ [+ Add Project]             │
└─────────────────────────┘
```

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useProjects` | `hooks/useProjects.ts` | CRUD + project health refresh |
| `useWorkspaces` | `hooks/useWorkspaces.ts` | CRUD + status-aware actions |
| `useWorkspaceDiff` | `hooks/useWorkspaceDiff.ts` | Diff + changed file loading |

## Backend Services

### `GitCommandRunner` (`apps/server/src/services/git-command.ts`)

- Centralized wrapper over `git` invocations.
- Enforce argument-array execution (no shell interpolation).
- Set timeouts, capture stdout/stderr, propagate exit codes, support cancellation.
- Optional structured logger for command duration and outputs.

### `WorktreeOrchestrator` (`apps/server/src/services/worktree-orchestrator.ts`)

- Coordinates multi-step creation/deletion workflows.
- Enforces workspace status machine and DB transaction boundaries.
- Performs best-effort rollback:
  - If worktree create succeeds but DB insert fails: remove worktree and cleanup branch.
  - If setup fails: preserve workspace row with `error` status + logs.
- Supports idempotent re-entry (`POST` can be safely retried by client).

### `WorktreeService` (`apps/server/src/services/worktree.ts`)

- Idempotent wrappers for:
  - `createWorktree`
  - `removeWorktree`
  - `listWorktrees`
  - `getWorktreeDiff`
  - `getChangedFiles`
  - `mergeWorktreeBranch`
  - `isGitRepo`
  - `getDefaultBranch`
  - `getWorktreeInfoByPath`

Use `--porcelain=v2` where possible and avoid parsing brittle free-form output.

### `ProjectService` (`apps/server/src/services/project.ts`)

- Repo/path validation, canonicalization, and metadata refresh.
- Repo health check endpoint support (exists + git repo).

### Route handlers

- `apps/server/src/routes/projects.ts`
- `apps/server/src/routes/workspaces.ts`
- Register routes in `apps/server/src/app.ts`

## Implementation Phases

### Phase 1: Foundational safety and contracts (blocking)

- [ ] Add shared path utility (`canonicalizePath`, `isPathSafe`, `toRelativeWorkspacePath`).
- [ ] Add `GitCommandRunner` with strict arg arrays, timeout, and cancellation support.
- [ ] Add shared workspace state enum/types + transition guards in `packages/shared/src/types.ts`.
- [ ] Add migration utilities for schema changes and rollback-safe deployment.
- [ ] Add contract tests for `GitCommandRunner` error surface.

### Phase 2: Database and Project Management

- [ ] Add `projects` and `workspaces` tables and indexes in `schema.ts`.
- [ ] Add nullable `workspace_id` to `sessions`.
- [ ] Implement DB helpers: `createProject`, `listProjects`, `getProject`, `updateProject`, `deleteProject`, `setProjectDeleted`.
- [ ] Implement DB helpers: `createWorkspace`, `listWorkspaces`, `getWorkspace`, `updateWorkspaceStatus`, `setWorkspaceError`, `deleteWorkspace`.
- [ ] Add migration tests for FKs, uniqueness, and schema compatibility.

### Phase 3: Project APIs and discovery

- [ ] Implement `projects.ts` route handlers and validation:
  - path existence,
  - git repo check,
  - duplicate/canonical conflict.
- [ ] Implement `GET /api/projects` with health summary and workspace counts.
- [ ] Include canonical-path normalization and user-visible path in payload.
- [ ] Add duplicate request prevention via idempotency-friendly checks where practical.

### Phase 4: Worktree lifecycle + failure recovery

- [ ] Implement `WorktreeOrchestrator` and `WorktreeService`.
- [ ] Implement `POST /api/projects/:projectId/workspaces` with explicit transition:
  - create DB row (`creating`) -> create worktree+branch -> run setup (`setup_running`) -> `ready`/`error`.
- [ ] Add compensating cleanup + structured error record on failure.
- [ ] Implement safe `DELETE /api/workspaces/:id` with status guards.
- [ ] Implement `POST /api/workspaces/:id/reconcile` to repair stale states.
- [ ] Add setup cancel endpoint.

### Phase 5: Claude integration per workspace

- [ ] Update `streamClaude()` to accept optional `cwd` and optional `resume`.
- [ ] Update `POST /api/chat` to accept `workspaceId` and validate session transition.
- [ ] Link created sessions to workspace and persist `claude_session_id`.
- [ ] Add status update on chat start/end (`active`/`ready`) with safety guard on missing/damaged workspace.

### Phase 6: Diff / Merge / Discard flows

- [ ] Implement workspace diff and changed-files endpoints with file-size and file-count limits.
- [ ] Implement `merge` with conflict-aware behavior:
  - detect conflicts,
  - return conflicted files,
  - keep workspace in `error` state when merge fails.
- [ ] Implement `discard` with staged/uncommitted safeguard and optional `force` flag.
- [ ] Add explicit error handling for missing worktree paths and deleted repo.

### Phase 7: Frontend integration

- [ ] Add workspace/project hooks and views.
- [ ] Add setup progress indicator + cancel action.
- [ ] Add workspace tree sidebar and workspace panel with diff tab.
- [ ] Add backend error code-aware UI mapping (e.g., 409 -> name/branch conflict message).
- [ ] Add tests for tree, workspace selection, merge/discard behavior, and setup running states.

### Phase 8: Hardening pass (before release)

- [ ] Add tests for concurrency/race conditions (simultaneous create/delete, stale states).
- [ ] Add manual test matrix:
  - repo deleted externally,
  - branch exists locally,
  - same branch/name reuse,
  - setup hangs,
  - merge conflict,
  - delete during setup/create.
- [ ] Add recovery job on app startup: mark orphaned workspaces and project path checks.

## Edge Cases and failure policy

- Worktree creation fails mid-way: set workspace to `error`, store `error_message`, cleanup partial filesystem artifacts, keep record for user repair.
- Repo directory deleted after project registration:
  - mark `projects` unhealthy,
  - block workspace actions with actionable message,
  - allow project edit/remove and explicit retry/reconnect.
- Two workspaces on same branch: enforce `UNIQUE(project_id, branch)` and return 409 before branch creation.
- Merge conflict:
  - fail merge with conflict list,
  - keep branch/worktree intact,
  - move status to `error` and require explicit user resolution strategy.
- Setup command hangs or exceeds timeout:
  - expose `setup_running` status and PID/elapsed,
  - allow cancellation,
  - emit timeout as recoverable error with logs.
- Simultaneous operations on same workspace: enforce mutex/serializing lock at service layer.

## Security considerations

- **Path safety**: always canonicalize, validate, and compare path prefix expectations before filesystem or git operations.
- **Command injection**: execute setup and git commands with arg arrays, never string interpolation.
- **Repo ownership assumptions**: do not execute network/git remote changes implicitly; require explicit merge/discard actions.
- **Arbitrary file access**: keep diff/merge/list operations restricted to canonical worktree path or project paths resolved by DB.
- **Output handling**: cap stderr/stdout size and sanitize for UI to avoid terminal escape injection.

## Performance considerations

- Avoid repeated `git worktree list` on hot paths; rely on DB-first reads + background reconciliation.
- Use lightweight SQL indexes on FK and status columns.
- Paginate diff/changed-files responses.
- Keep setup execution asynchronous; return operation status immediately and poll.
- Avoid N+1 queries by batching workspaces/projects queries.

## MVP scope (revised)

### Keep (MVP)
- Single-repo project model,
- workspace create/list/delete,
- diff view,
- merge/discard,
- per-workspace chat with `cwd`.

### Defer (post-MVP)
- Team-wide cross-machine workspace sync,
- PR creation workflow,
- advanced branch strategy tools,
- port conflict detection,
- sophisticated setup progress streaming UI.

### Removed/Downscoped from original plan
- `parallel agent dashboard` (future)
- advanced `.context` sharing model (future)
- workspace templates (future)

## Out of Scope (Future Work)

- PR creation from workspace (local merge only).
- `V2` SDK migration only after API stability is validated in current stack.
- Full remote repo onboarding (OAuth/URL clone flow) until local flow is stable.

## Status: NOT STARTED
