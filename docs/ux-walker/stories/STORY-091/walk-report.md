# STORY-091: Handle Linear Auth Expiration

## Walk Date: 2026-03-23

## Steps Performed
1. Searched for auth expiration/401/unauthorized handling in linear-api.ts
2. Checked LinearPanel and LinearIssuePicker error handling

## Observations
- No explicit auth expiration or 401 handling found in linear-api.ts
- LinearPanel has generic error handling: catches errors and displays them in a destructive alert box
- LinearIssuePicker checks `connected` status on open and shows "Connect Linear" prompt if disconnected
- If auth expires, the next API call would fail, and the generic error handler would display the error
- No specific "session expired, please reconnect" messaging found
- The "Refresh" button in Settings allows manual re-check of connection status

## Result: PARTIAL
Generic error handling exists but no specific auth expiration detection or user-friendly re-auth flow. Expired tokens would show generic error messages rather than a targeted "reconnect" prompt.

## Code References
- `/apps/desktop/src/components/settings/LinearPanel.tsx` (error handling)
- `/apps/desktop/src/lib/linear-api.ts`
