# Issue #110 Wave 8 completion handoff

## Scope completed

- Global agent instructions already present in settings are now sent on every chat startup via `systemPrompt`.
- Repository-scoped workflow prompts now exist for:
  - review
  - PR creation
  - branch naming
- Repository workflow prompts are loaded from per-project memory files and no longer leak through global `localStorage`.
- Workflow prompts can be saved or reset from **Settings → Workflows**.
- `/review`, `/pr`, and `/branch` now use the repository-scoped prompt values.
- Permission mode remains live in the chat transport payload, so subsequent turns use the current setting immediately.
- The memory route path regression was fixed so repo-scoped prompt files resolve against the project root.

## Targeted automated validation

- `cd apps/server && bun test src/routes/chat-commands.test.ts src/routes/chat-workspace.test.ts src/routes/memory.path-regression.test.ts`
  - Result: `25 pass, 0 fail`
- `cd apps/desktop && vitest run src/lib/workflowPrompts.test.ts src/hooks/useSettings.test.ts src/hooks/useCommands.test.ts src/components/settings/SettingsPanel.test.tsx src/components/__tests__/SettingsTabsOverflow.test.tsx src/components/chat/__tests__/ChatPageTransport.test.tsx`
  - Result: `102 pass, 0 fail`

## Manual browser-control verification note

1. Start the existing app on port `1420`.
2. Open **Settings → Model** and set a global system prompt.
   - Expected: the next chat turn uses that startup instruction.
3. Open **Settings → Workflows**.
   - Expected: Review, PR, and Branch Naming prompt editors are visible.
4. Save repository-specific prompt overrides.
   - Expected: prompt state persists for this repository.
5. Trigger `/review`, `/pr`, and `/branch`.
   - Expected: each workflow uses the repository-scoped prompt content.
6. Change **Permission Mode** in settings and send another message.
   - Expected: the next request uses the updated mode without restarting the app.

## Notes

- Repository workflow prompts are intentionally stored per project rather than globally.
- The old wave-7 state for this issue is superseded by this branch.
