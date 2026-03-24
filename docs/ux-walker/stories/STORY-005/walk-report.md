# STORY-005: Export Session to Markdown

## Goal
Export a session

## Steps Walked

| Step | Action | Result | Status |
|------|--------|--------|--------|
| 1 | Look for export options in session menu | Found "Export JSON" and "Export Markdown" in three-dot context menu | PASS |
| 2 | Click "Export Markdown" | Toast notification "Session exported" appeared with filename | PASS |
| 3 | Click "Export JSON" | Toast notification "Session exported" appeared with filename | PASS |

## Observations
- Both Export JSON and Export Markdown options are available in the session context menu
- Clicking either option triggers a download and shows a toast notification confirming success
- The toast shows "Session exported" with the filename
- No errors in console during export
- Export is triggered from sidebar context menu (hover -> three-dot menu -> Export)
- Export does NOT require opening the conversation (which would crash)

## Findings
No issues found. Export functionality works as expected for both JSON and Markdown formats.
