# STORY-011: Recover Recently Deleted Session

## Goal
Verify undo/recovery for deleted sessions.

## Steps Taken
1. Loaded app at http://localhost:1927 -- sidebar with sessions visible
2. Hovered over "Crispy Meadow" session -- three-dot menu button appeared on hover
3. Clicked menu button -- context menu opened with: Rename, Fork, Export JSON, Export Markdown, Delete
4. Clicked Delete -- app crashed ("Something went wrong") before delete confirmation could appear
5. Recovered via navigation to http://localhost:1927
6. Verified "Crispy Meadow" still present (delete did not execute due to crash)
7. Inspected source code for undo/trash features

## Findings

### Delete Flow (from source code analysis)
- Delete has a **two-step inline confirmation**: clicking Delete shows "Delete 'session name'?" with Confirm/Cancel buttons
- After confirmation, deletion is **permanent** -- no undo toast, no "Recently Deleted" section, no trash
- No soft-delete mechanism exists in the codebase

### Gaps Identified
1. **No undo mechanism** after session deletion -- once confirmed, data is permanently lost
2. **No "Recently Deleted" or trash** section for recovery
3. **Context menu interaction crashes the app** intermittently (related to known conversation-open crash)

## Severity
- **Missing Feature (Medium)**: No undo/recovery for deleted sessions
- **Bug (High)**: Context menu interaction can crash the app

## Screenshots
- `01-initial-state.png` -- Session list with sidebar
- `02-hover-shows-menu.png` -- Three-dot menu visible on hover
- `03-context-menu-with-delete.png` -- Context menu showing Rename, Fork, Export, Delete
- `05-crash-on-menu-click.png` -- "Something went wrong" error after menu interaction
