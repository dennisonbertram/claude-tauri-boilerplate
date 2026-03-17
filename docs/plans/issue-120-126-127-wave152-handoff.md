# Wave 152 handoff: issues #120, #126, #127

## Scope

- Cover regression intent for slash command and keyboard shortcut behavior reported in GitHub issues:
  - `#120` (`/model`, `/cost`, and `/compact` slash commands did nothing)
  - `#126` (`/compact` slash command was a placeholder/no-op)
  - `#127` (`Cmd+,` Settings shortcut not wired in ChatPage)

## Current status

- Fixed behavior now exists in the current branch, and the relevant regression tests already assert it.
- No code changes were required in this handoff step; this is a documentation and verification pass for issue cluster continuity.

## Regression coverage reviewed

- `apps/desktop/src/hooks/useCommands.test.ts`
  - `/model` slash command is present and executes `showModelSelector`.
  - `/cost` slash command is present and executes `showCostSummary`.
  - `/compact` slash command executes toast-based feedback and exposes the `Open Settings` action.
- `apps/desktop/src/components/chat/__tests__/ChatPageShortcuts.test.tsx`
  - `Cmd+,` shortcut triggers `onOpenSettings`.
  - `Cmd+Shift+?` opens the Keyboard Shortcuts modal and includes `Open Settings`.

## Focused test change needed?

- No new focused regression test was added in this task.
- Existing tests already cover the cluster behaviors.

## Manual browser verification (slash command + shortcuts)

1. Start app at `http://localhost:1420`.
2. In chat, use the slash command palette:
   - confirm `/model`, `/cost`, and `/compact` show expected effects (model/cost handlers triggered, compaction shows toast with “Open Settings” action).
3. Validate shortcuts:
   - press `Cmd+,` and confirm Settings opens,
   - press `Cmd+Shift+?` and confirm the Keyboard Shortcuts modal opens and the entry for `Open Settings` is visible.

