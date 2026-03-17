1. Scope completed
- Added diff history/review scaffolding for Issue #80 in a minimal slice centered on changed-files + diff endpoints and the workspace diff UI:
  - Frontend API/hook now accepts optional historical range refs (`fromRef`/`toRef`).
  - Backend diff/changed-file endpoints accept optional range params and validate pairwise query usage.
  - Added workspace revision endpoint and server-side revision extraction.
  - Reworked `WorkspaceDiffView` to support unified vs side-by-side rendering, historical compare controls, inline per-line comment composer, markdown comment rendering, and file review state/actions/filtering.
- Added initial automated test coverage for the new parser used by the diff view.
- Added plan/implementation issue docs and indexed them.

2. Files changed
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/apps/desktop/src/lib/workspace-api.ts]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/apps/desktop/src/hooks/useWorkspaceDiff.ts]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/apps/desktop/src/components/workspaces/WorkspaceDiffView.tsx]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/apps/desktop/src/components/workspaces/__tests__/WorkspaceDiffView.test.tsx]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/apps/server/src/services/worktree.ts]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/apps/server/src/routes/workspaces.ts]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/apps/server/src/routes/workspaces-diff.test.ts]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/docs/plans/issue-80-diff-viewer.md]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/docs/implementation/issue-80-wave-1-subagent.md]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/docs/plans/INDEX.md]
- [/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-80/docs/implementation/INDEX.md]

3. Tests run
- `pnpm --filter @claude-tauri/server test src/routes/workspaces-diff.test.ts`
  - Failed: workspace node_modules were missing in this worktree.
- `pnpm --filter @claude-tauri/desktop test src/components/workspaces/__tests__/WorkspaceDiffView.test.tsx`
  - Failed: `vitest: command not found` / missing node_modules.
- Attempted dependency install: `pnpm install`
  - Failed due external network restrictions reaching `registry.npmjs.org` (ENOTFOUND).

4. Manual verification
- Full manual browser verification not performed.
- Backend smoke curl verification not performed because the server could not be started in this worktree due dependency/network constraints.
- Suggested browser-control smoke once the app is running:
  1. Open a workspace with changes and switch the diff view between unified and side-by-side.
  2. Select two revisions and verify the historical diff updates for that range.
  3. Add an inline comment and confirm markdown rendering appears in the diff UI.
  4. Mark a file reviewed and verify the reviewed-state filter updates.

5. Risks/blockers
- High: package/tooling environment is not bootstrapped (node_modules unresolved and registry access blocked), so automated verification is currently blocked.
- Medium: inline comments are currently UI-local only (not persisted to backend), so they are not review-history durable.
- Medium: historical compare route currently returns errors on missing or non-existent refs via generic 500 from git failure; this is functional but could be improved to explicit git/ref validation errors.

6. Suggested next step
- After dependencies are available, run:
  - `pnpm install`
  - `pnpm --filter @claude-tauri/server test src/routes/workspaces-diff.test.ts`
  - `pnpm --filter @claude-tauri/desktop test src/components/workspaces/__tests__/WorkspaceDiffView.test.tsx`
  - Add a direct manual check in the Diff tab for:
    - unified/side-by-side toggle
    - historical compare via revision selects + Apply
    - inline line comment add/edit and markdown render
    - file review filter and mark reviewed actions
