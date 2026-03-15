# Multi-workspace implementation review

Reviewed files:
- Backend: `apps/server/src/services/git-command.ts`, `apps/server/src/services/worktree.ts`, `apps/server/src/services/worktree-orchestrator.ts`, `apps/server/src/services/project.ts`, `apps/server/src/utils/paths.ts`, `apps/server/src/db/schema.ts`, `apps/server/src/db/index.ts`, `apps/server/src/routes/projects.ts`, `apps/server/src/routes/workspaces.ts`, `apps/server/src/routes/chat.ts`
- Frontend: `apps/desktop/src/lib/workspace-api.ts`, `apps/desktop/src/hooks/useProjects.ts`, `apps/desktop/src/hooks/useWorkspaces.ts`, `apps/desktop/src/hooks/useWorkspaceDiff.ts`, `apps/desktop/src/components/workspaces/*.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/components/chat/ChatPage.tsx`
- Shared: `packages/shared/src/types.ts`

## Findings

### CRITICAL

1. Workspace changed-files contract mismatch breaks diff UX
- Backend returns changed files as a plain string array, but frontend expects objects with `path` + `status`.
  - Backend: `apps/server/src/routes/workspaces.ts` lines `132-133` returns `files` as `string[]`.
  - Frontend type: `apps/desktop/src/hooks/useWorkspaceDiff.ts` lines `4-7` expects `{ path: string; status: string }[]`.
  - Usage: `apps/desktop/src/components/workspaces/WorkspaceDiffView.tsx` lines `73-77` reads `file.path` and `file.status`.
- Impact: diff list displays broken values and loses intended semantic coloring; effectively breaks changed-file UX in the feature.
- Remediation: standardize response shape (either change backend to return `{path, status}` or update frontend to consume `string[]`).

2. Workspace chat context is not isolated across workspace switches in the UI
- Workspace chat is intentionally rendered with `sessionId={null}`.
  - `apps/desktop/src/App.tsx` lines `191-197`, `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` lines `87-92`.
- `ChatPage` clears/load messages only on sessionId changes, not on workspace switches.
  - `apps/desktop/src/components/chat/ChatPage.tsx` lines `250-265`, `360-365`.
- Since `WorkspacePanel` is reused while `selectedWorkspace` changes, stale chat messages can persist and be sent as context to a different workspace.
- Impact: cross-workspace prompt contamination and incorrect assistant behavior.
- Remediation: key `ChatPage` by `workspace.id` in workspace mode, or include explicit `workspaceId` in dependency-driven reset + message load logic.

### HIGH

3. Race conditions in merge/discard flows are not protected transactionally
- Merge route checks state and proceeds, then sets `merging` and runs git ops without transaction/locking.
  - `apps/server/src/routes/workspaces.ts` lines `147-149`, `163-166`, `170-176`.
- Delete route in orchestrator has guarded statuses but no optimistic concurrency and can interleave with other ops.
  - `apps/server/src/services/workspace-orchestrator.ts` lines `218-226`, `237-260`, `264-283`.
- Impact: concurrent merge/discard calls can both pass pre-checks and leave repository/workspace records in inconsistent states.
- Remediation: add operation-level locking/transactions and re-check status immediately before/after critical git mutations.

4. Status transition logic is defined but not consistently applied at runtime boundaries
- Shared transition map exists (`VALID_WORKSPACE_TRANSITIONS`, `isValidTransition`) but route/service mutators set status directly.
  - `packages/shared/src/types.ts` lines `580-595`, `592-594`.
  - Direct transition examples: `apps/server/src/routes/workspaces.ts` lines `163-164`, `215-216`, `apps/server/src/services/workspace-orchestrator.ts` line `230`.
- Impact: state-machine guarantees are bypassed by construction and future entry points can bypass intended invariants.
- Remediation: gate every state update through `isValidTransition` (or a single transition helper) before updates.

5. Project deletion does not cleanup workspace filesystem artifacts
- Project delete API only removes DB row.
  - `apps/server/src/routes/projects.ts` lines `99-111`, service `apps/server/src/services/project.ts` lines `122-125`.
- Cascading DB cleanup does not remove corresponding physical worktree directories.
- Impact: orphaned worktrees accumulate on disk and may retain sensitive repo data after project deletion.
- Remediation: iterate and delete project worktrees in project-delete orchestration, with best-effort cleanup and status reporting.

### MEDIUM

6. `changed-files` endpoint masks filesystem failures
- `WorktreeService.getChangedFiles` swallows non-zero git exit codes for each command and returns deduplicated paths only when readable output exists.
  - `apps/server/src/services/worktree.ts` lines `142-159`.
- If the worktree path is missing/misaligned, endpoint returns an empty list instead of an actionable error.
- Impact: users see “No changes” when workspace is actually broken.
- Remediation: validate command results, return 4xx/5xx on hard failures.

7. Setup command parsing is fragile and overly permissive
- `runSetupCommand` uses naive `split(/\s+/)` parsing and then spawns with positional args.
  - `apps/server/src/services/workspace-orchestrator.ts` lines `293-297`.
- Commands containing quoted args, escaped whitespace, or shell-style constructs are misparsed.
- Impact: setup command support can be unreliable and may run unintended command arrays.
- Remediation: use explicit command/arg schema (JSON or `shlex`-like parser) and reject unsupported syntaxes early.

8. Orchestration does not use path-safety checks even where they exist
- `isPathSafe`, canonicalization helpers are implemented but never enforced for workspace path operations.
  - `apps/server/src/utils/paths.ts` lines `20-27`, `11-13`.
- Most operations rely on DB row integrity and implicit trust in stored paths.
- Impact: weaker defense-in-depth for potential DB tampering or accidental corrupt state.
- Remediation: validate workspace paths before each git invocation (path exists + isPathSafe to expected root).

## Perspective coverage

- **Security**: Good use of prepared statements and argument-array command execution; weak points are runtime path checks and setup command parsing robustness.
- **Error handling**: Some operations catch and classify failures, but several critical code paths downgrade errors to empty results or partial state changes.
- **Race conditions**: Main gap is concurrent state mutation in merge/discard without transactionality.
- **API design**: Mostly consistent, but changed-files contract is currently broken.
- **Frontend**: Missing workspace-level cleanup/re-mount semantics for chat context.
- **Code quality**: Modular structure is clear, but transition/state guarding is not consistently centralized.
- **Test coverage**:
  - Strong backend coverage for workspace routes/migration/merge/discard basics.
  - Missing tests for concurrency semantics, workspace chat switching isolation, filesystem cleanup after project deletion, and contract mismatch for `changed-files` shape.
