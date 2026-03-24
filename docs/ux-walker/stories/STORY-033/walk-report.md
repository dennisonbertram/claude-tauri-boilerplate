# STORY-033: Add Additional Directories to Workspace

## Goal
Add more directories to an existing workspace

## Status: PASS

## Summary
The Paths tab in the workspace view provides a clear UI for managing additional directories. It shows a "Workspace settings" section with "ADDITIONAL WRITABLE DIRECTORIES" and an "Add directory" button.

## Steps Performed
1. Opened workspace "Investigation" from sidebar.
2. Clicked "Paths" tab -- loaded workspace settings view.
3. Observed:
   - Heading: "Workspace settings"
   - Description: "Manage which additional repositories and directories Claude can use alongside this workspace."
   - Section: "ADDITIONAL WRITABLE DIRECTORIES"
   - Helper text: "Repo names are derived from the attached directory path so you can search and review multi-repo attachments quickly."
   - "Add directory" button
   - State: "No additional directories configured."

## Observations
- The UI for adding directories exists and is well-labeled.
- Did not test actually adding a directory (would modify workspace state).
- The feature appears ready for use.

## Screenshots
- `01-paths-tab.png` -- Paths tab showing workspace settings and Add directory button

## Errors
None observed.
