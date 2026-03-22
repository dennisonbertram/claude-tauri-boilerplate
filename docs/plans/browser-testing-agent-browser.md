# Browser Testing Process: agent-browser

## Feature Description

Switch the project's default browser testing process from the Playwright MCP preset to the `agent-browser` CLI. Keep `agentation` documented as a separate visual-feedback MCP tool, not a replacement for `agent-browser`.

## Acceptance Criteria

- The default `/browser` workflow prompt tells users to use `agent-browser`.
- The browser testing runbook documents the `agent-browser` setup and testing loop.
- The MCP settings UI no longer presents Playwright as the default browser testing preset.
- Project instructions explicitly note that `agentation` is separate from `agent-browser`.
- Targeted tests pass for the updated desktop workflow text and MCP preset UI.

## Checklist

- [x] Update the desktop `/browser` workflow prompt to use `agent-browser`.
- [x] Update the browser automation runbook and index descriptions.
- [x] Update the MCP settings presets to remove the Playwright-first browser testing flow.
- [x] Update agent instructions to use `agent-browser` for frontend manual testing.
- [x] Add an engineering log entry for the process change.
- [x] Run targeted tests for the changed desktop workflow and MCP preset behavior.
