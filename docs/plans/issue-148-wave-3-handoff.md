Issue #148 is already fixed on this branch via Tauri config, so I only added regression coverage and handoff documentation.

- What was completed:
  - Verified `apps/desktop/src-tauri/tauri.conf.json` already sets `app.windows[0].minWidth` to `800` and `minHeight` to `600`.
  - Added a content-regression test: [apps/desktop/src/tauri-config.test.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-148/apps/desktop/src/tauri-config.test.ts)
  - Added handoff doc: [docs/plans/issue-148-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-148/docs/plans/issue-148-wave-3-handoff.md)

- Tests run (targeted validation):
  - `pnpm exec vitest run src/tauri-config.test.ts` in `apps/desktop` — **pass** (`1 passed`).

- Manual browser-control note:
  - No frontend behavior changed; no in-app interaction required for this regression-only fix. Suggested follow-up: run the desktop app and confirm native resize cannot go below 800px.

- Risks / follow-up:
  - If future platform-specific Tauri config overrides are added, ensure they keep the same minimum window size values in all generated config paths.
