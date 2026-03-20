# UX Fixes Wave 3+4 Spec — 2026-03-20

Remaining open issues: #237, #241, #244, #245, #246, #247, #248, #249, #250, #251, #252, #253

---

## Wave 3 — Small/Medium Complexity (6 parallel tasks)

### Task A: #237 — User profile "Unknown" name
**File**: `apps/desktop/src/components/auth/UserBadge.tsx`, `apps/desktop/src/components/sessions/SessionSidebar.tsx`
**Fix**: `UserBadge` shows "Unknown" when `email` is undefined. The `auth.email` must be passed in from the parent. Trace from `useAuth()` → `AuthGate` → `SessionSidebar` → `UserBadge`. Make sure email is passed through. Fallback: show email address if name unavailable, not "Unknown".

### Task B: #245 — Dashboard "Phase 5" placeholder visible to users
**File**: `apps/desktop/src/components/workspaces/WorkspaceDashboardsView.tsx` (line 423)
**Fix**: Replace "Widget canvas rendering is coming in Phase 5." with proper empty/beta state: "Dashboard canvas preview — widget rendering is in early access." with a subtle badge or icon. No internal roadmap language.

### Task C: #246 — Emoji duplicated in agent profile icon field
**File**: `apps/desktop/src/components/agent-builder/tabs/GeneralTab.tsx` (around line 58-68)
**Fix**: The icon preview swatch (showing current emoji) and the text input both show the emoji side-by-side making it look doubled. Make the swatch a visually distinct preview box (e.g., `bg-muted rounded-md p-2 text-2xl`) clearly separated from the input field.

### Task D: #248 — Notes tab has no autosave indicator
**File**: `apps/desktop/src/components/workspaces/WorkspaceNotesTab.tsx` (or similar — find it under workspaces/)
**Fix**: Add debounced autosave (500ms) with a "Saved" / "Saving..." indicator. Show the indicator in the top-right of the notes area. Keep the existing "Preview" toggle if present.

### Task E: #252 — "Copy" button has no context label
**Files**: `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` (line 223), `apps/desktop/src/components/workspaces/ProjectSidebar.tsx` (line 353)
**Fix**: Change button label/tooltip from just "Copy" to "Copy branch name". After copy, briefly show "Copied!" (2 seconds) then revert. Use state for the flash.

### Task F: #253 — Search sessions: no empty state, no keyboard nav
**File**: `apps/desktop/src/components/sessions/SessionSidebar.tsx`
**Fix**:
- When `filteredSessions.length === 0` and search is non-empty, show: "No sessions match '{query}'"
- Add ⌘K/⌘F keyboard shortcut to focus search input (add `useEffect` with keydown listener)

---

## Wave 4 — Medium Complexity (4 parallel tasks)

### Task G: #241 — Nav icons have no visible labels
**File**: `apps/desktop/src/components/ActivityBar.tsx`
**Fix**: Add small text labels below each icon button ("Chat", "Projects", "Teams", "Agents"). Use `text-[10px]` or `text-xs` with `leading-none`. Keep current icon size. Active tab uses accent color for label too.

### Task H: #249 — Effort control inconsistent (button group vs dropdown)
**Files**: `apps/desktop/src/components/agent-builder/tabs/ModelTab.tsx`, `apps/desktop/src/components/settings/SettingsPanel.tsx`
**Fix**: Standardize on the button group pattern (Low/Medium/High/Max) in BOTH places. The settings panel currently uses a `<select>` dropdown — replace with the same button group component used in ModelTab. Add "Max" option to both.

### Task I: #250 — Automations canvas white rectangle artifact
**File**: `apps/desktop/src/components/agent-builder/HookCanvas.tsx`
**Fix**: Find and remove/fix the white rectangle. It's likely from React Flow's minimap or a container div with white background. Check for `bg-white` or inline `background: white` styles in the canvas container. The fix is likely a single `bg-transparent` or removing a misplaced element.

### Task J: #251 — Status bar "Connected" has no distinct states
**File**: `apps/desktop/src/components/StatusBar.tsx` (ConnectedSegment, around line 485-510)
**Fix**: The connected indicator currently shows "Connected" with a static green dot. Distinguish:
- Connected + active session: animated green pulse
- Connected + no active session: gray dot, no label (or dim "Idle")
- Disconnected: red dot + "Disconnected"
Add tooltip on hover explaining the state.

---

## Repomix Patterns

**Wave 3 frontend**:
`src/components/auth/UserBadge.tsx,src/components/sessions/SessionSidebar.tsx,src/components/workspaces/WorkspaceDashboardsView.tsx,src/components/agent-builder/tabs/GeneralTab.tsx,src/components/workspaces/WorkspacePanel.tsx,src/components/workspaces/ProjectSidebar.tsx`

**Wave 3 workspaces notes**: find the notes tab file

**Wave 4**:
`src/components/ActivityBar.tsx,src/components/agent-builder/tabs/ModelTab.tsx,src/components/settings/SettingsPanel.tsx,src/components/agent-builder/HookCanvas.tsx,src/components/StatusBar.tsx`
