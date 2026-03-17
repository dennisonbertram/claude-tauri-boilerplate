# Wave 8 Completion (Issues #78, #83, #84, #91, #110, #117)

Status: complete on `codex/wave8-merge` at `eafe30a`

## Goal

Finish the six wave-7 issues that remain open and close any issue whose full acceptance criteria land on `main`.

## Scope

1. `#78` Linear integration for issue tracking
2. `#83` Checkpoints: revert chat to any previous turn
3. `#84` Plan mode with interactive questions and feedback
4. `#91` Slash commands with autocomplete
5. `#110` General agent instructions (system prompt customization)
6. `#117` Model selector with fast switching and default model control

## Constraints

- Start from current `main`.
- Use isolated git worktrees, one per issue.
- Use subagents in parallel through tmux-backed `codex exec` runs.
- Follow strict TDD in each worktree.
- Update the existing issue handoff doc in `docs/plans/` with final manual verification notes.
- Keep this plan and `docs/plans/INDEX.md` current during the wave.

## Worktrees

- `codex/issue-78-complete`
- `codex/issue-83-complete`
- `codex/issue-84-complete`
- `codex/issue-91-complete`
- `codex/issue-110-complete`
- `codex/issue-117-complete`
- integration branch: `codex/wave8-merge`

## Completion checklist

### `#78`
- [x] Add or complete Linear auth/connect flow.
- [x] Add issue browse/search UI with chronological sorting.
- [x] Support linking Linear issues to sessions and workspaces.
- [x] Support attaching Linear issue context in chat.
- [x] Support creating a workspace from a Linear issue.
- [x] Add deeplink support into a workspace from a Linear issue context.
- [x] Add/update regression tests and manual verification note.

### `#83`
- [x] Ensure each message turn creates a git-backed checkpoint.
- [x] Support reverting to any previous turn from the UI.
- [x] Wipe conversation history after the selected turn when required.
- [x] Restore file state to the selected checkpoint.
- [x] Show changes from Claude's most recent turn.
- [x] Add a confirmation dialog before destructive revert.
- [x] Add/update regression tests and manual verification note.

### `#84`
- [x] Toggle plan mode on and off.
- [x] Render plans in a dedicated panel before implementation.
- [x] Support approve, reject, and approve-with-feedback actions.
- [x] Support interactive questions during planning.
- [x] Support copy plan to clipboard.
- [x] Support export plan into a new chat.
- [x] Support handoff to another agent.
- [x] Store plans in `.context`.
- [x] Use distinct icons for plan approval and user-input states.
- [x] Add/update regression tests and manual verification note.

### `#91`
- [x] Trigger slash autocomplete from `/`.
- [x] Support fuzzy search across commands.
- [x] Include `/clear`, `/compact`, `/restart`, and `/add-dir`.
- [x] Support plugin-installed commands.
- [x] Support autocomplete anywhere in the message.
- [x] Show invalid slash command errors in chat.
- [x] Support commands with file attachments.
- [x] Add/update regression tests and manual verification note.

### `#110`
- [x] Add global agent instructions in settings.
- [x] Add per-repository custom review prompts.
- [x] Add per-repository custom PR creation prompts.
- [x] Add per-repository custom branch naming prompts.
- [x] Send instructions to the agent on startup.
- [x] Send permission mode changes to Claude in real time.
- [x] Add/update regression tests and manual verification note.

### `#117`
- [x] Ensure the picker exposes all available models.
- [x] Allow default model changes from the picker.
- [x] Support number-key quick switching.
- [x] Support keyboard navigation in the picker.
- [x] Preserve model selection when forking sessions.
- [x] Make mid-session switching instant.
- [x] Add PR cheap-model control.
- [x] Add fast-mode toggle.
- [x] Add/update regression tests and manual verification note.

## Integration and closeout

1. Merge issue branches into `codex/wave8-merge`.
2. Run focused frontend and server validation on the merge branch.
3. Do a cleanup pass for regressions and merge conflicts.
4. Merge the integration branch to `main` only if `main` is clean.
5. Close any fully completed GitHub issue and leave a final comment with branch, commit, tests, and manual verification note.

## Final validation

- `cd apps/server && bun test src/routes/linear.test.ts src/routes/checkpoints.test.ts src/routes/plan.test.ts src/routes/chat-commands.test.ts src/services/event-mapper.test.ts src/routes/chat-workspace.test.ts src/routes/memory.path-regression.test.ts src/routes/chat.test.ts src/routes/sessions.test.ts src/routes/sessions-auto-name-model.test.ts`
  - Result: `159 pass, 0 fail`
- `cd apps/desktop && ./node_modules/.bin/vitest run src/components/settings/SettingsPanel.test.tsx src/components/chat/__tests__/ChatPageTransport.test.tsx src/components/__tests__/CheckpointTimeline.test.tsx src/components/chat/__tests__/ChatPageRewindRefresh.test.tsx src/hooks/__tests__/useCheckpoints.test.tsx src/components/chat/__tests__/PlanView.test.tsx src/components/chat/__tests__/ChatPageSlashCommands.test.tsx src/hooks/useCommands.test.ts src/hooks/useStreamEvents.test.ts src/lib/workflowPrompts.test.ts src/hooks/useSettings.test.ts src/components/__tests__/SettingsTabsOverflow.test.tsx src/hooks/useSessions.test.ts`
  - Result: `173 pass, 0 fail`
