# Issue #78 - Linear integration for issue tracking

## Scope checklist

- [ ] Connect a Linear account
  - [ ] Add OAuth/session handling for Linear account linkage
  - [ ] Persist and expose token state in secure storage
- [ ] Browse and search Linear issues from the app
  - [ ] Add backend proxy/search endpoint with throttling and pagination
  - [ ] Add desktop search UX with issue list + filtering
- [ ] Link issues to sessions/workspaces
  - [x] Add Linear issue metadata fields to shared session/workspace types
  - [x] Persist linear issue fields in SQLite `sessions` and `workspaces`
  - [x] Include linear issue metadata in workspace creation flow
  - [x] Include linear issue metadata in chat session creation and updates
- [x] Attach issue context in chat and create workspace from an issue
  - [x] Add `linearIssue` to chat and workspace request payloads with validation
  - [x] Inject issue context block into prompt before Claude streaming
  - [x] Ensure workspace-linked issue metadata is stored on created/updated sessions

## Wave 1 status

- [x] Implemented schema + shared type support for issue links
- [x] Added creation/update persistence for `linearIssue` in sessions and workspaces
- [x] Added initial route-level tests and DB regression tests for issue linkage
- [ ] Linear account auth/search workflows remain for future waves
