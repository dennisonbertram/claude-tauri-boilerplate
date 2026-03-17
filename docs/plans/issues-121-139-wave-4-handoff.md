# Issues 121-139 Wave 4 Handoff

## Status

Wave 4 was integrated on `codex/wave4-merge` from the current `codex/wave3-merge` baseline and then landed on `main`. All targeted automated tests on the merge branch were green. Backend curl verification and the Wave 4 frontend browser checks passed. The original live-browser blocker on `#128` was resolved afterward on `codex/issue-128-scroll-to-bottom-followup` by switching the chat scroll logic to direct `ScrollArea` viewport bindings.

## Per-Issue Handoff

### #121 Memory directory path uses server CWD instead of project root
- Branch: `codex/issue-121-memory-path`
- Commit: `14b575d`
- Status: regression-only on top of an existing fix already present on `codex/wave4-merge`
- Automated validation:
  - `pnpm test src/routes/memory.path-regression.test.ts` from `apps/server`
- Manual verification:
  - `curl http://localhost:3131/api/memory`
  - Verified `memoryDir` resolves to `/Users/dennisonbertram/.claude/projects/-Users-dennisonbertram-Develop-claude-tauri-boilerplate-.claude-worktrees-wave4-merge/memory`
  - Verified it does not contain the old `apps-server` suffix

### #122 New Chat button silently does nothing when a forked/loaded session is active
- Branch: status-only; no new code branch created in Wave 4
- Status: already covered on the integration line before Wave 4
- Existing regression coverage:
  - `apps/desktop/src/components/__tests__/NewChatBehavior.test.tsx`
- Manual verification:
  - Loaded an existing session (`Wave3 Export (fork)`)
  - Clicked `New Chat`
  - Verified the app returned to the empty-state `Start a conversation` view instead of getting stuck on the loaded session

### #123 Create Team dialog has outdated/wrong model IDs
- Branch: `codex/issue-123-team-model-ids`
- Commit: `f69cf23`
- Status: implemented
- Automated validation:
  - `pnpm test src/components/__tests__/TeamCreationDialog.test.tsx` from `apps/desktop`
- Manual verification:
  - Opened `Teams` -> `New Team`
  - Verified the model option values are `claude-sonnet-4-6`, `claude-opus-4-6`, and `claude-haiku-4-5-20251001`
  - Verified the visible labels are `Sonnet 4.6`, `Opus 4.6`, and `Haiku 4.5`

### #124 Duplicate workspace error leaks internal branch naming
- Branch: `codex/issue-124-workspace-duplicate-error`
- Commit: `376bfd4`
- Status: regression-only on top of an existing fix already present on `codex/wave4-merge`
- Automated validation:
  - `pnpm test ./src/routes/workspaces.test.ts` from `apps/server`
- Manual verification:
  - Created a temp repo-backed project through the live API
  - Attempted to create `dupe-test` twice
  - Verified the second request returned `409` with `A workspace named 'dupe-test' already exists in this project`
  - Verified the error text did not expose `workspace/dupe-test`

### #125 /export slash command gives no feedback
- Branch: `codex/issue-125-export-feedback`
- Commit: `0b1a396`
- Status: regression-only on top of an existing fix already present on `codex/wave4-merge`
- Automated validation:
  - `pnpm test src/hooks/useSessions.test.ts` from `apps/desktop`
- Manual verification:
  - Loaded the `Wave3 Export (fork)` session
  - Ran `/export` in the chat input
  - Verified a success toast rendered with `Session exported`
  - Verified the toast included the exported filename `Wave3_Export_fork.json`

### #128 Add scroll-to-bottom button in chat when scrolled up
- Branch: `codex/issue-128-scroll-to-bottom`
- Commit: `cff3f7a`
- Follow-up branch: `codex/issue-128-scroll-to-bottom-followup`
- Status: resolved after direct viewport binding follow-up
- Automated validation:
  - `pnpm test src/components/chat/__tests__/MessageList.test.tsx` from `apps/desktop`
- Manual verification:
  - Loaded a long existing session (`You're right — I apologize for the confusion! ...`)
  - Scrolled upward inside the message viewport
  - Verified the `message-list-scroll-to-bottom` affordance appeared as `Latest`
  - Clicked `Latest`
  - Verified the chat returned to the newest messages and the affordance disappeared again after the smooth scroll completed
- Follow-up implementation note:
  - The final fix replaces the brittle post-render viewport query in `apps/desktop/src/components/chat/MessageList.tsx`
  - The shared `apps/desktop/src/components/ui/scroll-area.tsx` wrapper now accepts explicit `viewportRef` and `viewportProps`

### #131 Deleting a project does not clean up workspace git branches
- Branch: `codex/issue-131-project-delete-branches`
- Commit: `50946e0`
- Status: regression-only on top of an existing fix already present on `codex/wave4-merge`
- Automated validation:
  - `pnpm test ./src/routes/workspaces.test.ts --bail=1` from `apps/server`
- Manual verification:
  - Created a temp repo-backed project and workspace through the live API
  - Deleted the project
  - Re-created the project from the same repo path
  - Re-created the same workspace name successfully
  - Verified the recreate request returned `201`, which means the old `workspace/dupe-test` branch was cleaned up

### #132 Workspace chat history lost when switching views
- Branch: `codex/issue-132-workspace-history`
- Commit: `0fa1dbd`
- Status: regression-only on top of an existing fix already present on `codex/wave4-merge`
- Existing implementation on merge line:
  - `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` already restores the workspace session via `api.getWorkspaceSession(workspace.id)`
- Automated validation:
  - `pnpm test ./src/routes/workspaces.test.ts --bail=1` from `apps/server`
- Manual verification:
  - Backend spot check via `GET /api/workspaces/:id/session` on a newly created workspace returned `null` correctly when no linked session exists
  - UI follow-up for another agent:
    1. Open `Workspaces`
    2. Send a workspace message
    3. Switch to `Chat` or `Teams`
    4. Switch back to `Workspaces`
    5. Confirm the previous conversation reloads instead of the empty state

### #137 Team creation form shows stale validation error after correction
- Branch: `codex/issue-137-team-validation`
- Commit: `497c9f5`
- Status: regression-only on top of an existing fix already present on `codex/wave4-merge`
- Automated validation:
  - `pnpm test src/components/__tests__/TeamCreationDialog.test.tsx` from `apps/desktop`
- Manual verification:
  - Opened `Teams` -> `New Team`
  - Clicked `Create Team` with an empty name to show the validation error
  - Typed `Wave 4 Team`
  - Verified the error cleared immediately while typing

### #138 /compact toast never auto-dismisses
- Branch: `codex/issue-138-compact-duration`
- Commit: `1c6412f`
- Status: regression-only on top of an existing fix already present on `codex/wave4-merge`
- Automated validation:
  - `pnpm test src/hooks/useCommands.test.ts` from `apps/desktop`
- Manual verification:
  - Loaded an existing session
  - Ran `/compact`
  - Verified the `Context compaction is automatic` toast appeared
  - Waited 6.5 seconds
  - Verified the toast was gone

### #139 StatusBar permission mode hardcodes `Normal`
- Branch: `codex/issue-139-permission-mode`
- Commit: `7b4276b`
- Status: regression-only on top of an existing fix already present on `codex/wave4-merge`
- Automated validation:
  - `pnpm test src/components/__tests__/StatusBar.test.tsx` from `apps/desktop`
- Manual verification:
  - Used `Cmd+,` to open Settings
  - Switched to the `Advanced` tab
  - Changed permission mode from `Default` to `Plan` and `Accept Edits`
  - Verified the status bar label updated from `Normal` to `Plan` and then `Accept Edits`

## Merge Recommendation

- Wave 4 has landed on `main`.
- The `#128` follow-up should be tracked from `codex/issue-128-scroll-to-bottom-followup` and its direct viewport-binding fix.
