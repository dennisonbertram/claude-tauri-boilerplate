# STORY-003: Rename Session After Conversation

## Goal
Rename a session via context menu

## Steps Walked

| Step | Action | Result | Status |
|------|--------|--------|--------|
| 1 | Hover over a session in the sidebar | Three-dot menu icon appeared next to "Crispy Meadow" on hover | PASS |
| 2 | Look for three-dot menu | Found unlabeled button with SVG icon (three vertical dots) appearing on hover | PASS |
| 3 | Click Rename in context menu | Context menu showed: Rename, Fork, Export JSON, Export Markdown, Delete | PASS |
| 4 | Verify rename input appears | Session title replaced by editable textbox pre-filled with "Crispy Meadow" | PASS |
| 5 | Press Escape to cancel | Rename cancelled, title reverted to "Crispy Meadow" button | PASS |

## Observations
- Three-dot menu only appears on hover (not always visible)
- Right-click does NOT trigger a context menu (native browser right-click only)
- Double-clicking a session crashes the app with ErrorBoundary (known issue)
- The rename input supports Enter to confirm and Escape to cancel
- The context menu also contains Fork, Export JSON, Export Markdown, and Delete options

## Findings
- F-003-001: Double-clicking a session in sidebar crashes the app with React ErrorBoundary. This is the known conversation-opening crash. Severity: CRITICAL (BLOCKER)
- F-003-002: No right-click context menu on session items. Only the three-dot menu on hover provides access to Rename/Fork/Export/Delete. Severity: LOW (three-dot menu works, right-click is a nice-to-have)
