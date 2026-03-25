# Claude Code Connector & MCP Architecture Patterns

## Summary

Claude Code implements a multi-layered architecture for managing MCP servers and tool access that separates: configuration (where tools live), permissions (what tools can do), and UI exposure (what users see).

---

## 1. MCP Server Configuration — Four-Tier Scope System

Precedence from highest to lowest:

1. **Managed scope** (server-enforced, cannot be overridden)
2. **Project scope** (`.claude/settings.json` — checked into git)
3. **User scope** (`~/.claude/settings.json`)
4. **Session/worktree** (`.mcp.json` at project root)

### .mcp.json Format
```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "slack": {
      "type": "http",
      "url": "https://your-slack-mcp-endpoint"
    }
  }
}
```

Supports env var expansion: `"url": "${DATABASE_MCP_URL}"`

---

## 2. How Connectors Are Exposed to the Model

### Desktop Connectors UI Flow

1. User opens **Connectors** panel from **+** button next to prompt box
2. User toggles which services to connect (graphical UI with switches)
3. Each connector becomes an MCP server for **that session only**
4. Tools from connected services become available to Claude
5. Session ends → connectors are disconnected

### Tool Naming Convention

Tools from MCP servers get namespaced IDs: `mcp__<server-name>__<tool-name>`

Example from a "github" server:
- `mcp__github__get_repo`
- `mcp__github__create_issue`
- `mcp__github__search_code`

### Session-Level Isolation

**Critical pattern**: Tools are scoped to **sessions**, not globally. Even with 10 MCP servers configured in `.mcp.json`, each session decides which ones are active. This prevents context window bloat, accidental tool use, and security leakage.

---

## 3. Tool Access Control — Three Layers

### A. Permission Rules (Fine-Grained)

```json
{
  "permissions": {
    "allow": [
      "mcp__github",                    // All tools from github server
      "mcp__slack__send_message"         // Specific tool
    ],
    "deny": [
      "mcp__slack__delete_message"       // Block specific tool
    ]
  }
}
```

**Evaluation order** (first match wins): Deny → Ask → Allow → Default (prompt user)

### B. Subagent MCP Scoping

Subagents can have **different MCP servers** than the main conversation:

```yaml
---
name: browser-tester
tools: Read, Bash
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
  - github  # reuses session's server by name
---
```

Inline MCP definitions are **connected only when the subagent runs** and **disconnected when it finishes**.

### C. PreToolUse Hooks (Custom Validation)

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "mcp__slack__send_message",
      "hooks": [{
        "type": "command",
        "command": "./scripts/validate-slack-message.sh"
      }]
    }]
  }
}
```

Exit codes: 0 = approve, 1 = defer to permission system, 2 = reject.

The full chain: **Tool Call → Hook Validation → Permission Check → Execution**

---

## 4. Deferred/Lazy Tool Loading

Claude Code doesn't load all tool descriptions upfront:

- Configured but inactive MCP servers don't inject tool definitions
- Deferred tools are listed by name in a `<system-reminder>` block
- Tool descriptions only fully load when needed
- This keeps the context window small

Example from a real session:
```
<system-reminder>
The following deferred tools are now available via ToolSearch:
mcp__1c38db0d__search_files_keyword
mcp__1c38db0d__get_file_content
...
</system-reminder>
```

---

## 5. Managed Settings (Enterprise Control)

```json
{
  "allowManagedMcpServersOnly": true,
  "allowedMcpServers": ["github", "slack"],
  "deniedMcpServers": ["dangerous-legacy-server"]
}
```

Users cannot override managed settings. Useful for workspace-admin control.

---

## 6. Key Architecture Insights

### Insight 1: Separation of Concerns
Three independent dimensions:
- **Configuration** — where are the MCP servers?
- **Permissions** — what can tools do?
- **UI Exposure** — what does the user see?

A user can configure 10 servers globally, enable 3 in this session, and block specific tools with permission rules.

### Insight 2: Session-First, Not Global-First
Tools are scoped to sessions. Global config is just the **available pool**; each session picks from it.

### Insight 3: Subagent Isolation
Instead of complex permission rules, create subagents with different tool sets:
- "researcher" subagent → read-only tools
- "coder" subagent → all tools
- "database" subagent → only DB MCP servers

### Insight 4: Lazy Loading Is Essential
Loading all tool descriptions into context wastes tokens. Defer loading until actually needed.

---

## 7. Control Mechanism Summary

| Mechanism | Scope | Priority | Use Case |
|-----------|-------|----------|----------|
| Not configured | Global | Highest | Server doesn't exist |
| Managed settings | Organization | High | Enterprise lockdown |
| Permission deny rules | Session | High | Block specific tools |
| Subagent mcpServers | Subagent | Medium | Isolate tools to agents |
| PreToolUse hooks | Session | Medium | Custom validation |
| Permission allow rules | Session | Low | Auto-approve tools |
| Default behavior | Session | Lowest | Prompt user |
