# Generative UI Foundation, Live First

## Summary

This slice formalizes the existing tool rendering system as a registry-backed generative UI foundation without changing the current live-only behavior in chat. Tool cards still render during active streaming only, but the parsing and sanitization path is now centralized so later persistence work can reuse the same contract.

## What Changed

### Frontend foundation

- Added `apps/desktop/src/components/chat/gen-ui/registry.ts` as the single tool-name to renderer registry.
- Added `apps/desktop/src/components/chat/gen-ui/defaultRenderers.tsx` to register built-in renderers for `Bash`, `Read`, `Edit`, `Write`, `Grep`, `Glob`, `WebSearch`, `WebFetch`, and `NotebookEdit`.
- Added `apps/desktop/src/components/chat/gen-ui/toolData.ts` for:
  - streamed tool input parsing with `empty | partial | parsed | invalid` states
  - string sanitization for rendered text
  - URL sanitization
  - recursive tool result sanitization
  - generic input/result formatting helpers for fallback rendering

### Routing refactor

- `ToolCallBlock.tsx` no longer hardcodes tool routing.
- The component now:
  - looks up a registered renderer by tool name
  - renders the registered component when found
  - falls back to a sanitized generic expandable block for unknown tools
- Bash-specific CI failure actions moved into a registry-backed Bash renderer so `ToolCallBlock` stays generic.

### Existing displays migrated

The existing specialized displays now consume the shared `gen-ui/toolData.ts` parser/sanitizer contract instead of local JSON parsing:

- `FileReadDisplay.tsx`
- `FileEditDisplay.tsx`
- `FileWriteDisplay.tsx`
- `GrepDisplay.tsx`
- `GlobDisplay.tsx`
- `WebSearchDisplay.tsx`
- `WebFetchDisplay.tsx`
- `NotebookEditDisplay.tsx`

## Persistence Path

This slice intentionally does **not** persist generative UI into session history yet. The intended durable model is:

- Do not store renderer payloads inside `messages.content`.
- Persist future generative UI artifacts separately from plain chat messages.
- Key durable artifacts by `session_id + tool_use_id + renderer_name`.
- Treat updates as replacement of the current artifact version for that logical card, not as appended assistant text.

The current `toolData.ts` helpers were written as pure functions so the same parsing/sanitization logic can be reused later from backend serialization or hydration code.

## Verification

### Automated

- `pnpm --filter @claude-tauri/desktop exec vitest run src/components/chat/gen-ui/registry.test.tsx src/components/chat/gen-ui/toolData.test.ts src/components/chat/ToolCallBlock.test.tsx src/components/chat/__tests__/FileOperations.test.tsx src/components/chat/__tests__/SearchDisplay.test.tsx src/components/chat/__tests__/WebSearchDisplay.test.tsx src/components/chat/__tests__/WebFetchDisplay.test.tsx src/components/chat/__tests__/NotebookEditDisplay.test.tsx`
- `pnpm --filter @claude-tauri/desktop test`
- `pnpm test`

### Manual

- Verified the existing frontend and server dev processes were available on `localhost:1420` and `localhost:3131`.
- Launched the Tauri shell with `pnpm tauri dev` in tmux session `codex-gen-ui-tauri`; the shell built and started successfully.
- Browser automation against the Vite app could not be completed because the local Playwright Chrome launcher failed immediately with `Opening in existing browser session.` before a page context was created.

## Notes

- `apps/desktop/src/test-setup.ts` now re-registers the built-in renderer registry before each test so `ToolCallBlock` integration tests remain stable.
- No backend routes, database schema, or `ToolCallState` shape were changed in this slice.
