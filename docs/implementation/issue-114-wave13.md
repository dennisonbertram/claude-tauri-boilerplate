# Issue #114 Wave 13

Implemented multi-repo workspace attachments for `/add-dir` workflows.

## What changed

- Persisted `additionalDirectories` on workspace records and surfaced them through the shared workspace types and workspace APIs.
- Forwarded workspace `additionalDirectories` into chat requests and Claude query options so runs can access files outside the primary worktree.
- Updated the Workspaces `Paths` tab to behave like workspace settings for multi-repo attachments, including repo-derived labels, filtering by repo/path text, and `/add-dir <path>` routing from chat into the Paths flow.

## Regression Coverage

- `apps/server/src/db/db-workspaces.test.ts`
- `apps/server/src/routes/workspaces.test.ts`
- `apps/server/src/routes/chat-workspace.test.ts`
- `apps/server/src/services/claude.test.ts`
- `apps/desktop/src/components/workspaces/__tests__/WorkspacePanel.test.tsx`
- `apps/desktop/src/components/chat/__tests__/ChatPageSlashCommands.test.tsx`
- `apps/desktop/src/components/chat/__tests__/ChatPageTransport.test.tsx`
- `apps/desktop/src/hooks/useCommands.test.ts`

## Manual Verification

- `curl -X PATCH /api/workspaces/:id` with a valid absolute path persisted `additionalDirectories` and returned the updated workspace payload.
- `curl -X PATCH /api/workspaces/:id` with `../definitely-missing-path` returned `400 {"error":"Invalid additionalDirectories payload","code":"VALIDATION_ERROR"}`.
- `curl -N -X POST /api/chat` with `workspaceId` and `additionalDirectories` streamed a successful Claude response (`ISSUE-114-CHAT-OK`).
- In the browser, reloading the app and reopening the workspace `Paths` tab still showed the attached `shared` directory with the repo label `Repo: shared`, and filtering by `shared` kept the row visible.
