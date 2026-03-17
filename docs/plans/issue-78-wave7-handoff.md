# Issue #78 Wave 8 completion handoff

## Scope completed
- Added Linear OAuth connection flow in Settings via the new **Linear** tab.
- Added backend Linear routes for auth status, authorize URL generation, OAuth callback/token exchange, issue search, and issue lookup by identifier.
- Added a chat-side Linear issue picker for browsing/searching issues in newest-first order.
- Added Linear issue attachment to chat requests so Claude receives issue context.
- Added workspace creation directly from a selected Linear issue.
- Added Linear deep-link support so `#linear/issue/<IDENTIFIER>` can preselect issue context in chat.

## Targeted automated validation
- `cd apps/server && bun test src/routes/linear.test.ts`
  - Result: `7 pass, 0 fail`
- `cd apps/desktop && vitest run src/components/settings/SettingsPanel.test.tsx src/components/chat/__tests__/ChatPageTransport.test.tsx`
  - Result: `28 pass, 0 fail`

## Manual browser-control verification note
Use these steps for a quick verification pass:

1. Start the existing dev app on port `1420`.
2. Open **Settings → Linear**.
   - Expected: connection status loads and a connect action is available when not yet authorized.
3. Complete Linear OAuth and return to the app.
   - Expected: Settings shows a connected state.
4. Open a chat and trigger the Linear issue picker.
   - Expected: issues load in newest-first order and search narrows the list.
5. Select an issue.
   - Expected: the issue chip appears above the composer and the next chat request includes that issue as context.
6. From the picker, create a workspace from a selected issue.
   - Expected: workspace creation succeeds and references the chosen Linear issue.
7. Open a deep link like `#linear/issue/ENG-123`.
   - Expected: the matching Linear issue is resolved and preselected for the chat.

## Notes
- This branch replaces the earlier wave-7 placeholder state; the previously deferred auth/search/browser pieces are now implemented.
