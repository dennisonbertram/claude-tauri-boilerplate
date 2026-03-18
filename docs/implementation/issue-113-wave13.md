# Issue 113 Wave 13

## Summary

Completed the remaining appearance controls for issue `#113` by adding a selectable monospace font family and a compact/comfortable settings tab density option on top of the existing theme, accent, chat width, and chat density work.

## What Changed

- Added persisted `monoFontFamily` and `tabDensity` settings in `useSettings`.
- Applied the selected monospace stack through `useTheme` via the `--chat-mono-font` CSS variable.
- Added `Monospace Family` and `Tab Density` controls in `Settings > Appearance`.
- Applied the compact tab density styling to the settings tablist and tab buttons.
- Applied the selected mono font stack to the chat composer and message bubbles when mono chat mode is enabled.

## Regression Coverage

- `apps/desktop/src/hooks/useSettings.test.ts`
- `apps/desktop/src/hooks/useTheme.test.ts`
- `apps/desktop/src/components/settings/SettingsPanel.test.tsx`
- `apps/desktop/src/components/__tests__/SettingsTabsOverflow.test.tsx`
- `apps/desktop/src/components/chat/__tests__/ChatInput.test.tsx`
- `apps/desktop/src/components/chat/__tests__/MessageList.test.tsx`

## Validation

- Automated:
  - `pnpm exec vitest run src/hooks/useTheme.test.ts src/hooks/useSettings.test.ts src/components/settings/SettingsPanel.test.tsx src/components/chat/__tests__/ChatInput.test.tsx src/components/chat/__tests__/MessageList.test.tsx src/components/__tests__/SettingsTabsOverflow.test.tsx`
- Manual:
  - Started `pnpm --filter @claude-tauri/server dev` and `pnpm --filter @claude-tauri/desktop dev` in tmux sessions.
  - Verified the Appearance tab shows `Monospace Family` and `Tab Density`.
  - Verified compact tab density changes the settings tab classes.
  - Verified `Courier New` is applied to the chat textarea and wide chat width updates the message/composer container classes.

## Notes

- `pnpm build` for `apps/desktop` still fails on unrelated baseline TypeScript issues already present in the repo, including shared-type resolution errors and stale test typing problems outside the issue scope.
