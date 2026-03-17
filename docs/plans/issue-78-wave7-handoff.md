# Issue #78 Wave 7 handoff

## Scope for this wave
- Regression coverage was added for `linearIssue` request validation and override precedence.
- Linear account auth and Linear search/browse flow are intentionally still out of scope and remain TODO.

## Manual browser-control verification note
Use these steps as a quick UI sanity pass before/after backend regressions:

1. Start services:
   - `pnpm dev:all`
   - Open `http://localhost:1420` in the browser automation tool.
2. Verify app shell loads:
   - Status bar renders at the bottom.
   - Welcome screen appears when no active chat session exists.
3. Switch to **Workspaces** view (right/top tab group).
   - Expected state: Project sidebar renders (or empty-state prompt if no projects exist).
4. Add or select a project, then open **Create workspace**.
   - Expected state: dialog shows `Name`, `Base Branch`, `Cancel`, and `Create` only.
   - Expected state: no Linear search/auth controls are present yet (still Wave 7+ TODO scope).
5. Create a workspace and open it.
   - Expected state: workspace panel loads with **Chat** and **Diff** tabs and workspace header/badge.
6. Send one chat message.
   - Expected state: message appears in chat and streaming response starts without UI errors.
7. Open devtools console.
   - Expected state: no new runtime/JS console errors introduced by this change set.

## Notes
- Backend assertions are still the authoritative validation for Linear issue behavior this wave.
- API-level validation/cov for auth/search is intentionally deferred to later waves.
