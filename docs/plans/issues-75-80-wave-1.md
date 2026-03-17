# Wave 1 Plan: GitHub Issues 75-80

## Description

Start the first parallel delivery wave for six prioritized GitHub feature requests:

- #75 Forward failing CI checks to Claude for auto-fix
- #76 Support AWS Bedrock, Google Vertex, and custom API providers
- #77 Command palette (Cmd+K) for quick actions
- #78 Linear integration for issue tracking
- #79 File picker, @-mentions, and drag-and-drop file attachments
- #80 Integrated diff viewer with inline commenting

This wave uses six isolated git worktrees so each issue can advance independently without blocking the others. Each worktree must follow TDD, add regression tests for any bugs discovered while implementing, and update the relevant docs indexes.

## Acceptance Criteria

- [ ] Six isolated worktree branches are created with `codex/` prefixes.
- [ ] One subagent is launched per issue, with at most six running in parallel.
- [ ] Each subagent reads the live GitHub issue details before implementing.
- [ ] Each subagent follows TDD: failing test first, implementation second.
- [ ] Each subagent creates or updates a per-issue plan document in `docs/plans/`.
- [ ] Each subagent updates the relevant docs indexes for any new docs files it creates.
- [ ] Each subagent runs the most relevant automated tests before handoff.
- [ ] Each subagent writes a concise markdown artifact in `docs/implementation/` summarizing scope completed, files changed, concrete edits, risks/blockers, and suggested next step.
- [ ] Follow-up integration review decides which branches are ready to merge and which need another pass.

## Worktree Batch

- [ ] Issue #75 worktree launched
- [ ] Issue #76 worktree launched
- [ ] Issue #77 worktree launched
- [ ] Issue #78 worktree launched
- [ ] Issue #79 worktree launched
- [ ] Issue #80 worktree launched

## Review Checklist

- [ ] Collect subagent artifacts from all six worktrees
- [ ] Review each branch for test quality, scope discipline, and doc/index updates
- [ ] Run any needed local verification before merge
- [ ] Merge ready branches back to `main`
- [ ] Clean up merged worktrees
