# STORY-160: Error Recovery & Graceful Degradation

**Type**: medium
**Goal**: Verify the app handles API errors gracefully
**Result**: PASS (with notes) — app has graceful degradation but recovery from connection page requires manual reload

## Steps Performed

1. **Checked normal app state** — app loads correctly with sidebar, conversation list, and navigation working without console errors.

2. **Blocked API calls** to `http://localhost:3846/*` using network route abort to simulate server down.

3. **Navigated while API blocked** — clicking New Chat initially showed cached conversations list (no immediate failure). Clicking further caused the app to transition to a "Welcome to Claude Tauri" connection setup page.

4. **Observed error UI** — the connection page shows:
   - Step-by-step instructions (Install Claude Code, Log in, Verify connection)
   - "Server not reachable" status text
   - "Check Connection" button for retry

5. **Unblocked API** and clicked "Check Connection" — app showed "Connecting..." spinner but remained stuck. Did not automatically recover to the main app view.

6. **Manual page reload** — navigating to `http://localhost:1927` after unblocking the API restored the app to full functionality.

7. **Tested non-existent route** — `/does-not-exist` loads the main app (no 404).

8. **Checked for console errors** — no console errors or warnings throughout testing.

## Findings

| ID | Severity | Description |
|----|----------|-------------|
| F-160-001 | low | Connection recovery page's "Check Connection" button does not reliably restore the app — user must manually reload |
| F-160-002 | info | App shows graceful "Server not reachable" state with helpful setup instructions when API is down |

## Screenshots

- `screenshots/01-initial-state.png` — Normal app state
- `screenshots/02-teams-view.png` — Teams view (normal)
- `screenshots/03-api-blocked-new-chat.png` — After API block, cached view still shows
- `screenshots/04-error-state.png` — "Server not reachable" connection setup page
- `screenshots/05-after-recovery.png` — Stuck on "Connecting..." after unblocking API
- `screenshots/06-nonexistent-route.png` — Non-existent route loads main app
