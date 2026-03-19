# Plan: UX Improvements — Phase 1 Quick Wins

**Date:** 2026-03-19
**Source:** docs/investigations/ux-improvement-recommendations.md
**Status:** In Progress
**Phases:** Phase 1 (this plan) → Phase 2 → Phase 3 (Activity Bar)

## Background

Full UX analysis identified 10 improvements. This plan covers Phase 1 quick wins (lowest effort, independent changes), ordered by effort:

1. #10 Sidebar Layout Optimization
2. #8 Chat Message Differentiation
3. #9 Dialog Improvements
4. #5 Status Bar Simplification
5. #6 Enhanced Empty States (all views)
6. #3 Feature Discovery System (partial)

## Wave 1A — Fully Independent Files (parallel)

### Task A: Status Bar Simplification (#5)
**File:** `apps/desktop/src/components/StatusBar.tsx`
**Changes:**
- Hide `PermissionModeSegment` when permission mode is the default ("normal"/"default") — only show when user has changed it
- Hide `GitBranchSegment` when there is no active session or workspace (i.e. on welcome screen)
- Combine CPU + Memory in `ResourceUsageSegment` into one collapsed display — show "CPU 12% / 340MB" as single item; individual values on hover via `title` tooltip
- Truncate model name more aggressively if sidebar is open (already has max-w-[120px], just verify it's correct)
- The `PrivacyModeIndicator` should only show when privacy mode is ON (it's probably already conditional — verify)
**Goal:** Reduce default visible items from ~11 to ~6-7. Active streaming state still shows all relevant info.

### Task B: Dialog Improvements (#9)
**Files:** `apps/desktop/src/components/workspaces/CreateWorkspaceDialog.tsx`, `apps/desktop/src/components/workspaces/WorkspaceMergeDialog.tsx`
**Changes:**
- `CreateWorkspaceDialog.tsx`: Add icon to each mode tab — Manual: use a tool/wrench icon (lucide `Wrench`), Branch: `GitBranch`, GitHub Issue: `Github`
- `CreateWorkspaceDialog.tsx`: Replace plain text loading states (branchLoading, issueLoading) with proper skeleton/spinner
- `WorkspaceMergeDialog.tsx`: Add a clearly bordered confirmation summary box before the merge button showing what will happen. Add a warning icon for the discard action.
- Keep all existing functionality intact — only add visual improvements

### Task C: Chat Message Differentiation (#8)
**Files:** Message rendering components in `apps/desktop/src/components/chat/`
- Read the actual message rendering code first to find the right files
- Add subtle `bg-muted/20` or similar background to user messages to distinguish from assistant messages
- Keep developer-tool aesthetic — no chat bubbles. Subtle tint only.
- Optionally add a small role indicator (user icon vs claude icon) in the message header
- Ensure changes work in both light and dark themes (use CSS variables)

## Wave 1B — Sidebar Consolidation (parallel within sidebar files)

### Task D: Sidebar Layout + Session Empty State (#10 + partial #6)
**File:** `apps/desktop/src/components/sessions/SessionSidebar.tsx`
**Changes for #10:**
- Move `UserBadge` and settings gear button from the top header section to the bottom of the sidebar
- Add a bottom footer `div` with `border-t`, padding, that contains `UserBadge` and settings gear
- Remove them from the top header section (lines ~86-110)
- The view toggle tabs (Chat/Workspaces/Teams) stay at the top

**Changes for #6 (empty state):**
- Find the "No conversations yet" empty state (around line 141)
- Replace with: a small icon (`MessageSquare` from lucide), brief text "No conversations yet", and a [New Chat] button that calls the existing `onNewChat` prop

### Task E: ProjectSidebar + TeamsView + App Empty States (partial #6)
**Files:**
- `apps/desktop/src/components/workspaces/ProjectSidebar.tsx`
- `apps/desktop/src/components/teams/TeamsView.tsx`
- `apps/desktop/src/App.tsx` (workspace main area empty state only)

**Changes:**
- `ProjectSidebar.tsx` "No projects yet" empty state → add `FolderOpen` icon + "Add a project to start using git worktrees" + [Add Project] button that calls existing handler
- `ProjectSidebar.tsx` "No workspaces" per-project empty state → add brief text "No workspaces for this project" + [+] button
- `TeamsView.tsx` "No teams yet" → move the "New Team" button INTO the empty state as the primary CTA
- `App.tsx` workspace main area "Select a workspace..." → add [Add Project] button inline with the text

## Acceptance Criteria

- [ ] All tests pass (`pnpm test` or `cd apps/server && bun test`)
- [ ] Frontend starts without console errors (`pnpm dev:all`)
- [ ] Status bar shows fewer items by default
- [ ] Dialog mode tabs have icons
- [ ] User/assistant messages visually distinct (subtle)
- [ ] UserBadge at bottom of SessionSidebar
- [ ] All empty states have actionable CTAs
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] Dark theme still works correctly

## Files Changed

Wave 1A:
- `apps/desktop/src/components/StatusBar.tsx`
- `apps/desktop/src/components/workspaces/CreateWorkspaceDialog.tsx`
- `apps/desktop/src/components/workspaces/WorkspaceMergeDialog.tsx`
- `apps/desktop/src/components/chat/*.tsx` (message rendering)

Wave 1B:
- `apps/desktop/src/components/sessions/SessionSidebar.tsx`
- `apps/desktop/src/components/workspaces/ProjectSidebar.tsx`
- `apps/desktop/src/components/teams/TeamsView.tsx`
- `apps/desktop/src/App.tsx` (limited scope — empty state only)
