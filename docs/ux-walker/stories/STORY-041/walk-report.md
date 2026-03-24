# STORY-041: Open Workspace in IDE

## Status: PASS

## Walk Steps

1. Opened workspace Investigation
2. Found "Open In" button in workspace header row (between Copy branch and Merge buttons)
3. Button has aria-label "Open workspace in VS Code"
4. Clicked "Open In" button -- no dropdown appeared, it's a single-action button
5. Button directly triggers VS Code open (no IDE selection menu)

## Findings

### What Works
- "Open In" button is present and visible in workspace header
- Button text says "Open In", aria-label says "Open workspace in VS Code"
- Clicking triggers the open action (VS Code launch)
- Button placement is logical next to Copy branch

### Issues Found
1. **Enhancement: No IDE selector dropdown** -- The button only opens VS Code. There's no dropdown to select alternative IDEs (Cursor, WebStorm, Zed, etc.). Users with other preferred editors have no option.
2. **Minor: Button text is ambiguous** -- "Open In" without specifying the IDE is unclear. The aria-label says "VS Code" but the visible text just says "Open In".

## Screenshots
- `workspace-header-with-open-in.png` -- Workspace header showing Open In button
- `open-in-button.png` -- Another view of the header area
