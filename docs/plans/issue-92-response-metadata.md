# Issue #92 Plan: Response Metadata and AI Message Actions

## Goal

Complete the assistant-message metadata/actions surface so each assistant response can expose quick diagnostics and follow-up actions directly in chat.

## Acceptance Criteria

- [x] Assistant responses show a concise metadata strip beneath the message.
- [x] Hovering the metadata strip reveals detailed response stats.
- [x] Assistant responses can be copied as markdown with one click.
- [x] Workspace-backed chats show the latest changed files beneath the response.
- [x] Existing failed-response retry behavior remains intact.
- [x] Existing context-indicator hover details and high-usage warning remain intact.

## Plan

- [x] Add failing UI tests for assistant response metadata rendering and copy action.
- [x] Add chat-page wiring for associating latest usage/diff metadata with the latest assistant response.
- [x] Render a compact assistant metadata/action footer in `MessageList`.
- [x] Run targeted frontend tests.
- [x] Attempt manual browser verification for the updated chat surface.
- [x] Update implementation/docs logs with the final behavior and validation results.

## Outcome

- `MessageList` now renders a compact assistant-response footer with duration, aggregate token count, changed-file chips, and a copy-as-markdown button.
- `ChatPage` associates streamed usage metadata and workspace diff results with the latest assistant message so the footer stays attached to the correct turn.
- Existing retry handling in `ErrorBanner` and context-usage hover/pulse behavior in `ContextIndicator` already satisfied the remaining issue acceptance criteria and were left intact.
- Targeted Vitest coverage passes. Manual browser verification was attempted, but the sandbox denied opening a local Vite listener (`listen EPERM`), so live UI verification could not be completed in this run.
