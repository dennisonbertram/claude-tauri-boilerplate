# STORY-070: Request Permission to Run Bash Command

## Walk Date
2026-03-23

## Story
Check how permission requests appear during chat interactions when agent needs to run bash commands.

## Steps Taken
1. Navigated to main chat interface at http://localhost:1927
2. Observed status bar showing "Normal" permission mode indicator
3. Attempted to click the "Normal" button in the status bar to explore permission modes

## Findings
- Status bar shows permission mode as "Normal" at bottom left
- BUG (CRITICAL): Clicking the "Normal" permission mode button in the status bar causes an immediate app crash ("Something went wrong" error page)
- Cannot test in-conversation permission prompts without an active sidecar session
- The app recovers after navigating back to localhost:1927

## Verdict
**blocked** -- The status bar permission mode button crashes the app. In-conversation permission request UI could not be tested because it requires an active agent session with the sidecar running.

## Bugs Found
- CRASH: Clicking "Normal" permission mode button in status bar crashes the app with error boundary
