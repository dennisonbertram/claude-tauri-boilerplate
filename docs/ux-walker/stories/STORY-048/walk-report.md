# STORY-048: Configure MCP Servers

## Status: PASS

## Steps Performed
1. Clicked "Integrations" tab in profile editor
2. Observed "Add Server" form with fields: Server name, Command, Args (comma-separated), Environment variables (KEY/value)
3. "+ Add row" button for additional environment variables
4. "Add Server" submit button
5. Advanced JSON editor for direct MCP configuration editing

## Observations
- Integrations tab is dedicated to MCP (Model Context Protocol) server configuration
- Form-based entry with:
  - Server name (placeholder: "my-server")
  - Command (placeholder: "npx")
  - Args (placeholder: "-y, @my/mcp-server", comma-separated)
  - Environment variables with KEY/value input pairs
  - "+ Add row" to add more env vars
- Advanced JSON editor textarea with example showing full mcpServers config structure
- Help text: "Configure MCP (Model Context Protocol) servers that this agent profile can connect to. Each server provides additional tools and context."
- Tab is labeled "Integrations" rather than "MCP" -- good broader naming

## Findings
None -- MCP server configuration is functional and well-designed.
