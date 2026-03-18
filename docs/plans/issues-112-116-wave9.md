# Wave 9 Plan (Issues #112, #113, #114, #115, #116)

## Goal

Complete a five-issue wave for the next open feature batch and land the finished work through a single integration branch.

## Scope

1. `#112` Browser automation: Claude can use Chrome to test and screenshot
2. `#113` Custom appearance: fonts, themes, and accent colors
3. `#114` Multi-repo editing with `/add-dir`
4. `#115` AI memory: update memory from review feedback
5. `#116` CPU and memory usage display

## Constraints

- Start from `main` and integrate via `codex/wave9-merge`.
- Use isolated git worktrees, one branch per issue.
- Use tmux-backed Codex subagents for parallel implementation.
- Follow TDD in each issue worktree.
- Add or update handoff docs in `docs/plans/` with manual verification notes.
- Keep this plan and `docs/plans/INDEX.md` current during the wave.

## Worktrees

- `codex/issue-112-wave9`
- `codex/issue-113-wave9`
- `codex/issue-114-wave9`
- `codex/issue-115-wave9`
- `codex/issue-116-wave9`
- integration branch: `codex/wave9-merge`

## Checklist

### `#112`
- [ ] Pull live issue details and inspect current browser/testing integrations.
- [ ] Add failing tests for browser automation workflow support.
- [ ] Implement launch, interaction, screenshot, content/console reads, and testing-flow integration.
- [ ] Add/update handoff doc with manual verification notes.

### `#113`
- [ ] Pull live issue details and inspect appearance/settings architecture.
- [ ] Add failing tests for appearance settings persistence and DOM application.
- [ ] Implement a bounded MVP with persisted theme, accent color, monospace chat, chat density, and chat width controls.
- [ ] Apply the selected appearance settings in the chat surface and document theme/root variables.
- [ ] Add/update handoff doc with manual verification notes.

### `#114`
- [ ] Pull live issue details and inspect current `/add-dir` and workspace directory support.
- [ ] Add failing tests for multi-repo editing behavior.
- [ ] Implement multi-directory workspace support and repo-aware search/settings behavior.
- [ ] Add/update handoff doc with manual verification notes.

### `#115`
- [ ] Pull live issue details and inspect memory/review/merge flows.
- [ ] Add failing tests for update-memory prompts and persistence.
- [ ] Implement memory update prompts and future-session reuse.
- [ ] Add/update handoff doc with manual verification notes.

### `#116`
- [ ] Pull live issue details and inspect status/settings/process management/log handling.
- [ ] Add failing tests for diagnostics toggle and resource display.
- [ ] Implement CPU/memory display plus idle-process/log cleanup behavior.
- [ ] Add/update handoff doc with manual verification notes.

## Integration and closeout

1. Merge issue branches into `codex/wave9-merge`.
2. Run focused frontend/server validation on the merge branch.
3. Do a cleanup pass for red tests and integration conflicts.
4. Mark worked GitHub issues with status comments and final branch/commit references.
5. Merge to `main` only if `main` is clean.
