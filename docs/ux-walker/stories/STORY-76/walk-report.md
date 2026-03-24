# STORY-076: Use Permission Mode = "Accept Edits" for Auto-Approval

## Walk Date
2026-03-23

## Story
Check for permission mode selector including "Accept Edits" option.

## Steps Taken
1. Found Permission Mode dropdown in Settings > AI & Model > Advanced (set to "Default")
2. Found Permission Mode dropdown in Agent Profiles > Tools tab (set to "Default")
3. Found "Normal" label in status bar (crashes on click)
4. Could not expand dropdowns fully due to crash behavior

## Findings
- Permission Mode exists in two places:
  1. **Settings > AI & Model > Advanced**: dropdown set to "Default"
  2. **Agent Profiles > Tools tab**: dropdown set to "Default" with description "Ask for permission on risky operations"
- The status bar shows "Normal" which appears to be the active permission mode
- BUG: Clicking the "Normal" button in the status bar crashes the app, preventing exploration of mode switching
- The "Default" mode description mentions "risky operations", implying there are less restrictive modes available (likely including an accept-edits-like mode)
- Could not verify what options the Permission Mode dropdown contains due to the status bar crash and the dropdown not being opened in Settings

## Verdict
**partial** -- Permission Mode dropdown exists in both Settings and Agent Profiles. The status bar shows current mode. However, the available options could not be fully verified, and the status bar mode button crashes the app.

## Bugs Found
- CRASH: Clicking permission mode button in status bar crashes the app (same as STORY-070)
