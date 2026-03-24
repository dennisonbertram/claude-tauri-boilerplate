# STORY-035: Discard Workspace (Destructive)

## Goal
Delete/discard a workspace and verify confirmation dialog

## Status: PARTIAL PASS

## Summary
The "Discard" button is present and visible in the workspace header. Per instructions, the button was NOT clicked (destructive action). The UI exists and is properly labeled. Based on the pattern observed with the Merge button (F-034-001), it is likely that clicking Discard may also navigate away rather than showing a confirmation dialog.

## Steps Performed
1. Opened workspace "Investigation" from sidebar.
2. Confirmed "Discard" button visible in workspace header bar (ref=e16).
3. Did NOT click the button (per instructions: "DON'T actually delete -- just verify the UI exists").

## Observations
- The Discard button exists and is visually distinct in the workspace header.
- It appears alongside "Open In" and "Merge" buttons.
- Cannot confirm whether a confirmation dialog would appear without clicking.
- Given the navigation bug affecting the Merge button (F-034-001), the Discard button may have the same issue.

## Screenshots
- `01-discard-button-visible.png` -- Workspace header showing Discard button

## Errors
None observed.
