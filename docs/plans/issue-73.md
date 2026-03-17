# Issue #73 — Empty-session selection should set New Chat guard state

## Scope
Fix the frontend session-selection path in `App.tsx` so that switching between sessions updates `activeSessionHasMessages` based on actual message presence, not just whether a `claudeSessionId` exists.

## Remaining tasks
- [ ] Confirm session selection updates downstream state when active session message metadata is stale.
- [ ] Add/update targeted frontend regression tests for:  
  - selecting an empty session (no messages, no claude id) and keeping `New Chat` as a no-op
  - selecting a non-empty session and allowing `New Chat`
- [ ] Run targeted frontend test(s) and document pass/fail in `docs/logs/engineering-log.md` if issues remain.
- [ ] Run manual browser-control verification of the session click -> New Chat flow and record outcome in this issue note.

## Manual verification note
- Browser check requested for this issue: load the app, click into an empty session in the sidebar, click **New Chat**, and confirm the session is not duplicated when no messages exist; repeat with a session that has messages and confirm a new session is created.
