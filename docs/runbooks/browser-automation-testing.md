# Browser Automation Testing

## Default Setup

The default browser testing workflow now uses the `agent-browser` CLI.

First-time setup:

1. Install the CLI if needed: `npm i -g agent-browser`, `brew install agent-browser`, or `cargo install agent-browser`
2. Install Chrome for the CLI once: `agent-browser install`
3. Write artifacts under `.claude/browser-artifacts/agent-browser/`

`agentation` is a different tool. It remains an optional MCP companion for visual annotations and interaction feedback, but it does not replace `agent-browser`.

## In-App Flow

1. Use `/browser` in chat for the browser-testing prompt template.
2. Run the suggested `agent-browser` commands from Bash.
3. Open the target URL: `agent-browser open http://localhost:1420`
4. Wait for the page to settle: `agent-browser wait --load networkidle`
5. Capture refs before interacting: `agent-browser snapshot -i`
6. Interact with `click`, `fill`, `press`, `scroll`, then re-run `snapshot -i` whenever the page changes.
7. Save artifacts with explicit paths under `.claude/browser-artifacts/agent-browser/`.

## Notes

- Recommended loop:
  `agent-browser open <url> && agent-browser wait --load networkidle && agent-browser snapshot -i`
- Use `agent-browser console` and `agent-browser errors` before finishing a test pass.
- For multi-step flows, use `agent-browser record start .claude/browser-artifacts/agent-browser/<name>.webm` and `agent-browser record stop`.
- Re-snapshot after navigation, form submission, modal open/close, or any DOM change that invalidates refs.
