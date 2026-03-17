# Issue #77 command palette wave-1 plan

- [x] Add command list support for session and PR navigation.
- [x] Keep fuzzy matching in command filtering with relevance ordering.
- [x] Expose navigation callbacks from root app to ChatPage command context.
- [x] Ensure Cmd+K opens/toggles the palette (and remains wired through keyboard hooks).
- [x] Add regression tests for new commands and fuzzy matching.

Manual verification note: Validate Cmd+K opens/toggles the command palette, filter + keyboard navigation works in-browser, Enter executes the highlighted command, and Escape closes it.
