# Issues 118, 120, 126, 127, 140 Cleanup Wave

## Feature Description

These five bugs are already covered by the `codex/wave1-merge` UI cleanup branch, but they still need explicit regression coverage and issue-level handoff notes so other agents do not re-open the same work.

## Acceptance Criteria

- [x] `#118` has an explicit regression test proving settings tabs are all visible and the tablist wraps instead of hiding overflow.
- [x] `#120` and `#126` have explicit regression tests proving `/model`, `/cost`, and `/compact` no longer silently no-op.
- [x] `#127` has an explicit regression test proving `Cmd+,` is registered in `ChatPage` and the help modal includes Settings.
- [x] `#140` has an explicit regression test proving the command palette shows a bottom scroll affordance when content overflows.
- [x] Browser-based manual verification is recorded in the issue handoff/update.

## Checklist

- [x] Review existing wave-1 implementation against the five GitHub issues
- [x] Add missing regression tests only where coverage is absent
- [x] Run targeted frontend test suites
- [x] Manually verify the relevant flows in the browser
- [ ] Update the GitHub issues with branch/commit handoff notes
