# Issue 128 Scroll Affordance Follow-up

## Goal

Resolve the remaining live-browser gap for GitHub issue `#128`, where the chat scroll-to-bottom affordance existed in unit tests but still failed to appear in the real app after scrolling a long conversation upward.

## Acceptance Criteria

- [x] Reproduce the live bug against the current `main`
- [x] Add failing regression coverage before implementation
- [x] Remove the brittle post-render viewport query path
- [x] Bind the chat scroll logic directly to the `ScrollArea` viewport ref and scroll handler
- [x] Re-run targeted desktop tests
- [x] Verify manually in a real browser that:
  - [x] the `Latest` button appears after scrolling up in a long chat
  - [x] clicking `Latest` returns to the bottom
  - [x] the button disappears again at the bottom

## Implementation Notes

- Added explicit `viewportRef` and `viewportProps` support to the shared `ScrollArea` wrapper.
- Switched `MessageList` to use direct viewport binding instead of querying the DOM and manually attaching listeners after render.
- Added regression coverage for the shared viewport forwarding path and updated the chat affordance tests to match the new behavior.

## Manual Verification

1. Open `Chat`
2. Load the session `You're right — I apologize for the confusion! Your **first q`
3. Scroll upward inside the message pane
4. Confirm the floating `Latest` button appears
5. Click `Latest`
6. Confirm the chat scrolls back to the newest messages and the button disappears
