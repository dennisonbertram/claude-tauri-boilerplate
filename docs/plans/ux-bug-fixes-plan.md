# UX Bug Fixes Implementation Plan

## Issues: #344, #348, #354, #350

---

## Issue #348 (CRITICAL): Permission Mode Button Crashes App

### Root Cause Analysis
The `PermissionModeSegment` component (`apps/desktop/src/components/status-bar/PermissionModeSegment.tsx`) code looks structurally correct — the dropdown opens via `setOpen()`, mode selection calls `updateSettings({ permissionMode: mode.value })`, and it closes. All tests pass.

However, the existing tests only verify:
1. Label displays correctly
2. Settings panel changes propagate
3. Clicking the segment div doesn't call onShowSettings

**Missing test coverage:** No test clicks the dropdown button, opens the dropdown, and then clicks a mode option. The crash likely occurs when the dropdown renders in the actual app context due to:
- A z-index/portal issue where the dropdown renders but clicks don't reach the intended button
- An event propagation issue where the outside-click handler fires during option selection
- A timing issue where `updateSettings` and `setOpen(false)` on line 92-93 cause a re-render that unmounts mid-event

### Fix Strategy
1. Add a test that reproduces the full dropdown flow (open → select option → verify)
2. Investigate the actual crash in the browser
3. Fix: likely need to wrap the dropdown in a React Portal, or fix event propagation with `stopPropagation()`, or defer `setOpen(false)` with `requestAnimationFrame`/`flushSync`

### Files to Change
- `apps/desktop/src/components/status-bar/PermissionModeSegment.tsx` — Fix crash
- `apps/desktop/src/components/__tests__/StatusBar.test.tsx` — Add dropdown interaction test

### Regression Tests
- Open dropdown → select each permission mode → verify no crash, label updates
- Click outside dropdown → verify it closes
- Press Escape → verify it closes
- Verify permission mode persists across component remount

---

## Issue #344 (MEDIUM): App Lacks URL-Based Routing

### Current State
- **No router** — entire app uses `activeView` useState in `AppLayout` (App.tsx line 42)
- Views: `chat`, `teams`, `workspaces`, `agents`, `documents`, `tracker`
- Sub-states: `activeSessionId` for chat, `selectedWorkspace` for workspaces
- Settings is an overlay (not a view) — stays on top of any view
- Navigation: `AppSidebar` calls `onSelectView()`, `ViewSwitcherHeader` has quick-switch tabs

### Architecture: HashRouter with Layout Route

```
<HashRouter>
  <SettingsProvider>
    <AuthGate>
      <Routes>
        <Route element={<AppLayout />}>          {/* persistent — never unmounts */}
          <Route path="/" element={<Navigate to="/chat" />} />
          <Route path="/chat" element={<ChatOutlet />} />
          <Route path="/chat/:sessionId" element={<ChatOutlet />} />
          <Route path="/projects" element={<ProjectsOutlet />} />
          <Route path="/projects/:projectId" element={<ProjectsOutlet />} />
          <Route path="/teams" element={<TeamsOutlet />} />
          <Route path="/teams/:teamId" element={<TeamsOutlet />} />
          <Route path="/profiles" element={<AgentBuilderView />} />
          <Route path="/profiles/:profileId" element={<AgentBuilderView />} />
          <Route path="/search" element={<SearchOutlet />} />
          <Route path="/documents" element={<DocumentsView />} />
          <Route path="/tracker" element={<TrackerView />} />
          <Route path="*" element={<Navigate to="/chat" />} />
        </Route>
      </Routes>
    </AuthGate>
  </SettingsProvider>
</HashRouter>
```

### Key Design Decisions
1. **HashRouter, not BrowserRouter** — Works in both Vite dev and Tauri bundled (no server fallback needed)
2. **Layout Route pattern** — AppLayout wraps all routes via `<Outlet />`, never unmounts, preserves all state
3. **Settings stays as overlay** — Not a route, keeps `settingsOpen` state as-is
4. **`activeView` derived from pathname** — Delete the useState, derive from `useLocation().pathname`
5. **Session ID in URL** — `/chat/:sessionId` synced via `useParams()`
6. **Workspace in URL** — `/projects/:projectId` replaces `selectedProjectId` state

### Implementation Steps
1. `pnpm add react-router-dom` in apps/desktop
2. Refactor `App.tsx`:
   - Wrap app in `<HashRouter>`
   - Convert `AppLayout` to use `<Outlet />` for content area
   - Replace `activeView` state with route-derived value
   - Replace `setActiveView(x)` calls with `navigate('/x')`
   - Sync `activeSessionId` to URL params
3. Refactor `AppSidebar.tsx` — `onSelectView` → `navigate()`
4. Refactor `ViewSwitcherHeader.tsx` — `onSwitchView` → `navigate()`
5. Update keyboard shortcuts to use `navigate()`

### State Preservation Strategy
- AppLayout stays mounted (layout route) — no state loss
- `activeSessionId` synced to `/chat/:sessionId` URL
- `selectedWorkspace` synced to `/projects/:projectId` URL
- `pendingMessage` stays as transient component state (not in URL)
- `openSessionIds` (tab bar) stays as component state
- `settingsOpen` stays as component state

### Files to Change
| File | Change | Complexity |
|------|--------|------------|
| `apps/desktop/package.json` | Add `react-router-dom` | Trivial |
| `apps/desktop/src/App.tsx` | Major refactor — HashRouter, Outlet, route sync | High |
| `apps/desktop/src/components/AppSidebar.tsx` | Replace `onSelectView` with `navigate` | Low |
| `apps/desktop/src/app/ViewSwitcherHeader.tsx` | Replace `onSwitchView` with `navigate` | Low |
| `apps/desktop/src/app/useAppKeyboardShortcuts.ts` | Add `useNavigate()` | Low |

### Regression Tests
- Navigate between all views → verify URL hash updates
- Deep link (paste URL with hash) → verify correct view renders
- Browser back/forward → verify navigation history
- Page refresh → verify state recovery
- Settings overlay opens/closes without URL change
- Chat session switching updates URL
- New chat flow works (pending message → session creation → URL update)

---

## Issue #354 (HIGH): Workspace Rename UI Unreachable

### Current State
- `ProjectSidebar.tsx` has complete rename UI but is **never imported/rendered**
- `ProjectsSection.tsx` (actual sidebar) has no rename capability
- `WorkspacePanelHeader.tsx` shows workspace name as static `<h2>`
- Backend fully working: `PATCH /api/workspaces/:id`, `useWorkspaces().renameWorkspace`

### Fix Strategy: Add Rename to WorkspacePanelHeader
Add click-to-edit on the workspace name in the detail header. This is the most natural place — user sees the name and can click to edit it.

### Implementation Steps
1. **WorkspacePanelHeader.tsx**:
   - Add `onRename?: (id: string, updates: { name?: string; branch?: string }) => void` prop
   - Make workspace name an editable field (click → input, Enter/Escape to confirm/cancel)
   - Add pencil icon on hover as visual affordance
2. **WorkspacePanel.tsx**: Pass `onRenameWorkspace` prop to header
3. **App.tsx**: Wire `useWorkspaces().renameWorkspace` through to WorkspacePanel

### Files to Change
| File | Change |
|------|--------|
| `apps/desktop/src/components/workspaces/WorkspacePanelHeader.tsx` | Add inline rename |
| `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` | Pass rename handler |
| `apps/desktop/src/App.tsx` | Wire renameWorkspace callback |

### Regression Tests
- Click workspace name → input appears with current name
- Type new name + Enter → name updates, API called
- Press Escape → edit cancelled, original name restored
- Empty name → rejected (no API call)
- Rename persists after navigation away and back

---

## Issue #350 (MEDIUM): Can't Add Agents to Existing Team

### Current State
- Backend has `POST /api/teams/:id/agents` and `DELETE /api/teams/:id/agents/:name`
- `useTeams` hook missing `addAgent()` and `removeAgent()` wrappers
- `TeamWorkspace` shows agents read-only with no add button
- `TeamCreationDialog` has agent form but tightly coupled to creation

### Implementation Steps
1. **useTeams.ts**: Add `addAgent(teamId, agent)` and `removeAgent(teamId, agentName)` functions
2. **AddAgentDialog.tsx** (new): Simple dialog with agent form (name, description, model, permission mode)
3. **TeamWorkspace.tsx**: Add "Add Agent" button + render AddAgentDialog
4. **TeamsView.tsx**: Pass addAgent/removeAgent through to TeamWorkspace

### Files to Change
| File | Change |
|------|--------|
| `apps/desktop/src/hooks/useTeams.ts` | Add addAgent, removeAgent functions |
| `apps/desktop/src/components/teams/AddAgentDialog.tsx` | **NEW** — agent addition dialog |
| `apps/desktop/src/components/teams/TeamWorkspace.tsx` | Add "Add Agent" button + dialog |
| `apps/desktop/src/components/teams/TeamsView.tsx` | Pass new functions as props |

### Regression Tests
- Open team detail → "Add Agent" button visible
- Click "Add Agent" → dialog opens with form fields
- Fill form + submit → agent appears in team
- Add agent with duplicate name → error shown
- Remove agent from team → agent removed from list

---

## Implementation Order

1. **#348 (Permission crash)** — CRITICAL, smallest scope, unblocks testing of other features
2. **#354 (Workspace rename)** — HIGH, isolated change, no dependencies
3. **#350 (Team agents)** — MEDIUM, isolated change, no dependencies
4. **#344 (Routing)** — MEDIUM, largest scope, touches many files, do last

Issues #354 and #350 can be done in parallel (different component trees).

## Commit Strategy
Each fix gets its own commit:
```
fix(ux): #348 — fix permission mode dropdown crash
fix(ux): #354 — add workspace rename to panel header
fix(ux): #350 — add agent management to team detail view
feat(ux): #344 — add URL-based routing with HashRouter
```
