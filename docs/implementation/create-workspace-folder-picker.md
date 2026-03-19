# Create Workspace Dialog: Folder Picker + Git Branch Auto-Detection

## Summary

Added folder picker and git branch auto-detection to the `CreateWorkspaceDialog` manual mode. Branch dropdowns replace text inputs when branches are available. The project's `repoPath` is used to pre-load branches on dialog open.

## Files Changed

### `apps/desktop/src/lib/workspace-api.ts`
- Added `fetchGitBranchesFromPath(path: string): Promise<{ name: string }[]>` — calls `GET /api/git/branches?path=<encodedPath>`, mirrors the error-handling pattern of `fetchProjectBranches`.

### `apps/desktop/src/components/workspaces/CreateWorkspaceDialog.tsx`
- Added imports: `Folder2` from lucide-react, `isTauri` from `@/lib/platform`, `fetchGitBranchesFromPath` from workspace-api.
- Added `repoPath?: string` to `CreateWorkspaceDialogProps`.
- Added state: `folderPath`, `localBranches`, `branchesLoading`.
- Added `handleBrowseFolder` — uses `@tauri-apps/plugin-dialog` `open()` to select a directory; only rendered when `isTauri()` is true.
- Added `useEffect` that triggers `fetchGitBranchesFromPath(repoPath)` when the dialog opens and `repoPath` is provided.
- Added `useEffect` that triggers `fetchGitBranchesFromPath(folderPath)` when the user types or browses to a path.
- Updated manual mode JSX:
  - Repository Path row at the top: text input + optional Browse button.
  - Loading/branch-count status line below the path row.
  - Base Branch and Source Branch fields switch from `<Input>` to `<select>` when `localBranches.length > 0`.
- `resetAll()` now also clears `folderPath`, `localBranches`, `branchesLoading`.

### `apps/desktop/src/App.tsx`
- Passed `repoPath={createWorkspaceProject.repoPathCanonical || createWorkspaceProject.repoPath}` to `<CreateWorkspaceDialog>`.

## Behavior

1. When `CreateWorkspaceDialog` opens, if the project has a `repoPathCanonical` or `repoPath`, branches are fetched immediately and the Base Branch / Source Branch dropdowns populate.
2. In Tauri, the Browse button opens a native folder picker. Selecting a folder triggers branch detection from that path.
3. The path can also be typed directly; branches are re-fetched on change.
4. If branch detection fails or returns empty, both fields fall back to plain text inputs.
5. Branch mode and GitHub Issue mode are unchanged.
