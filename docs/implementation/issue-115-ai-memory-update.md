# Issue #115: AI Memory Update from Review Feedback

## Summary

Completed the issue-115 MVP beyond the prior toast-only prompt.

- Added two repo-scoped workflow prompt templates: `reviewMemory` and `mergeMemory`.
- Persist those templates in the existing repo memory files via `/api/memory`.
- Queue a pending memory draft when the user addresses review feedback or completes a workspace merge.
- Open the existing Memory tab with that queued draft preloaded into `MEMORY.md`, so saving uses the normal memory file routes and future sessions reuse the same repo memory files.

## Files Changed

- `apps/desktop/src/lib/workflowPrompts.ts`
- `apps/desktop/src/lib/workflowPrompts.test.ts`
- `apps/desktop/src/lib/memoryUpdatePrompt.ts`
- `apps/desktop/src/lib/__tests__/memoryUpdatePrompt.test.ts`
- `apps/desktop/src/components/chat/ChatPage.tsx`
- `apps/desktop/src/components/chat/__tests__/ChatPageTransport.test.tsx`
- `apps/desktop/src/components/workspaces/WorkspacePanel.tsx`
- `apps/desktop/src/components/workspaces/__tests__/WorkspacePanel.test.tsx`
- `apps/desktop/src/components/settings/SettingsPanel.tsx`
- `apps/desktop/src/components/settings/SettingsPanel.test.tsx`
- `apps/desktop/src/components/settings/MemoryPanel.tsx`
- `apps/desktop/src/components/__tests__/MemoryPanel.test.tsx`
- `docs/plans/issue-115-ai-memory-update.md`
- `docs/implementation/INDEX.md`
- `docs/logs/engineering-log.md`

## Behavior

### Review feedback

When plan review feedback is submitted, the app now:

1. Builds a repo-scoped memory-update draft from the `reviewMemory` prompt.
2. Queues that draft in session storage.
3. Surfaces the existing toast prompt.
4. Opens Settings → Memory with `MEMORY.md` preloaded for editing when the user accepts the prompt.

### Post-merge

After a successful workspace merge, the app now:

1. Builds a repo-scoped memory-update draft from the `mergeMemory` prompt.
2. Queues that draft in session storage.
3. Surfaces the post-merge memory prompt.
4. Opens Settings → Memory with the same `MEMORY.md` draft ready to save.

### Persistence and future-session reuse

- Prompt templates are stored in repo memory files:
  - `workflow-review-memory.md`
  - `workflow-merge-memory.md`
- The Memory tab still saves through the existing `/api/memory` routes.
- Because the draft lands in real repo memory files, future sessions continue using the same persisted repository memory.

## Verification

### Automated

- `pnpm --filter @claude-tauri/desktop exec vitest run --configLoader runner src/lib/workflowPrompts.test.ts src/components/settings/SettingsPanel.test.tsx src/components/__tests__/MemoryPanel.test.tsx src/components/chat/__tests__/ChatPageTransport.test.tsx src/components/workspaces/__tests__/WorkspacePanel.test.tsx`
  - Result: `5` files passed, `65` tests passed
- `pnpm --filter @claude-tauri/desktop exec vitest run --configLoader runner src/hooks/useSettings.test.ts src/lib/__tests__/memoryUpdatePrompt.test.ts src/components/settings/SettingsPanel.test.tsx src/components/__tests__/MemoryPanel.test.tsx src/components/chat/__tests__/ChatPageTransport.test.tsx src/components/workspaces/__tests__/WorkspacePanel.test.tsx src/lib/workflowPrompts.test.ts`
  - Result: `7` files passed, `104` tests passed

### Manual

- Checked `lsof -i :1420 -i :3131` in this worktree before starting live verification.
- Manual browser verification was blocked because both required fixed ports were already occupied by another running dev instance, so starting an isolated frontend/backend pair for this worktree would have conflicted with an unrelated session.
