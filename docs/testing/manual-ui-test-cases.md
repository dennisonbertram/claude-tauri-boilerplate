# Manual UI Test Cases — Multi-Workspace Feature

**Date:** 2026-03-15
**Tester:** Claude Sonnet 4.6
**App version:** post `be31ced` (multi-workspace worktree feature)
**Servers:** Backend `http://localhost:3131` · Frontend `http://localhost:1420`

---

## Test Categories

1. [Initial Load & Layout](#1-initial-load--layout)
2. [Session Sidebar (Legacy)](#2-session-sidebar-legacy)
3. [Project Management](#3-project-management)
4. [Workspace Creation](#4-workspace-creation)
5. [Workspace Navigation & Switching](#5-workspace-navigation--switching)
6. [Chat in Workspace Context](#6-chat-in-workspace-context)
7. [Workspace Status Badges](#7-workspace-status-badges)
8. [Diff View](#8-diff-view)
9. [Merge / Discard Flows](#9-merge--discard-flows)
10. [Error States & Edge Cases](#10-error-states--edge-cases)
11. [Visual & UX Quality](#11-visual--ux-quality)

---

## 1. Initial Load & Layout

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| L-01 | App loads at http://localhost:1420 | No blank screen, no console errors | |
| L-02 | Dark theme applied correctly | Dark background, no white flash | |
| L-03 | Sidebar renders with "Projects" section visible | Projects panel visible in sidebar | |
| L-04 | "Sessions" section still visible below projects | Legacy sessions still accessible | |
| L-05 | Layout is not broken / overflowing | All panels within viewport, no scroll bleed | |
| L-06 | Font rendering is crisp | No blurry text | |

## 2. Session Sidebar (Legacy)

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| S-01 | Legacy "New Chat" button is present | Button renders, is clickable | |
| S-02 | Clicking "New Chat" opens a chat panel | Chat input visible, ready to type | |
| S-03 | Sending a message in a legacy session works | Response streams back | |
| S-04 | Previous sessions are listed | Sessions appear in list | |
| S-05 | Clicking a session loads its messages | Messages render correctly | |

## 3. Project Management

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| P-01 | "Add Project" button is visible and styled correctly | Clear CTA, correct icon/label | |
| P-02 | Clicking "Add Project" opens dialog | Modal/dialog appears with overlay | |
| P-03 | Dialog has a path input and a folder picker | Both controls visible and labeled | |
| P-04 | Submitting an invalid path shows error | Inline error message, form not submitted | |
| P-05 | Adding a valid git repo registers it | Project appears in sidebar | |
| P-06 | Project shows repo name and path | Name and truncated path visible | |
| P-07 | Clicking a project expands its workspaces | Workspace list reveals | |
| P-08 | Deleting a project shows confirmation | Confirm dialog before delete | |
| P-09 | After delete, project removed from sidebar | No stale entry | |

## 4. Workspace Creation

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| W-01 | "New Workspace" button visible within project | Button near project header | |
| W-02 | Clicking "New Workspace" opens dialog | Dialog with name and branch fields | |
| W-03 | Name field has placeholder/hint text | Clear guidance on naming | |
| W-04 | Submitting empty name shows validation error | Field highlighted, message shown | |
| W-05 | Creating workspace shows "creating" status badge | Badge updates in real-time | |
| W-06 | Workspace transitions to "ready" state | Badge changes from creating → ready | |
| W-07 | Error creating workspace shows error state | Error badge and message visible | |

## 5. Workspace Navigation & Switching

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| N-01 | Clicking a workspace in sidebar loads its panel | Right panel shows workspace chat | |
| N-02 | Workspace name shown in panel header | Header identifies current workspace | |
| N-03 | Switching between workspaces clears chat | No messages bleed between workspaces | |
| N-04 | Switching back to workspace restores its history | Previous messages reload | |
| N-05 | Active workspace is highlighted in sidebar | Visual indicator of current selection | |

## 6. Chat in Workspace Context

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| C-01 | Chat input is present in workspace panel | Input field and send button visible | |
| C-02 | Typing a message and submitting works | Message appears in chat | |
| C-03 | Claude response streams in | Text appears progressively | |
| C-04 | Tool use events render (file ops, bash, etc.) | Tool cards/indicators show | |
| C-05 | "What directory are you in?" returns worktree path | Claude reports the correct worktree cwd | |
| C-06 | Claude can list files in the worktree | ls output reflects worktree contents | |
| C-07 | Session persists on page refresh | Messages still there after reload | |

## 7. Workspace Status Badges

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| B-01 | "ready" badge is green/calm color | Appropriate color coding | |
| B-02 | "error" badge is red | Clear error indicator | |
| B-03 | "creating" badge shows activity indicator | Spinner or pulse animation | |
| B-04 | "merged" badge is muted/gray | Completed state visually distinct | |
| B-05 | Badge text is readable | Font size appropriate, not truncated | |

## 8. Diff View

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| D-01 | "View Diff" / diff button visible in workspace panel | Accessible in UI | |
| D-02 | Clicking diff opens WorkspaceDiffView | Diff panel or modal appears | |
| D-03 | Changed files list renders | File paths with status indicators | |
| D-04 | Diff content shows added/removed lines | Green/red line highlights | |
| D-05 | Empty diff (no changes) shows message | "No changes" placeholder | |
| D-06 | File status icons match status (modified/added/deleted) | Correct iconography | |

## 9. Merge / Discard Flows

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| M-01 | "Merge" button visible when workspace is ready | Merge action accessible | |
| M-02 | Clicking "Merge" opens confirmation dialog | WorkspaceMergeDialog shows | |
| M-03 | Merge dialog shows target branch | User knows where it's merging | |
| M-04 | Confirming merge triggers status update | Status changes to "merging" then "merged" | |
| M-05 | "Discard" button visible | Destructive action accessible but not prominent | |
| M-06 | Clicking "Discard" shows warning dialog | Warns about data loss | |
| M-07 | Confirming discard triggers status update | Status changes to "discarding" then "archived" | |

## 10. Error States & Edge Cases

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| E-01 | No projects yet → empty state shown | Helpful "Add your first project" message | |
| E-02 | Project with no workspaces → empty state | "Create a workspace" prompt | |
| E-03 | Backend unreachable → graceful error | Not a blank screen; error message shown | |
| E-04 | Chat error (rate limit / auth) → error message | Inline error with context | |

## 11. Visual & UX Quality

| ID | Test Case | Expected | Result |
|----|-----------|----------|--------|
| UX-01 | Sidebar is not too wide / not too narrow | Good proportion to chat area | |
| UX-02 | Dialogs have proper overlay and dismiss on Escape | Standard modal behavior | |
| UX-03 | Buttons have hover states | Cursor feedback on hover | |
| UX-04 | Loading states have spinners | User knows something is happening | |
| UX-05 | Typography hierarchy is clear | Headers, labels, body text distinct | |
| UX-06 | Spacing is consistent | No random padding gaps | |
| UX-07 | Icons are recognizable and correctly sized | Not stretched, not pixelated | |
| UX-08 | Scroll works in long chat sessions | Messages scrollable, input pinned at bottom | |
| UX-09 | No console errors in normal flows | Zero red errors in browser DevTools | |
| UX-10 | App is usable at 1280×800 viewport | Nothing cut off at standard laptop res | |

---

## Test Run Log

> Results documented below as testing progresses.

