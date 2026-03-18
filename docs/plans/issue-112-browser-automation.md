# Issue 112 Browser Automation

GitHub issue: `#112`

## Goal

Ship a real browser-automation path so Claude can launch Chrome, inspect pages, capture screenshots and recordings, and use that workflow from the desktop app.

## Acceptance Criteria

- [x] Claude can launch Chrome to test changes
- [x] Claude can take screenshots for visual verification
- [x] Claude can browse pages for research
- [x] Claude can click, type, and scroll
- [x] Claude can read page content and console messages
- [x] Claude can record multi-step interactions as GIF/video artifacts
- [x] Browser automation is integrated into the testing workflow

## Implementation Checklist

- [x] Add regression tests for browser MCP presets in Settings
- [x] Add regression tests for browser tool-call rendering
- [x] Add regression tests for `/browser` workflow guidance
- [x] Add repo-level Playwright MCP configuration for Chrome
- [x] Add browser automation preset install flow in Settings > MCP
- [x] Add specialized browser tool rendering for screenshots, recordings, page text, and console output
- [x] Update `/browser` workflow prompt with concrete testing instructions and artifact paths
- [x] Add regression tests for MCP route repo-root `.mcp.json` resolution
- [x] Fix MCP route so monorepo `apps/server` launches read and write the repo-root config
- [x] Run targeted automated tests
- [x] Perform manual verification as far as the local environment allows
