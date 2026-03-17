# Issue #117 Wave 7 Handoff

## Scope

- Added regression coverage for model picker defaults, number-key switching, model persistence, and fork model carryover.
- Implemented fast model switching in the status bar picker via number keys (`1`-`9`) while the picker is open.
- Ensured forked sessions inherit the source session model.
- Added persisted settings for `fastMode` and `prReviewModel`.
- Chat transport now forces `effort: low` when `fastMode` is enabled.
- Session create and auto-name flows now accept an explicit model.
- Chat requests now persist caller-selected models onto app sessions, including mid-session model switches.

## Targeted automated validation

- `cd apps/server && bun test src/routes/chat.test.ts src/routes/sessions.test.ts`
- `cd apps/desktop && pnpm test -- useSettings useSessions ChatPageTransport`

Result:
- server: `43 pass, 0 fail`
- desktop targeted run: `73 files passed, 992 tests passed`

## Manual browser verification note

1. Start the app (`pnpm dev:all`) and open `http://localhost:1420`.
2. Open the model picker in the status bar and press `2` then `3`; verify the label switches immediately to `Opus 4.6` then `Haiku 4.5`.
3. Refresh the app and verify the same model remains selected (settings persistence).
4. Fork a session from the sidebar context menu and verify the fork keeps the source model selection behavior on the next turn.
5. Enable `Fast mode` in settings, send a new prompt, and verify the outgoing request uses the lower-effort path without changing the selected model label.
6. Trigger session auto-naming after at least two turns and verify the request uses the configured PR/review model rather than the interactive chat model.
