# Issue #116 Resource Usage Toggle

Issue `#116` was already partially implemented on the integration line: the server exposed `/api/system/diagnostics`, the status bar had a gated resource-usage segment, and the missing piece was the persisted settings wiring that let users control it from the UI.

This branch completes that gap by adding `showResourceUsage` to the persisted desktop settings model and exposing a Status-tab toggle in Settings. The new tests cover the default value, the Status-tab toggle wiring, localStorage persistence, and the existing status-bar rendering path.

Validation:

- `pnpm --filter @claude-tauri/desktop test -- src/hooks/useSettings.test.ts src/components/settings/SettingsPanel.test.tsx src/components/__tests__/StatusBar.test.tsx src/components/__tests__/SettingsTabsOverflow.test.tsx`

Manual browser verification is still required against a live dev app before final closeout.
