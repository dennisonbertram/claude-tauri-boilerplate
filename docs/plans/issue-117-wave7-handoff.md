# Issue #117 Wave 7 Handoff

## Scope

- Added regression coverage for model picker defaults, number-key switching, model persistence, and fork model carryover.
- Implemented fast model switching in the status bar picker via number keys (`1`-`9`) while the picker is open.
- Ensured forked sessions inherit the source session model.

## Manual browser verification note

1. Start the app (`pnpm dev:all`) and open `http://localhost:1420`.
2. Open the model picker in the status bar and press `2` then `3`; verify the label switches immediately to `Opus 4.6` then `Haiku 4.5`.
3. Refresh the app and verify the same model remains selected (settings persistence).
4. Fork a session from the sidebar context menu and verify the fork keeps the source model selection behavior on the next turn.
