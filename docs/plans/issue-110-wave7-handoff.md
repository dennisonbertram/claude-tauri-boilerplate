# Issue #110 Wave 7 Handoff

## Status

Partial. The wave adds backend support for startup instruction injection from `CLAUDE.md` files and an optional `systemPrompt` field in chat requests, but the broader settings UI and per-repository customization workflow described in the original issue remain open.

## What landed

- Global instruction loading from `CLAUDE_GLOBAL_INSTRUCTION_PATH` or the default Claude Code instructions path.
- User instruction loading from `CLAUDE_USER_INSTRUCTION_PATH` or `~/.claude/CLAUDE.md`.
- Workspace instruction precedence so a repository root `CLAUDE.md` wins over `./.claude/CLAUDE.md`.
- Startup prompt ordering that places global, user, workspace, and system prompt blocks before the user message.
- Regression coverage for instruction precedence and system prompt ordering in `apps/server/src/routes/chat-workspace.test.ts`.

## Manual verification note

Use the desktop app against a workspace that contains both `CLAUDE.md` and `./.claude/CLAUDE.md`, send a chat message, and confirm there are no console errors and the response reflects the expected instruction precedence. For a quick backend smoke check, verify the chat request path still returns `200` when the prompt includes a `systemPrompt`.

## Handoff guidance

- Keep this issue labeled `partially-done`.
- Do not rework the prompt assembly from scratch; extend the current startup prompt helper if new instruction sources are added later.
- If the settings UI for custom prompts lands later, layer it on top of the existing startup prompt assembly rather than replacing it.
