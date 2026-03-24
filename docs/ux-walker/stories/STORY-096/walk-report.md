# STORY-096: Linear Issue Picker Offline

## Walk Date: 2026-03-23

## Steps Performed
1. Searched for offline handling in LinearIssuePicker
2. Checked error states for network failures

## Observations
- No explicit offline detection in LinearIssuePicker
- Generic error handling via try/catch in fetch calls
- No "you are offline" messaging or offline-specific UX
- If network is down, the fetch would fail and the generic error state would display
- No cached/previously-fetched issues shown when offline
- The error display is: `{error && <p className="text-destructive">...{error}</p>}`

## Result: NOT IMPLEMENTED
No specific offline behavior for the Linear issue picker. Network failures produce generic error messages with no offline-aware caching or messaging.

## Code References
- `/apps/desktop/src/components/linear/LinearIssuePicker.tsx`
