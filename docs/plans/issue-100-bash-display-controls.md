# Issue #100 Bash Display Controls

## Goal

Complete the existing partially-done scope for GitHub issue `#100` by landing the Bash display terminal controls already called out in the issue handoff: search within command output, keyboard clearing, and full-height expansion.

## Acceptance Criteria

- [x] `Cmd/Ctrl+F` focuses the Bash output search field.
- [x] Searching filters visible output lines and temporarily bypasses truncation.
- [x] `Cmd/Ctrl+K` clears the search query.
- [x] A full-height toggle removes and restores the output height cap.
- [x] Desktop regression coverage is added before implementation.
- [x] Manual browser verification confirms the live component behavior.

## Implementation Checklist

- [x] Add failing `BashDisplay` tests for search focus, search filtering, clear shortcut, and height toggle.
- [x] Implement the Bash display search input and keyboard handlers.
- [x] Implement the output height toggle without changing existing copy/collapse behavior.
- [x] Run targeted desktop tests.
- [x] Run the full repo test suite.
- [x] Manually verify the rendered component in a live browser session.
