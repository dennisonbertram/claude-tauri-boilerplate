# STORY-082: Connect Linear OAuth

## Walk Date: 2026-03-23

## Steps Performed
1. Opened Settings panel via gear icon
2. Clicked "Integrations" tab
3. Observed Linear Integration section

## Observations
- Settings > Integrations tab exists and is accessible
- **Linear section present** with:
  - Title: "Linear Integration"
  - Description: "Connect Linear to browse issues from chat and attach issue context."
  - Status indicator: Shows "Not connected" / "Connected"
  - "Refresh" button to re-check status
  - "Connect Linear" button (opens OAuth URL in new tab)
  - Instruction text about returning after authorization
- When connected, a "Disconnect" button (destructive variant) replaces "Connect Linear"
- Error boundary displays errors in red-bordered alert

## Result: PASS
The Linear OAuth connection UI is fully implemented in Settings > Integrations. It shows status, connect/disconnect buttons, and refresh capability.

## Code References
- `/apps/desktop/src/components/settings/LinearPanel.tsx` - Main settings panel
- `/apps/desktop/src/lib/linear-api.ts` - API layer
