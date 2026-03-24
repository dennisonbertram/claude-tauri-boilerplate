# STORY-086: View Linear Issue Deep Link

## Walk Date: 2026-03-23

## Steps Performed
1. Checked LinearIssueBar for deep link capability
2. Searched for Linear URL generation in codebase

## Observations
- LinearIssueBar shows issue ID as a clickable button with `onClick={onOpenPicker}`
- This opens the picker rather than navigating to Linear
- No explicit deep link (e.g., `https://linear.app/...`) opening in browser found in LinearIssueBar
- The issue ID is displayed as clickable text but navigates to the picker, not to Linear directly
- Deep link to Linear.app may be handled in the picker itself or not yet implemented

## Result: PARTIAL
The issue ID is clickable in the chat bar, but it reopens the picker rather than deep-linking to Linear.app. A direct deep link to the Linear issue page is not visible.

## Code References
- `/apps/desktop/src/components/chat/LinearIssueBar.tsx` (line 14-17)
