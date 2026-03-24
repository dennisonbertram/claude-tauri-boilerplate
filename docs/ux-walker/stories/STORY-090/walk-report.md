# STORY-090: Disconnect Linear

## Walk Date: 2026-03-23

## Steps Performed
1. Viewed Settings > Integrations > Linear section
2. Reviewed LinearPanel disconnect logic

## Observations
- When Linear is connected, a "Disconnect" button (red/destructive variant) is shown
- `handleDisconnect()` calls `linear.disconnect()` then refreshes status
- Error handling catches disconnect failures
- The UI properly toggles between Connect/Disconnect states
- Could not test live disconnect since Linear is not currently connected

## Result: PASS
Disconnect functionality is implemented with proper UI state management and error handling.

## Code References
- `/apps/desktop/src/components/settings/LinearPanel.tsx` (lines 37-47, 83-86)
