# Plan: UX Improvements — Phase 2 Medium Effort

**Date:** 2026-03-19
**Source:** docs/investigations/ux-improvement-recommendations.md
**Status:** In Progress
**Depends on:** Phase 1 complete ✅

## Items (ordered by effort, easiest first)

### Task 1: Session/Workspace Clarity (#7)
**Effort:** Low-Medium
**Files:** `SessionSidebar.tsx`, `ProjectSidebar.tsx`, view toggle areas, `WorkspacePanel.tsx`

Changes:
1. Add info tooltip next to the view toggle tabs explaining the distinction:
   - Chat tab: "Standalone conversations — quick questions and one-off tasks"
   - Workspaces tab: "Git worktree environments with isolated branches and persistent chat"
   - Teams tab: "Multi-agent PR workflows"
   Implement as a small `(?)` icon with hover popover, or use the `title` attribute on the tab buttons for simplicity
2. In `WorkspacePanel.tsx`, make the workspace name + branch in the header more prominent when in workspace chat context (verify it's visible, tweak styling if not)
3. Consider adding a small contextual label "Workspace Chat" vs "Session" in the ChatPage header depending on context

### Task 2: Feature Discovery — Command Palette Hints (#3)
**Effort:** Low-Medium
**Files:** `apps/desktop/src/components/chat/ChatInput.tsx`, `apps/desktop/src/contexts/SettingsContext.tsx`

Changes:
1. Add a small `/` icon button to the left of the chat input (or right side near send button) that opens the command palette on click. This makes the feature visible beyond just placeholder text.
2. Add a "first send" tip: after the first successful chat message, show a dismissible banner: "Pro tip: Type / for commands like /review, /compact, and /pr". Store dismissal in settings as `hasDismissedCommandTip: boolean`.
3. Add `hasDismissedCommandTip` to AppSettings interface in SettingsContext.

### Task 3: Settings Reorganization (#2)
**Effort:** Medium
**Files:** `apps/desktop/src/components/settings/SettingsPanel.tsx`

Changes:
Collapse the current flat list of 13 tabs into 5 grouped sections. Implement as a left sidebar nav within the settings panel (similar to VS Code settings) rather than top tabs.

**New structure:**
- **General** → (current: General, Appearance, Notifications)
- **AI & Model** → (current: Model, Advanced, Workflows)
- **Data & Context** → (current: Instructions, Memory, MCP, Hooks)
- **Integrations** → (current: Git, Linear)
- **Status** → (current: Status)

**Implementation approach:**
- Left sidebar: list of 5 group names, clicking selects active group
- Right panel: renders the combined content of all tabs in that group, stacked vertically with section headers
- The `TabId` type becomes the 5 group IDs
- Individual setting sections become `<section>` blocks within the right panel
- Deep links (e.g., `onOpenSettings('advanced')`) must still work — map old tab IDs to new group IDs

**Testing:**
- Update `SettingsTabsOverflow.test.tsx` (now tests 5 groups, not 13 tabs)
- Verify `onOpenSettings(tab)` still navigates to the right group

## Acceptance Criteria
- [ ] View tabs have tooltips explaining Chat vs Workspaces vs Teams
- [ ] `/` button visible near chat input, opens command palette on click
- [ ] "Pro tip" banner shows after first message (dismissible, stored in settings)
- [ ] Settings panel shows 5 left-nav groups instead of 13 flat tabs
- [ ] Deep links to settings tabs still work (e.g., from status bar clicking opens correct group)
- [ ] TypeScript clean
- [ ] No regressions in existing tests
