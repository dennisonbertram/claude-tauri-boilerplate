# Wave 8 Completion (Issues #78, #83, #84, #91, #110, #117)

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
- [ ] Add or complete Linear auth/connect flow.
- [ ] Add issue browse/search UI with chronological sorting.
- [ ] Support linking Linear issues to sessions and workspaces.
- [ ] Support attaching Linear issue context in chat.
- [ ] Support creating a workspace from a Linear issue.
- [ ] Add deeplink support into a workspace from a Linear issue context.
- [ ] Add/update regression tests and manual verification note.

### `#83`
- [ ] Ensure each message turn creates a git-backed checkpoint.
- [ ] Support reverting to any previous turn from the UI.
- [ ] Wipe conversation history after the selected turn when required.
- [ ] Restore file state to the selected checkpoint.
- [ ] Show changes from Claude's most recent turn.
- [ ] Add a confirmation dialog before destructive revert.
- [ ] Add/update regression tests and manual verification note.

### `#84`
- [ ] Toggle plan mode on and off.
- [ ] Render plans in a dedicated panel before implementation.
- [ ] Support approve, reject, and approve-with-feedback actions.
- [ ] Support interactive questions during planning.
- [ ] Support copy plan to clipboard.
- [ ] Support export plan into a new chat.
- [ ] Support handoff to another agent.
- [ ] Store plans in `.context`.
- [ ] Use distinct icons for plan approval and user-input states.
- [ ] Add/update regression tests and manual verification note.

### `#91`
- [ ] Trigger slash autocomplete from `/`.
- [ ] Support fuzzy search across commands.
- [ ] Include `/clear`, `/compact`, `/restart`, and `/add-dir`.
- [ ] Support plugin-installed commands.
- [ ] Support autocomplete anywhere in the message.
- [ ] Show invalid slash command errors in chat.
- [ ] Support commands with file attachments.
- [ ] Add/update regression tests and manual verification note.

### `#110`
- [ ] Add global agent instructions in settings.
- [ ] Add per-repository custom review prompts.
- [ ] Add per-repository custom PR creation prompts.
- [ ] Add per-repository custom branch naming prompts.
- [ ] Send instructions to the agent on startup.
- [ ] Send permission mode changes to Claude in real time.
- [ ] Add/update regression tests and manual verification note.

### `#117`
- [ ] Ensure the picker exposes all available models.
- [ ] Allow default model changes from the picker.
- [ ] Support number-key quick switching.
- [ ] Support keyboard navigation in the picker.
- [ ] Preserve model selection when forking sessions.
- [ ] Make mid-session switching instant.
- [ ] Add PR cheap-model control.
- [ ] Add fast-mode toggle.
- [ ] Add/update regression tests and manual verification note.

## Integration and closeout

1. Merge issue branches into `codex/wave8-merge`.
2. Run focused frontend and server validation on the merge branch.
3. Do a cleanup pass for regressions and merge conflicts.
4. Merge the integration branch to `main` only if `main` is clean.
5. Close any fully completed GitHub issue and leave a final comment with branch, commit, tests, and manual verification note.
