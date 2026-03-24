# Server PROJECT_ROOT Fixes

## Problem

Several server route files used `process.cwd()` to locate project files (CLAUDE.md, .claude/settings.json, .mcp.json, etc.). This is fragile because `process.cwd()` depends on where the server process was started, not where the project actually lives. In worktree or daemonized scenarios, cwd may not match the project root.

## Solution

Created a shared utility at `apps/server/src/lib/project-root.ts` that exports a single `PROJECT_ROOT` constant. It prefers the `PROJECT_ROOT` env var (set by init.sh) and falls back to resolving from the file's location via `import.meta.dir`.

All server route files now import and use this constant instead of calling `process.cwd()`.

## Files Changed

| File | What changed |
|------|-------------|
| `apps/server/src/lib/project-root.ts` | **Created** -- shared PROJECT_ROOT constant |
| `apps/server/src/routes/instructions.ts` | Replaced 3x `process.cwd()` with `PROJECT_ROOT` |
| `apps/server/src/routes/hooks.ts` | Replaced 2x `process.cwd()` with `PROJECT_ROOT` |
| `apps/server/src/routes/mcp.ts` | Replaced 2x `process.cwd()` with `PROJECT_ROOT` in `getMcpConfigRoot()` |
| `apps/server/src/routes/git.ts` | Replaced fallback `process.cwd()` with `PROJECT_ROOT` in `runGit()` |
| `apps/server/src/routes/chat-helpers.ts` | Replaced `process.cwd()` fallback with `PROJECT_ROOT` in `buildStartupPrompt()` |
| `apps/server/src/routes/memory.ts` | Replaced inline `getProjectRoot()` function with shared `PROJECT_ROOT` import |
| `apps/server/src/routes/plan.ts` | Replaced inline `PROJECT_ROOT` resolution with shared import |

## Notes

- **git.ts**: The `runGit()` helper accepts an optional `cwd` parameter from callers (usually a query param). The `PROJECT_ROOT` is only the fallback when no cwd is provided. This is correct because git operations should default to the project root, not an arbitrary working directory.
- **Test files** still use `process.cwd()` for creating temp directories, which is appropriate since tests run from a known location.
- `memory.ts` and `plan.ts` previously had correct but duplicated inline implementations. They now share the single utility.
