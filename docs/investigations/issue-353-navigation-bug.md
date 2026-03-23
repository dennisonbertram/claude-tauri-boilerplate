# Investigation: Issue #353 — New Project & Merge Buttons Navigate Instead of Acting

## GitHub Issues

### #353 — New Project button navigates to chat instead of opening creation dialog
- **Severity**: high
- **Category**: happy-path
- **Symptom**: Clicking "New Project" on the Projects page navigates to the Chat view instead of opening a project creation dialog.
- **Related bugs mentioned**: project card clicks, Merge button (STORY-034)

### #352 — Fork session action navigates to Projects instead of forking
- **Severity**: high
- **Symptom**: Clicking "Fork" in the sidebar session context menu navigates to the Projects page instead of forking the session.

### #355 — Diff line comment button click has no effect
- **Severity**: medium
- **Symptom**: Per-line comment button on diff lines does not open the DiffCommentComposer textarea despite the feature being fully implemented.

## Code Analysis

### "New Project" Button Flow

The "New Project" button appears in three places within `ProjectsGridView.tsx`:

1. **Header bar button** (line 78-84): `<button onClick={onAddProject}>`
2. **Empty state button** (line 56-62): `<button onClick={onAddProject}>`
3. **Dashed card button** (line 186-197): `<button onClick={onAddProject}>`

All three call `onAddProject`, which is wired in `App.tsx` (line 109) as:
```tsx
onAddProject={() => setAddProjectOpen(true)}
```

This opens the `AddProjectDialog` component (rendered at App.tsx line 118). The dialog is a `fixed inset-0 z-50` overlay — a standard modal pattern.

**Finding: The button handler is correctly wired.** The `<button>` elements are plain HTML buttons with no wrapping `<a>` or `<Link>` components. No form submission is involved (no `type="submit"`).

### "Merge" Button Flow

The Merge button in `WorkspacePanelHeader.tsx` (line 105-107):
```tsx
<Button variant="outline" size="sm" onClick={onMerge}>
  Merge
</Button>
```

The `Button` component uses `@base-ui/react/button` which renders a native `<button>` element with `type="button"` (confirmed in useButton.js line 82). The `onMerge` prop is set in `WorkspacePanel.tsx` (line 113):
```tsx
onMerge={() => setMergeDialog('merge')}
```

This opens `WorkspaceMergeDialog`, a confirmation modal with `fixed inset-0 z-50`.

**Finding: The button handler is correctly wired.** The base-ui Button primitive always renders `<button type="button">`, preventing any form submission side effects.

### Fork Session Flow

The Fork action in `SessionItem.tsx` (line 88-90):
```tsx
case 'fork':
  setMenuOpen(false);
  onFork?.();
  break;
```

The `onFork` calls `forkSession(session.id)` from `useSessions.ts` (line 59-69), which:
1. POSTs to `/api/sessions/${id}/fork`
2. Adds the forked session to state
3. Calls `setActiveSessionId(forked.id)`

**Finding: `forkSession` does NOT call `setActiveView('chat')`.** However, the sidebar's `onSelectSession` handler (App.tsx line 88) DOES switch to chat view. If the fork succeeds and `setActiveSessionId` triggers any listener that also switches views, that could cause navigation. But in the current code, `setActiveSessionId` is a plain state setter — it does not trigger view changes unless something else reacts to it.

## Root Cause Analysis

After thorough review, the button click handlers are **all correctly wired at the React component level**. The code paths from button click to state change are sound. There is no wrapping `<Link>` or `<a>` element around any of these buttons.

### Probable Root Causes

#### 1. Z-index / Overlay Collision (Most Likely)

The `ViewSwitcherHeader` component (App.tsx line 94) renders an absolutely positioned floating header with `pointer-events-auto` when `activeView === 'chat'`. While it returns `null` for other views, if there is a brief render cycle where `activeView` flashes back to `'chat'` (e.g., due to a React concurrent mode re-render or a stale closure), the floating header could intercept clicks intended for the content below.

The content area layout:
```
div.relative.flex-1 (parent)
  div.absolute.inset-0.z-0 (grid pattern, pointer-events-none) -- OK
  ViewSwitcherHeader (absolute positioned when visible) -- potential issue
  div.relative.z-10 (content) -- ProjectsGridView / WorkspacePanel
```

When `activeView === 'chat'`, a `pt-14` padding is added to the content div. When switching to `'workspaces'`, this padding is removed. If the ViewSwitcherHeader lingers due to React reconciliation, its `pointer-events-auto` area could intercept clicks.

#### 2. Sidebar Event Bubbling

The sidebar's "New Chat" button is visually prominent and at the top of the sidebar. If the ux-walker (automated testing bot) clicks coordinates that land on the sidebar's "New Chat" button instead of the grid's "New Project" button, this would call `handleNewChat` which sets `setActiveView('chat')` — exactly matching the reported symptom.

The sidebar renders different content sections based on `activeView`:
- `'chat'` -> Session list
- `'workspaces'` -> ProjectsSection

When switching from workspaces to chat, the sidebar content changes, potentially shifting DOM elements.

#### 3. `workspacesByProject` Memo Only Contains One Project's Workspaces

In App.tsx (line 59):
```tsx
const workspacesByProject = useMemo(() => {
  const m: Record<string, Workspace[]> = {};
  if (selectedProjectId) m[selectedProjectId] = workspaces;
  return m;
}, [selectedProjectId, workspaces]);
```

This only populates workspaces for the currently selected project. When `ProjectsGridView` renders project cards, clicking a card for a non-selected project (line 138-141):
```tsx
onClick={() => {
  const ws = workspacesByProject[project.id]?.[0];
  if (ws) onSelectWorkspace(ws);
}}
```

For projects other than `selectedProjectId`, `workspacesByProject[project.id]` is `undefined`, so the click is a **no-op**. This is a separate bug — project cards for non-active projects are not navigable.

## Affected Files

| File | Lines | Issue |
|------|-------|-------|
| `apps/desktop/src/App.tsx` | 59 | `workspacesByProject` memo only includes one project's workspaces |
| `apps/desktop/src/App.tsx` | 93-95 | ViewSwitcherHeader + content z-index layering |
| `apps/desktop/src/App.tsx` | 107-109 | Workspace view rendering logic |
| `apps/desktop/src/components/workspaces/ProjectsGridView.tsx` | 78-84 | "New Project" button (correctly wired) |
| `apps/desktop/src/components/workspaces/ProjectsGridView.tsx` | 134-141 | Project card click handler relies on incomplete `workspacesByProject` |
| `apps/desktop/src/components/workspaces/WorkspacePanelHeader.tsx` | 104-107 | "Merge" button (correctly wired) |
| `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` | 113 | Merge dialog trigger (correctly wired) |
| `apps/desktop/src/hooks/useSessions.ts` | 59-69 | Fork handler missing `setActiveView` awareness |

## Proposed Fix

### Fix 1: Add `e.stopPropagation()` and `e.preventDefault()` to action buttons

While the handlers are correctly wired, adding explicit event stop/prevent on the buttons would guard against any ancestor event handlers intercepting the click:

```tsx
// ProjectsGridView.tsx — "New Project" button
<button
  onClick={(e) => {
    e.stopPropagation();
    e.preventDefault();
    onAddProject();
  }}
  ...
>
  New Project
</button>
```

Apply the same pattern to the Merge and Discard buttons in `WorkspacePanelHeader.tsx`.

### Fix 2: Fix `workspacesByProject` to include all projects

In `App.tsx`, the `workspacesByProject` memo should include workspaces for ALL projects, not just the selected one. This requires fetching workspaces for all projects or restructuring data loading:

```tsx
// Option A: Load all workspaces upfront
const { allWorkspacesByProject } = useAllProjectWorkspaces(projects);

// Option B: Make project cards navigate to project details instead of workspace
onClick={() => {
  setSelectedProjectId(project.id);
  // Don't try to select a workspace — just show the project's workspace list
}}
```

### Fix 3: Add `type="button"` explicitly to all buttons in ProjectsGridView

While plain `<button>` elements default to `type="submit"` only inside forms (and there are no forms here), being explicit prevents any future regressions:

```tsx
<button type="button" onClick={onAddProject} ...>
```

### Fix 4: Ensure ViewSwitcherHeader doesn't interfere with non-chat views

Add an explicit guard or use CSS `display: none` instead of returning `null`:

```tsx
// ViewSwitcherHeader.tsx
if (activeView !== 'chat') return null;
// This is already correct, but adding a key forces unmount:
<ViewSwitcherHeader key={activeView} ... />
```

## Conclusion

The button handlers are correctly wired in React. The most likely cause of the reported navigation bug is either (a) an event propagation issue where a parent or overlay element intercepts the click, or (b) the ux-walker automated test hitting adjacent elements due to DOM layout proximity. The `workspacesByProject` incomplete data is a confirmed secondary bug causing project card clicks to be no-ops for non-selected projects. Adding explicit `e.stopPropagation()` to all action buttons and fixing the `workspacesByProject` memo are the recommended fixes.
