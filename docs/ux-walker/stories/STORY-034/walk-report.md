# STORY-034: Merge Workspace Back to Base Branch

## Goal
Merge workspace changes back to base branch

## Status: FAIL

## Summary
The "Merge" button is present in the workspace header, but clicking it navigates away from the workspace view to the chat/conversations view instead of opening a merge confirmation dialog or initiating a merge flow.

## Steps Performed
1. Opened workspace "Investigation" from sidebar.
2. Confirmed "Merge" button visible in workspace header bar (alongside "Open In" and "Discard").
3. Clicked "Merge" button.
4. App immediately navigated away from workspace to chat/conversations view.
5. No merge dialog, confirmation, or progress indicator appeared.

## Observations
- The Merge button exists and is clickable.
- The click handler appears to trigger navigation rather than a merge action.
- This is the same pattern seen with other workspace buttons (project card clicks, New Project clicks).
- The button may be wired to an incorrect route or the click event is propagating to a parent element that handles navigation.

## Screenshots
- `01-merge-button-visible.png` -- Workspace header showing Merge button
- `02-merge-navigated-away.png` -- Chat view after clicking Merge (navigated away)

## Errors
None observed.
