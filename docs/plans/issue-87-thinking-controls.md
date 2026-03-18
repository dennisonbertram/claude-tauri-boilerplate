# Issue 87: Claude thinking controls

## Goal
Complete the missing thinking controls for Claude responses so users can keep reasoning visible by default, toggle it quickly from the keyboard, and tune reasoning effort/budget from Settings.

## Acceptance criteria
- [x] `Cmd+Shift+.` expands thinking blocks in the active chat.
- [x] `Option+T` toggles thinking visibility.
- [x] Thinking is enabled by default for new users.
- [x] Default thinking level preference exists in Settings.
- [x] Thinking budget control exists in Settings and is sent to the backend.
- [x] Thinking preferences persist for future chats and forked sessions because they are stored in shared app settings.

## Notes
- The repository already had persisted `showThinking` defaults and the `Thinking Effort` setting before this branch.
- This branch completed the missing keyboard controls, rendering behavior, and Claude SDK budget wiring, then added regression coverage plus browser verification.
