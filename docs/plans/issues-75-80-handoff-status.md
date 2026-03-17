# Issues 75-80 Handoff Status

Status marker for the first six-issue feature wave so another agent can avoid duplicate work and continue from the correct branch.

## Current State

- Local integration branch: `codex/wave1-merge`
- Branch head: `d09ef7c`
- Scope integrated: issues `#75`, `#76`, `#77`, `#78`, `#79`, and `#80`
- Targeted test status on the integrated branch: passing
- Manual browser-control test notes: added to `docs/implementation/issue-75-wave-1-subagent.md` through `issue-80-wave-1-subagent.md`
- Remaining blocker to landing: local `main` worktree has unrelated uncommitted changes, so this wave was not merged into `main`

## Ticket Marker

Treat the following issues as already worked and locally integrated:

- `#75` Forward failing CI checks to Claude for auto-fix
- `#76` AWS Bedrock, Google Vertex, custom API providers
- `#77` Command palette (Cmd+K)
- `#78` Linear integration
- `#79` File picker, @-mentions, drag-and-drop
- `#80` Integrated diff viewer with inline commenting

Recommended handoff for another agent:

1. Do not restart these six tickets from scratch.
2. Continue from `codex/wave1-merge` if working on adjacent functionality.
3. Land `codex/wave1-merge` after `main` is cleaned, stashed, or committed.

## Next Logical Queue

Highest-value adjacent follow-up issues:

1. `#94` Checks tab: CI, deployments, todos, and PR status in one place
2. `#85` AI code review with customizable prompts
3. `#93` Workspace management: archiving, pinning, forking, and status tracking
4. `#84` Plan mode with interactive questions and feedback
5. `#110` General agent instructions (system prompt customization)

Small adjacent bug cleanups that fit the newly added surfaces:

- `#140` command palette TOOLS section hidden below fold with no scroll indicator
- `#127` Cmd+, shortcut for Settings not wired in ChatPage
- `#120` slash commands `/model`, `/cost`, and `/compact` are no-ops
- `#126` `/compact` slash command is a no-op placeholder
- `#118` Settings tabs overflow with no scroll indicator
