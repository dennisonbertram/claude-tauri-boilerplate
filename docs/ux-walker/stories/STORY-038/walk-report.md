# STORY-038: Rename Workspace and Branch

## Status: FAIL

## Walk Steps

1. Opened workspace Investigation
2. Checked workspace header -- heading "Investigation" is static h2 text, no edit/rename affordance
3. Looked for rename button or edit icon near workspace name -- none found
4. Checked sidebar workspace entry -- no rename controls visible
5. Searched source code for rename functionality
6. Found `ProjectSidebar.tsx` has full rename-branch UI (pencil icon, inline input, Save/Cancel buttons)
7. However, `ProjectSidebar` component is NOT imported or used anywhere in the actual running app
8. The app sidebar uses `ProjectsSection.tsx` which is described as "inline simplified version of ProjectSidebar" -- it has NO rename functionality
9. No workspace name rename exists anywhere in the codebase -- only branch rename (in unused component)

## Findings

### What Exists in Code (but NOT accessible)
- `ProjectSidebar.tsx` lines 312-356: Full rename-branch UI with:
  - Pencil icon button with title="Rename branch"
  - Inline text input for editing branch name
  - Save/Cancel buttons
  - Enter to confirm, Escape to cancel, blur to save
  - `commitRename()` function calls `onRenameWorkspace()`

### Issues Found
1. **BUG: Rename branch UI is in an unused component** -- `ProjectSidebar.tsx` has the rename functionality but is never imported or rendered in the actual app. The sidebar uses `ProjectsSection.tsx` instead, which has no rename capability.
2. **MISSING: No workspace name rename** -- Only branch rename exists (in unused code). There is no way to rename the workspace display name ("Investigation").
3. **MISSING: No context menu on workspace entries** -- Right-clicking or long-pressing workspace entries in the sidebar does not show any context menu with rename/delete options.

## Screenshots
- `workspace-overview.png` (shared with STORY-036) -- Shows workspace header with static name
