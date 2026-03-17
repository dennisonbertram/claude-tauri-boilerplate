# Issue #75 - Forward failing CI checks to Claude for auto-fix

## Scope

- [x] Detect CI failures in Bash tool output from stream events.
- [x] Expose detected failure summary/checks in the desktop tool-call stream UI.
- [x] Add a `Fix Errors` action in tool output context.
- [x] Pre-fill a follow-up prompt using failure context so Claude can rerun/fix.
- [x] Re-run flow should work with current stream reset + message send path.

## Progress checklist

- [x] Add reducer parsing for `tool:result` in `useStreamEvents`.
- [x] Extend `ToolCallState` with `ciFailures` payload.
- [x] Add/adjust unit tests for detection and non-detection behavior.
- [x] Validate CI-failure regex against common GitHub Actions/CI log formats (e.g., process completion and emoji-marked check lines).
- [x] Wire `Fix Errors` callback through `MessageList` and `ToolCallBlock`.
- [x] Add tool-call UI test for `Fix Errors` button callback.
- [x] Manual verification path for full fix-rerun loop in desktop chat:
  - Browser-control check: use the app UI in dev session, open a chat with a failing Bash CI output, click `Fix Errors`, and verify prompt payload plus reset behavior on the next submit.
