# Issue #100 Bash Display Controls

Issue `#100` was already marked `partially-done` with an explicit handoff comment pointing at the remaining `BashDisplay` work. This branch completes that narrowed scope on `main`.

## What changed

- Added a focusable terminal card wrapper so `Cmd/Ctrl+F` and `Cmd/Ctrl+K` can be handled directly by the Bash output component.
- Added a search input above stdout when output is present.
- Filtered output lines by the active query and disabled truncation while searching so matching lines remain visible.
- Added a full-height toggle that switches the output region between `max-h-96` and `max-h-none`.
- Preserved the existing copy buttons, dangerous-command warning, collapse toggle, truncation button, and ANSI rendering behavior.

## Tests

- Added failing tests first in `apps/desktop/src/components/chat/__tests__/BashDisplay.test.tsx`.
- Verified with:
  - `pnpm --filter @claude-tauri/desktop exec vitest run --configLoader runner src/components/chat/__tests__/BashDisplay.test.tsx`
  - `pnpm test`

## Manual verification

- Started `pnpm dev:server` and `pnpm dev` in separate tmux sessions.
- Rendered the live `BashDisplay` component through the Vite dev server in Playwright and verified:
  - `Meta+F` focuses the search input
  - searching for `line 50` filters stdout to the matching line and hides the truncation button
  - `Meta+K` clears the search query and restores truncation
  - the full-height toggle switches the output container from `max-h-96` to `max-h-none`

## Notes

- The browser session still reports pre-existing console noise from missing workflow memory files and a dev-font `403`; those errors were present before this branch and are unrelated to `BashDisplay`.
