# Issue #354: Workspace Rename UI Unreachable

## Summary

The workspace/project rename functionality has a **complete backend and a full-featured UI component (`ProjectSidebar`)**, but that component is **never rendered in the app**. The actual sidebar used is `ProjectsSection`, a stripped-down version that lacks rename, delete, and context-menu actions entirely. The `WorkspacePanelHeader` also displays the workspace name as static text with no edit affordance.

---

## Component Analysis

### 1. `ProjectSidebar.tsx` -- Full rename UI (UNUSED)

**File:** `apps/desktop/src/components/workspaces/ProjectSidebar.tsx`

This component has complete rename functionality:

- **Props (line 22):** `onRenameWorkspace: (id: string, branch: string) => void`
- **State (lines 44-45):** `editingWorkspaceId` and `editingBranch` for inline editing
- **`beginRename()` (lines 89-92):** Sets editing state for a workspace
- **`cancelRename()` (lines 94-97):** Clears editing state
- **`commitRename()` (lines 107-131):** Validates and calls `onRenameWorkspace`
- **Rename button (lines 313-322):** Pencil icon button on hover, calls `beginRename(ws)`
- **Inline edit input (lines 327-357):** Text input with Save/Cancel buttons, Enter/Escape/blur handling

**Problem:** `ProjectSidebar` is **never imported or rendered** in `App.tsx`. It is only referenced in:
- `App.test.tsx` (mocked out at line 126)
- `ProjectSidebar.test.tsx` (unit tests)

### 2. `ProjectsSection.tsx` -- Actual sidebar (NO rename)

**File:** `apps/desktop/src/components/sidebar/ProjectsSection.tsx`

This is the component actually rendered in the app sidebar.

- **Imported in `AppSidebar.tsx` (line 19):** `import { ProjectsSection } from '@/components/sidebar/ProjectsSection'`
- **Rendered in `AppSidebar.tsx` (line 213):** When `activeView === 'workspaces'`
- **Props:** Only accepts `projects`, `workspacesByProject`, `selectedWorkspaceId`, `onSelectWorkspace`, `onAddProject`
- **Missing:** No `onRenameWorkspace`, no `onDeleteProject`, no `onCreateWorkspace`, no context menus, no inline editing

The comment on line 8 says it all: `"Projects Section (inline simplified version of ProjectSidebar)"` -- it was intentionally simplified and lost the rename capability.

### 3. `WorkspacePanelHeader.tsx` -- Detail header (NO rename)

**File:** `apps/desktop/src/components/workspaces/WorkspacePanelHeader.tsx`

- **Line 32:** Displays `workspace.name` as a static `<h2>` element
- **Line 33:** Displays `workspace.branch` as a static `<span>`
- **No rename props or editing state** -- the header only supports copy-branch, merge, and discard actions
- This would be the natural place for a "click to rename" or pencil-icon interaction

### 4. `WorkspacePanel.tsx` -- Panel container

**File:** `apps/desktop/src/components/workspaces/WorkspacePanel.tsx`

- Renders `WorkspacePanelHeader` at line 107
- Does not pass any rename-related props to the header
- Has no `onRenameWorkspace` in its own props interface

---

## Backend Analysis (FULLY WORKING)

### API Endpoint

**File:** `apps/server/src/routes/workspaces.ts`

- **PATCH `/api/workspaces/:id`** (lines 243-308): Accepts `name`, `branch`, and/or `additionalDirectories`
- Validation via `workspaceUpdateSchema` (lines 51-58): Zod schema requiring at least one field
- Calls `worktreeOrchestrator.renameWorkspace()` (line 298)

### Orchestrator

**File:** `apps/server/src/services/worktree-orchestrator.ts`

- `renameWorkspace()` (lines 149-175): Validates fields, updates DB via `updateWorkspace()`
- Supports renaming `name`, `branch`, and `additionalDirectories`

### Client API

**File:** `apps/desktop/src/lib/api/workspaces-api.ts`

- `renameWorkspace()` (lines 47-58): Sends PATCH to `/api/workspaces/:id`
- Uses `WorkspaceRenameRequest` type from shared package

### Hook

**File:** `apps/desktop/src/hooks/useWorkspaces.ts`

- `renameWorkspace` callback (lines 58-63): Calls API and updates local state
- Exposed in return value (line 75)

### Shared Type

**File:** `packages/shared/src/types.ts`

- `WorkspaceRenameRequest` (lines 813-817): `{ name?: string; branch?: string; additionalDirectories?: string[] }`

---

## What Needs to Change

### Option A: Add rename to `ProjectsSection` (minimal fix)

1. **`ProjectsSection.tsx`**: Add `onRenameWorkspace` prop and inline rename UI (port from `ProjectSidebar.tsx` lines 89-131, 313-357)
2. **`AppSidebar.tsx`**: Pass `onRenameWorkspace` handler down to `ProjectsSection`
3. **`App.tsx`**: Wire `useWorkspaces().renameWorkspace` to `AppSidebar`

### Option B: Add rename to `WorkspacePanelHeader` (better UX)

1. **`WorkspacePanelHeader.tsx`**: Add `onRename` prop, make workspace name editable (click-to-edit or pencil icon)
2. **`WorkspacePanel.tsx`**: Add `onRenameWorkspace` prop, wire it to header
3. **Parent component**: Pass `useWorkspaces().renameWorkspace` down

### Option C: Both (recommended)

Add rename capability in both the sidebar (right-click or hover action on workspace items) and the detail header (click-to-edit on the workspace name). This matches common UX patterns where items can be renamed from either their list entry or their detail view.

### Key wiring needed regardless of option:

1. `AppSidebar.tsx` props need `onRenameWorkspace` callback
2. `App.tsx` needs to connect `useWorkspaces().renameWorkspace` to the sidebar
3. The rename handler signature should match `WorkspaceRenameRequest`: `{ name?: string; branch?: string }`

---

## Files Involved

| File | Role | Status |
|------|------|--------|
| `apps/desktop/src/components/workspaces/ProjectSidebar.tsx` | Full rename UI | UNUSED in app |
| `apps/desktop/src/components/sidebar/ProjectsSection.tsx` | Actual sidebar | Missing rename |
| `apps/desktop/src/components/workspaces/WorkspacePanelHeader.tsx` | Workspace detail header | Static name display |
| `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` | Panel container | No rename props |
| `apps/desktop/src/components/AppSidebar.tsx` | Main sidebar shell | No rename prop |
| `apps/server/src/routes/workspaces.ts` | PATCH endpoint | Working |
| `apps/server/src/services/worktree-orchestrator.ts` | Rename logic | Working |
| `apps/desktop/src/lib/api/workspaces-api.ts` | Client API | Working |
| `apps/desktop/src/hooks/useWorkspaces.ts` | React hook | Working (exposes `renameWorkspace`) |
| `packages/shared/src/types.ts` | Type definitions | Working (`WorkspaceRenameRequest`) |
