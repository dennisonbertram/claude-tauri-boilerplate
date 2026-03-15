# Runbook: Agentation Setup and Testing

## What is Agentation?

Agentation is a visual feedback tool for AI coding agents. It overlays an interactive toolbar on your app during development, letting you click elements, annotate the UI, and generate structured feedback that AI agents can consume. This bridges the gap between "what the UI looks like" and "what the agent knows about the UI."

## How It's Installed

Agentation is installed as a **devDependency** in the desktop app:

```
apps/desktop/package.json → devDependencies: "agentation": "^2.3.3"
```

The `<Agentation />` component is rendered in `apps/desktop/src/App.tsx`, gated behind a dev-only check so it never ships in production builds:

```tsx
{import.meta.env.DEV && <Agentation />}
```

This line is inside the `<ErrorBoundary>` in the `App` component, after `<AuthGate>`.

## MCP Server Configuration

Agentation includes an MCP server for AI agent integration. It's configured in the project-local `.mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "agentation": {
      "command": "npx",
      "args": ["-y", "agentation-mcp", "server"],
      "type": "stdio"
    }
  }
}
```

**Important:** Claude Code reads `.mcp.json` at startup. If you add or change this file, you must **restart Claude Code** for it to pick up the new MCP server configuration.

## How to Start

1. Make sure dependencies are installed:
   ```bash
   pnpm install
   ```

2. Start the full dev environment:
   ```bash
   pnpm dev:all
   ```

3. Open `http://localhost:1420` in your browser. The Agentation toolbar should appear overlaid on the app.

## How to Use

1. **Click elements** in the UI to select them. Agentation highlights the selected element and shows its properties.
2. **Annotate** the UI by adding notes, arrows, or highlights to call out specific areas.
3. **Generate feedback** that describes the current UI state in a format AI agents can understand. This is useful for reporting visual bugs, layout issues, or design feedback to agents.

The MCP server (running via `npx agentation-mcp server`) exposes tools that AI agents can call to interact with the Agentation overlay programmatically — for example, reading annotations or getting element details.

## How to Test It's Working

1. Start the dev environment (`pnpm dev:all`).
2. Open `http://localhost:1420` in a browser.
3. Verify the Agentation toolbar appears (it's typically a floating toolbar or overlay).
4. Click on a UI element — it should highlight and show information about the element.
5. If you have Claude Code running with the `.mcp.json` config loaded, check that the `agentation` MCP tools are available.

If the toolbar does not appear:
- Check the browser console for errors related to Agentation.
- Confirm you're in dev mode (not a production build).
- Confirm `agentation` is in `devDependencies` and `pnpm install` was run.

## Notes

- Agentation is **dev-only**. It is tree-shaken out of production builds by the `import.meta.env.DEV` guard.
- The MCP server (`agentation-mcp`) runs on port **4747** by default.
- The MCP server is started via `npx -y agentation-mcp server` — the `-y` flag auto-confirms the npx prompt.
- If Claude Code doesn't show Agentation MCP tools, restart Claude Code so it re-reads `.mcp.json`.
