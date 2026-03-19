# Plan: Activity Bar Navigation (Phase 3)

**Date:** 2026-03-19
**Source:** docs/investigations/ux-improvement-recommendations.md
**Status:** In Progress

## Problem

View toggle tabs are copy-pasted across 3 locations:
1. `SessionSidebar.tsx` (lines ~51-84) — Chat/Workspaces/Teams/Agents tabs
2. `ProjectSidebar.tsx` (lines ~146-177) — same 4 tabs
3. `App.tsx` (lines ~331-373) — inline tabs rendered when activeView is teams/agents

This means updating navigation requires touching 3 files. Users also lose spatial orientation when the sidebar swaps completely between views.

## Solution

Add a persistent `ActivityBar.tsx` (48px wide) as the leftmost element in the layout. It contains the 4 view icons + settings gear + user avatar. The sidebars lose their tab headers entirely.

## Target Layout

```
┌──────────────────────────────────────────────────┐
│┌──┐┌────────────────┐┌────────────────────────┐ │
││  ││                ││                        │ │
││💬 ││  Sidebar Panel ││     Main Content       │ │
││📁 ││  (changes by   ││                        │ │
││👥 ││   activity)    ││                        │ │
││🤖 ││                ││                        │ │
││  ││                ││                        │ │
││  ││                ││                        │ │
││⚙️ ││                ││                        │ │
││👤 ││                ││                        │ │
││  ││                ││                        │ │
││48 ││     280px      ││       flex-1           │ │
│└──┘└────────────────┘└────────────────────────┘ │
│[StatusBar                                       ]│
└──────────────────────────────────────────────────┘
```

## Wave Plan

### Wave 1: Create ActivityBar + App.tsx layout (single agent)
Files:
- NEW: `apps/desktop/src/components/ActivityBar.tsx`
- MODIFY: `apps/desktop/src/App.tsx`

### Wave 2: Clean up sidebars (parallel, different files)
Files:
- MODIFY: `apps/desktop/src/components/sessions/SessionSidebar.tsx`
- MODIFY: `apps/desktop/src/components/workspaces/ProjectSidebar.tsx`

## ActivityBar.tsx Component Spec

```typescript
interface ActivityBarProps {
  activeView: 'chat' | 'workspaces' | 'teams' | 'agents';
  onSelectView: (view: 'chat' | 'workspaces' | 'teams' | 'agents') => void;
  onOpenSettings: () => void;
  email?: string;
  plan?: string;
}
```

Layout (top to bottom):
- Top section (flex-1): 4 view icon buttons
  - Chat: `MessageSquare` icon, data-testid="view-tab-chat"
  - Workspaces: `FolderOpen` icon, data-testid="view-tab-workspaces"
  - Teams: `Users` icon, data-testid="view-tab-teams"
  - Agents: `Bot` icon, data-testid="view-tab-agents"
- Bottom section: Settings gear + compact UserBadge (initial/avatar only)

Active state: left-side 2px colored border OR `bg-accent` background on the button.
Width: 48px (`w-12`)
Style: `flex flex-col border-r bg-sidebar h-full`

## App.tsx Changes

1. Import `ActivityBar`
2. Add `<ActivityBar>` as the FIRST element in the flex row (before the sidebar)
3. Pass `activeView`, `handleSwitchView` as `onSelectView`, `onOpenSettings`, `email`, `plan`
4. Remove the inline view tabs div (lines ~331-373) that renders when activeView is teams/agents
5. Remove `onSwitchView` prop from `SessionSidebar` and `ProjectSidebar` (they no longer need it)
6. Remove `activeView` prop from `SessionSidebar` and `ProjectSidebar` (no longer needed for tabs)

## SessionSidebar.tsx Changes

1. Remove `activeView` and `onSwitchView` from props interface
2. Remove the view toggle tabs div
3. The bottom footer (UserBadge + settings gear) was added in Phase 1 — REMOVE the settings gear from the footer (it moves to ActivityBar). Keep UserBadge in the footer OR remove it entirely if ActivityBar handles it.
4. Remove any imports only used by the tabs

## ProjectSidebar.tsx Changes

1. Remove `activeView` and `onSwitchView` from props interface
2. Remove the view toggle tabs div
3. Remove any imports only used by the tabs

## Acceptance Criteria

- [ ] ActivityBar.tsx exists with 4 view icons + settings + user avatar
- [ ] ActivityBar is leftmost element in layout (before sidebar)
- [ ] Clicking each icon switches the view correctly
- [ ] Active view is visually highlighted in ActivityBar
- [ ] No duplicate view tabs in sidebars
- [ ] No duplicate view tabs inline in App.tsx
- [ ] data-testid attributes preserved (view-tab-chat, view-tab-workspaces, etc.)
- [ ] Settings opens from ActivityBar gear icon
- [ ] TypeScript clean
- [ ] No regressions
