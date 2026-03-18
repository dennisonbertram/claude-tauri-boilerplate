# Issue 112 Browser Automation Implementation

## Summary

Issue `#112` is implemented through a Playwright MCP default plus desktop UX that makes browser automation discoverable and readable inside the app.

## What Changed

- Added a repo-root `playwright` MCP server entry in `.mcp.json` that launches `@playwright/mcp@latest` with Chrome, saved sessions, and browser artifact output under `.claude/browser-artifacts`.
- Added browser automation presets to Settings > MCP so the user can install Playwright Browser and Agentation with one click.
- Added a dedicated browser tool renderer that recognizes Chrome/Playwright tool names and renders screenshots, recordings, page text, and console output as structured UI.
- Updated the default `/browser` workflow prompt so it points to the Playwright preset, artifact directory, and expected testing steps.
- Fixed the MCP backend router so it resolves the repo-root `.mcp.json` even when the server process starts from `apps/server`, which matches the monorepo dev layout.

## Validation

- Desktop targeted tests cover the MCP preset cards, browser-specific tool rendering, `/browser` prompt wiring, and Settings integration.
- Server targeted tests cover repo-root `.mcp.json` resolution and write behavior when the backend launches from `apps/server`.
- Manual verification confirmed the repo-root MCP config is served from `/api/mcp/servers`, the live Settings -> MCP panel shows the Playwright Browser and Agentation presets as installed, and the Workflows tab exposes the new Browser Testing Prompt guidance for `/browser`.

## Files

- `.mcp.json`
- `.gitignore`
- `apps/desktop/src/components/settings/McpPanel.tsx`
- `apps/desktop/src/components/chat/BrowserAutomationDisplay.tsx`
- `apps/desktop/src/components/chat/ToolCallBlock.tsx`
- `apps/desktop/src/lib/workflowPrompts.ts`
- `apps/server/src/routes/mcp.ts`
