# Issue 112 Browser Automation Testing

## Automated

Passed:

- `pnpm --filter @claude-tauri/desktop exec vitest run src/components/__tests__/McpPanel.test.tsx src/components/chat/__tests__/BrowserAutomationDisplay.test.tsx src/lib/workflowPrompts.test.ts`
- `pnpm --filter @claude-tauri/desktop exec vitest run src/components/chat/ToolCallBlock.test.tsx src/components/settings/SettingsPanel.test.tsx`
- `pnpm --filter @claude-tauri/server exec bun test src/routes/mcp.test.ts`

Known unrelated failures in this branch:

- `pnpm --filter @claude-tauri/desktop test`
  - fails in `src/components/__tests__/StatusBar.test.tsx` because `show-resource-usage-toggle` is missing
- `pnpm --filter @claude-tauri/desktop build`
  - fails on multiple pre-existing TypeScript issues unrelated to issue `#112`

## Manual

Validated:

- Started this worktree frontend in tmux on `http://localhost:1420`
- Started this worktree server in tmux on `http://localhost:3131`
- `curl http://localhost:3131/api/mcp/servers` returned the repo-root `playwright` and `agentation` entries with the expected Chrome/video arguments
- `POST /api/mcp/servers` duplicate protection returns `409` for `playwright`
- In the live desktop app, Settings -> MCP shows the Playwright Browser and Agentation presets as installed with the expected command lines and Chrome/video arguments
- In the live desktop app, Settings -> Workflows exposes the new Browser Testing Prompt used by `/browser`, including the testing workflow, screenshot/console expectations, and artifact path guidance
- Browser automation in this environment is functional again after clearing the stale Chrome profile earlier in the wave, so the machine-level browser-launch blocker is no longer present
