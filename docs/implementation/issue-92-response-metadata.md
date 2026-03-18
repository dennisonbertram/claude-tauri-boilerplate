# Issue #92 Response Metadata

## Scope

Complete the missing assistant-response metadata surface for GitHub issue `#92` without disturbing the already-landed retry and context-indicator behavior.

## What Changed

- Added `assistantMetadata` support to [`/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/MessageList.tsx`](/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/MessageList.tsx) so assistant messages can render a footer with:
  - response duration
  - aggregate token count
  - changed-file summary chips
  - copy-as-markdown action
  - hover tooltip for model/input/output/cache usage details
- Wired [`/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/ChatPage.tsx`](/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/ChatPage.tsx) to attach usage data to the latest assistant turn and refresh changed files from the workspace diff hook when streaming completes.
- Added regression tests for both the presentation layer and the ChatPage metadata wiring.

## Validation

- `pnpm exec vitest run src/components/chat/__tests__/MessageList.test.tsx src/components/chat/__tests__/ChatPageTransport.test.tsx`
- Manual browser verification was attempted, but the sandbox blocked both `vite` and `pnpm dev` from binding to a local port with `listen EPERM`, so no live browser pass was possible in this environment.

## Acceptance Criteria Notes

- Retry-on-failure behavior is already covered by the existing `ErrorBanner` and [`/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/__tests__/ChatPageErrorBanner.test.tsx`](/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/__tests__/ChatPageErrorBanner.test.tsx).
- Context usage hover details and high-usage warning are already implemented in [`/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/ContextIndicator.tsx`](/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/ContextIndicator.tsx) with dedicated tests in [`/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/__tests__/ContextIndicator.test.tsx`](/tmp/claude-tauri-issue-92/apps/desktop/src/components/chat/__tests__/ContextIndicator.test.tsx).
