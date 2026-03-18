# Browser Automation Testing

## Default Setup

The repo now includes a default Playwright MCP server in `.mcp.json`:

- command: `npx`
- args: `-y @playwright/mcp@latest --browser chrome --output-dir .claude/browser-artifacts --save-session --save-video=1280x720`

Artifacts are written under `.claude/browser-artifacts/`.

## In-App Flow

1. Open Settings > MCP.
2. Confirm `Playwright Browser` is installed, or install it from the preset card.
3. Use `/browser` in chat for the test flow.
4. Ask Claude to navigate, click, type, scroll, read page text, inspect console messages, take screenshots, and save a recording for multi-step flows.
5. Review the structured tool-call output in chat for screenshots, page text, console output, and recordings.

## Notes

- The browser server records video artifacts directly. If a strict GIF file is needed, convert the saved recording with Bash after the run.
- If the app server is launched from `apps/server`, the MCP API now resolves the repo-root `.mcp.json` automatically.
