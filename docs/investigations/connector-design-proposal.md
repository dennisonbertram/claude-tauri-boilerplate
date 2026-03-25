# Connector/Tool Architecture for Claude Tauri Desktop App

## Research Date: 2025-03-24

## Executive Summary

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) provides a first-class `createSdkMcpServer()` function that lets you define tools as plain TypeScript functions running **in the same Bun process** — no subprocesses, no external servers, no MCP protocol overhead on the wire. This is the recommended approach for bundling ~22 connectors in the app.

---

## 1. How the SDK Handles Tools

### The `query()` function signature

```typescript
query({ prompt: string, options?: Options }): Query
```

The `Options` type accepts:

| Option | Type | Purpose |
|--------|------|---------|
| `tools` | `string[] \| { type: 'preset', preset: 'claude_code' }` | Controls which **built-in** tools are available (Read, Write, Bash, etc.). NOT for custom tools. |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP server configs — stdio, HTTP, SSE, **or SDK in-process** |
| `allowedTools` | `string[]` | Auto-allow specific tool names without permission prompts |
| `disallowedTools` | `string[]` | Block specific tools |

**Key finding:** The `tools` option only controls Claude Code's built-in tools. You **cannot** pass raw Anthropic API-style tool definitions (like `{ name, description, input_schema }`) directly. All custom tools must go through MCP servers.

### McpServerConfig union type

```typescript
type McpServerConfig =
  | McpStdioServerConfig              // { type: 'stdio', command, args, env }
  | McpSSEServerConfig                // { type: 'sse', url, headers }
  | McpHttpServerConfig               // { type: 'http', url, headers }
  | McpSdkServerConfigWithInstance    // { type: 'sdk', name, instance: McpServer }  <-- THIS ONE
```

The `McpSdkServerConfigWithInstance` type is the key — it holds a live `McpServer` instance running in-process.

---

## 2. The `createSdkMcpServer()` API (Recommended Approach)

The SDK exports a helper that creates an in-process MCP server:

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';

const weatherServer = createSdkMcpServer({
  name: 'weather',
  version: '1.0.0',
  tools: [
    tool(
      'get_weather',
      'Get current weather for a location',
      { location: z.string().describe('City name') },
      async ({ location }) => ({
        content: [{ type: 'text', text: JSON.stringify(await fetchWeather(location)) }]
      })
    )
  ]
});

// Pass to query():
const stream = query({
  prompt: 'What is the weather in NYC?',
  options: {
    mcpServers: {
      weather: weatherServer  // type: 'sdk', instance: McpServer
    }
  }
});
```

### How it works internally

1. `createSdkMcpServer()` returns `{ type: 'sdk', name: string, instance: McpServer }`
2. The SDK connects to this `McpServer` instance via in-memory transport (no stdio, no HTTP)
3. The `McpServer` is from `@modelcontextprotocol/sdk/server/mcp.js` — the standard MCP server class
4. Tool handlers are plain async functions receiving parsed Zod-validated args
5. Return type is `CallToolResult` from `@modelcontextprotocol/sdk/types.js`

### The `tool()` helper

```typescript
type SdkMcpToolDefinition<Schema> = {
  name: string;
  description: string;
  inputSchema: Schema;           // Zod schema (v3 or v4)
  annotations?: ToolAnnotations; // MCP tool annotations
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>;
};

// Convenience function:
function tool(name, description, inputSchema, handler, extras?): SdkMcpToolDefinition;
```

---

## 3. Approach Comparison

### A. stdio MCP subprocess (current `.mcp.json` approach)

```
+----------+  stdio  +--------------+
| SDK      |<------->| MCP Server   |  (separate process)
| (Bun)    |         | (Node/Bun)   |
+----------+         +--------------+
```

- **Pros:** Standard protocol, isolation, can use npm packages as-is
- **Cons:** 22 subprocesses = ~22 Node/Bun processes = high memory (~50-100MB each), slow startup, process management complexity
- **Verdict:** Terrible for 22 bundled connectors

### B. HTTP/SSE MCP on sidecar

```
+----------+  HTTP  +---------------+
| SDK      |<------>| Hono routes   |  (same sidecar process)
| (Bun)    |        | /mcp/...      |
+----------+        +---------------+
```

- **Pros:** Single process, tools are just Hono handlers
- **Cons:** HTTP overhead, need to implement MCP HTTP transport, SDK spawns a child process so the HTTP would loop back
- **Verdict:** Unnecessary complexity — the SDK already supports in-process

### C. `createSdkMcpServer()` in-process (RECOMMENDED)

```
+-------------------------------+
| Bun sidecar process           |
|                               |
|  query() <--> McpServer       |  (in-memory transport)
|               |-- gmail tools |
|               |-- calendar    |
|               |-- weather     |
|               +-- ...         |
+-------------------------------+
```

- **Pros:** Zero process overhead, zero network overhead, tools are plain TS functions, Zod validation built in, single process, fast
- **Cons:** All tools share the Bun process (but that is fine — they are just API calls)
- **Verdict:** Perfect fit for bundled connectors

### D. Direct tool injection (raw Anthropic API style)

- **Not supported.** The `tools` option on `query()` only accepts built-in tool names or the `claude_code` preset. There is no way to pass `{ name, description, input_schema }` tool definitions directly.
- The SDK is opinionated: all custom tools go through MCP.

---

## 4. What Claude Code Does Internally

Claude Code's built-in tools (Read, Write, Bash, Grep, Glob, Edit, etc.) are **NOT** MCP servers. They are native tools baked into the Claude Code runtime. The `sdk-tools.d.ts` file defines their input/output schemas (BashInput, FileReadInput, etc.).

These tools are controlled via the `tools` option:
- `tools: ['Bash', 'Read', 'Edit']` — only these built-in tools
- `tools: { type: 'preset', preset: 'claude_code' }` — all built-in tools
- `tools: []` — no built-in tools (MCP-only mode)

MCP servers (configured via `mcpServers`) provide **additional** tools on top of the built-in ones.

---

## 5. Recommended Architecture

### Single SDK MCP Server with All Connectors

Create ONE `createSdkMcpServer()` with all ~22 connectors' tools registered:

```typescript
// apps/server/src/services/connectors/index.ts
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';

import { gmailTools } from './gmail';
import { calendarTools } from './calendar';
import { weatherTools } from './weather';
import { contactsTools } from './contacts';
// ... etc

export function createConnectorServer() {
  return createSdkMcpServer({
    name: 'app-connectors',
    version: '1.0.0',
    tools: [
      ...gmailTools,
      ...calendarTools,
      ...weatherTools,
      ...contactsTools,
      // ... all 22 connectors
    ]
  });
}
```

Each connector is a module that exports an array of `SdkMcpToolDefinition`:

```typescript
// apps/server/src/services/connectors/weather.ts
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';

export const weatherTools = [
  tool(
    'weather_current',
    'Get current weather for a location',
    { location: z.string(), units: z.enum(['metric', 'imperial']).optional() },
    async ({ location, units }) => {
      const data = await fetch(`https://api.weather.com/...`);
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  ),
  tool(
    'weather_forecast',
    'Get weather forecast',
    { location: z.string(), days: z.number().min(1).max(7) },
    async ({ location, days }) => {
      // ...
      return { content: [{ type: 'text', text: JSON.stringify(forecast) }] };
    }
  ),
];
```

### Integration with existing `streamClaude()`

In `claude.ts`, merge the bundled connector server with user-configured MCP servers:

```typescript
import { createConnectorServer } from './connectors';

const connectorServer = createConnectorServer();

// In streamClaude(), when building queryOptions:
const allMcpServers = {
  ...userConfiguredMcpServers,       // from .mcp.json / session overrides
  'app-connectors': connectorServer, // bundled connectors (in-process)
};

queryOptions.mcpServers = allMcpServers;
```

### Alternative: Multiple SDK MCP Servers (by category)

If 22 connectors in one server feels unwieldy, group them:

```typescript
const mcpServers = {
  ...userMcpServers,
  'communication': createSdkMcpServer({
    name: 'communication',
    tools: [...gmailTools, ...smsTools, ...whatsappTools]
  }),
  'productivity': createSdkMcpServer({
    name: 'productivity',
    tools: [...calendarTools, ...notesTools, ...contactsTools]
  }),
  'media': createSdkMcpServer({
    name: 'media',
    tools: [...musicTools, ...photosTools]
  }),
  'finance': createSdkMcpServer({
    name: 'finance',
    tools: [...bankingTools]
  }),
  'utilities': createSdkMcpServer({
    name: 'utilities',
    tools: [...weatherTools]
  }),
};
```

This is purely organizational — all servers run in the same process either way.

---

## 6. Connector Implementation Pattern

Each connector follows this structure:

```
apps/server/src/services/connectors/
  index.ts              # createConnectorServer() — assembles all tools
  types.ts              # Shared types
  gmail/
    index.ts            # exports gmailTools: SdkMcpToolDefinition[]
    auth.ts             # OAuth token management
    api.ts              # Gmail API client
  calendar/
    index.ts
    auth.ts
    api.ts
  weather/
    index.ts            # Simple API-key connector, no auth
  ...
```

### Auth Pattern

For OAuth-based connectors (Gmail, Calendar, etc.), the Tauri frontend handles the OAuth flow (opening browser, receiving callback). Tokens are stored in the SQLite database. The connector tools retrieve tokens from the DB at call time.

For API-key connectors (Weather, etc.), keys are stored in app settings or environment variables.

---

## 7. Dynamic Server Management via `setMcpServers()`

The `Query` object also exposes:

```typescript
query.setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>
```

This allows dynamically adding/removing MCP servers mid-conversation. Useful for:
- Enabling a connector after the user authenticates mid-session
- Hot-reloading connector configurations
- Adding connectors on demand rather than all at startup

---

## 8. Key Considerations

### Tool Naming
With all connectors in one or a few servers, use prefixed tool names to avoid collisions:
- `gmail_send`, `gmail_search`, `gmail_read`
- `calendar_list_events`, `calendar_create_event`
- `weather_current`, `weather_forecast`

### Timeout
The SDK docs note: "If your SDK MCP calls will run longer than 60s, override `CLAUDE_CODE_STREAM_CLOSE_TIMEOUT`". Some connectors (file uploads, batch operations) might need this.

### Error Handling
Tool handlers should return errors in the MCP format:
```typescript
return { content: [{ type: 'text', text: 'Error: ...' }], isError: true };
```

### Tool Annotations
MCP tool annotations can signal behavior to the model:
```typescript
tool('gmail_send', 'Send an email', schema, handler, {
  annotations: { destructiveHint: true }  // tells Claude this modifies state
})
```

### Per-Session Connector Toggle
The existing `session_mcp_overrides` system plus `disallowedTools` on `query()` can control which connectors are active per session. When a user disables a connector in the UI, its tool names are added to `disallowedTools` for that session's queries.

---

## 9. Decision Matrix

| Approach | Process overhead | Network overhead | Implementation cost | Supports 22 connectors |
|----------|-----------------|------------------|--------------------|-----------------------|
| stdio subprocesses | 22 processes | stdio pipes | Low (standard) | Poorly |
| HTTP MCP on sidecar | None | HTTP loopback | Medium | Yes |
| Direct tool injection | None | None | N/A | **Not supported by SDK** |
| **`createSdkMcpServer()` in-process** | **None** | **None (in-memory)** | **Low** | **Yes** |

## 10. Final Recommendation

Use `createSdkMcpServer()` + `tool()` from `@anthropic-ai/claude-agent-sdk`. It is purpose-built for this exact use case:

- Tools are plain async TypeScript functions
- Zod validation on inputs
- Runs in the same Bun process (zero subprocesses)
- In-memory transport (zero network overhead)
- Compatible with the existing `mcpServers` option on `query()`
- Can be merged alongside user-configured external MCP servers from `.mcp.json`
- Dynamic add/remove via `setMcpServers()` mid-conversation

The implementation cost is minimal — each connector is just a module exporting an array of tool definitions. No MCP protocol knowledge required beyond the `tool()` helper and `CallToolResult` return type.

---

## Source Files Referenced

- `apps/server/src/services/claude.ts` — current `streamClaude()` and `query()` call site
- `apps/server/src/services/mcp-resolver.ts` — current MCP server resolution
- `apps/server/src/services/mcp-config.ts` — `.mcp.json` reading/writing
- `apps/server/src/routes/chat-streaming.ts` — streaming context and session management
- `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` — SDK type definitions (source of truth for `Options`, `McpServerConfig`, `createSdkMcpServer`, `tool`, `SdkMcpToolDefinition`)
