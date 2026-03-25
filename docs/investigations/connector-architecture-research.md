# Connector & Architecture Research

## Overall Architecture

This is a **Tauri desktop app** with a **Bun server sidecar** backend. The frontend is a Vite + React app; the backend is a Hono HTTP server running on Bun with embedded SQLite (`bun:sqlite`).

### Startup Flow
1. Tauri launches the Bun server as a sidecar process (`apps/desktop/src/lib/sidecar.ts`)
2. A random port and ephemeral bearer token are generated per launch
3. The frontend polls `/api/health` until the server is ready
4. All subsequent API calls use `apiFetch()` from `apps/desktop/src/lib/api-config.ts` which adds the bearer token

### Key Directories
- `apps/server/` -- Bun/Hono backend (routes, services, DB)
- `apps/desktop/` -- Vite/React frontend (Tauri shell)
- `packages/shared/` -- Shared TypeScript types between frontend and backend
- `packages/pdf-forms/` -- PDF form processing library (independent)

---

## 1. Sessions Model

### Database Schema (`apps/server/src/db/schema.ts`)
```
sessions table:
  id TEXT PRIMARY KEY
  title TEXT NOT NULL DEFAULT 'New Chat'
  claude_session_id TEXT           -- Claude SDK session ID for resume
  model TEXT                       -- e.g. 'claude-sonnet-4-6'
  workspace_id TEXT                -- optional link to a workspace
  profile_id TEXT                  -- optional link to an agent profile
  linear_issue_id TEXT             -- optional Linear issue link
  linear_issue_title TEXT
  linear_issue_summary TEXT
  linear_issue_url TEXT
  created_at TEXT
  updated_at TEXT

messages table:
  id TEXT PRIMARY KEY
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant'))
  content TEXT NOT NULL
  created_at TEXT
```

### Session Lifecycle (`apps/server/src/db/db-sessions.ts`, `apps/server/src/routes/sessions.ts`)
- **Creation**: `POST /api/sessions` -- generates UUID, random name via `name-generator`, optional model and profileId
- **Listing**: `GET /api/sessions?q=...` -- full-text search across titles and message content, includes profile summary and message count
- **Rename**: `PATCH /api/sessions/:id` -- manual rename
- **Auto-name**: `POST /api/sessions/:id/auto-name` -- uses Claude to generate title from messages (respects privacy mode)
- **Fork**: `POST /api/sessions/:id/fork` -- copies messages up to an index into a new session
- **Export**: `GET /api/sessions/:id/export?format=json|md`
- **Delete**: `DELETE /api/sessions/:id`
- **Messages**: `GET /api/sessions/:id/messages`
- **Summary**: `GET /api/sessions/:id/summary` -- AI-generated context summary

### Session-Claude Binding
- Each session stores a `claude_session_id` which is the Claude SDK's session ID
- This enables **conversation resume** -- subsequent messages in the same session continue the SDK conversation
- If a session has messages but no `claude_session_id` (e.g., forked), prior messages are injected as `<previous_conversation>` context
- Stale session IDs are auto-detected and retried without resume

### Frontend Hook (`apps/desktop/src/hooks/useSessions.ts`)
- `useSessions()` manages session state via React hooks
- Uses `apiFetch()` for all API calls
- Provides: `sessions`, `activeSessionId`, `createSession`, `deleteSession`, `renameSession`, `forkSession`, `exportSession`, `fetchMessages`, `autoNameSession`

---

## 2. Claude API Integration

### Core Service (`apps/server/src/services/claude.ts`)
- Uses `@anthropic-ai/claude-agent-sdk` -- specifically the `query()` function
- **NOT** the raw Anthropic Messages API -- this uses the Claude Code Agent SDK
- `streamClaude()` is an async generator yielding `StreamEvent` objects

### SDK Call Pattern
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: options.prompt,
  options: {
    includePartialMessages: true,
    resume: sessionId,       // for conversation continuity
    model: 'claude-sonnet-4-6',
    effort: 'high',
    permissionMode: 'default',
    cwd: workspaceCwd,
    additionalDirectories: [...],
    env: sdkRequestEnv,      // provider-scoped env snapshot
    // Agent profile overrides:
    systemPrompt: { type: 'preset', preset: 'claude_code', append: '...' },
    allowedTools: [...],
    disallowedTools: [...],
    mcpServers: {...},       // per-profile MCP config
    hooks: {...},
    sandbox: {...},
    agents: {...},           // sub-agent definitions
    settingSources: [],
    maxTurns: N,
    maxBudgetUsd: N,
  },
});
```

### Event Mapping (`apps/server/src/services/event-mapper.ts`)
Raw SDK events are mapped to typed `StreamEvent` union. Key event types:
- `system.init` -> `session:init` (sessionId, model, tools list, mcpServers, slashCommands)
- `stream_event.content_block_delta` -> `text:delta`, `thinking:delta`, `tool-input:delta`
- `system.permission_request` -> `permission:request`
- `system.task_started/progress/notification` -> `task:started/progress/notification` (subagents)
- `system.hook_started/progress/response` -> `hook:started/progress/response`
- `system.plan_start/content/complete` -> `plan:start/content/complete`
- `result` -> `session:result` (cost, usage, duration)
- `tool_progress` -> `tool:progress`

### Streaming Architecture (`apps/server/src/routes/chat-streaming.ts`)
- `buildStreamExecute()` creates the callback for AI SDK's `createUIMessageStream`
- Handles: session creation/resume, prompt building, Linear/GitHub issue context injection, workspace notes, attachment resolution
- Uses AI SDK v6 protocol: `writer.write({ type: 'start' })`, `text-start`, `text-delta`, `text-end`, `finish`
- Custom events sent via `data-stream-event` channel for the frontend's custom event handler

### System Prompt Construction (`apps/server/src/routes/chat-helpers.ts`)
`buildStartupPrompt()` reads from 4 instruction files in order:
1. Global instruction (system-wide CLAUDE.md)
2. User instruction (`~/.claude/CLAUDE.md`)
3. Workspace instruction (project CLAUDE.md)
4. Custom system prompt (from chat request or agent profile)

### Provider Configuration (`packages/shared/src/runtime-capabilities.ts`, `apps/server/src/services/sdk-env.ts`)
- Supports 4 providers: `anthropic`, `bedrock`, `vertex`, `custom`
- `buildSdkRequestEnv()` creates a request-scoped env snapshot (does NOT mutate `process.env`)
- Provider config maps to env vars: `ANTHROPIC_API_KEY`, `CLAUDE_CODE_USE_BEDROCK`, `ANTHROPIC_BASE_URL`, etc.

---

## 3. MCP Server Configuration

### Backend (`apps/server/src/routes/mcp.ts`)
CRUD operations for MCP servers stored in `.mcp.json`:

- `GET /api/mcp/servers` -- list all servers
- `POST /api/mcp/servers` -- add new server
- `PUT /api/mcp/servers/:name` -- update server config
- `DELETE /api/mcp/servers/:name` -- remove server
- `PATCH /api/mcp/servers/:name/toggle` -- enable/disable

### .mcp.json Format
```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "agentation-mcp", "server"],
      "env": { "KEY": "value" },
      "disabled": true
    }
  }
}
```

### MCP Config Discovery
`getMcpConfigRoot()` walks up from `process.cwd()` to find the workspace root (monorepo root with `package.json` containing `workspaces`), then looks for `.mcp.json` there.

### Internal Server Filtering
Servers named `claude-code`, `claude`, or using the `claude` command are marked as `isInternal` and hidden from the user-facing UI.

### Frontend Components

**Settings panel** (`apps/desktop/src/components/settings/McpPanel.tsx`):
- Full CRUD UI for MCP servers
- Preset installation (currently only "Agentation Visual Feedback")
- Toggle enable/disable
- Edit server configuration

**Presets** (`apps/desktop/src/components/settings/mcp/types.ts`):
```typescript
export interface McpPreset {
  id: string;
  title: string;
  description: string;
  config: Omit<McpServerConfig, 'enabled'> & { enabled?: boolean };
}
```
Currently only one preset: `agentation` (visual feedback tool).

**Status pill** (`apps/desktop/src/components/chat/McpStatusPill.tsx`):
- Compact green dot + count shown in chat composer toolbar
- Dropdown lists active server names
- Only shows non-internal, enabled servers

**Hook** (`apps/desktop/src/hooks/useMcpServers.ts`):
- `useMcpServers()` -- fetches servers on mount, exposes `servers`, `visibleEnabledServers`, `loading`

**Agent Builder MCP Tab** (`apps/desktop/src/components/agent-builder/tabs/McpTab.tsx`):
- Per-profile MCP server configuration (stored as `mcpServersJson` in the agent profile)
- Uses the same `{ mcpServers: { ... } }` JSON format
- Servers configured here are passed to the SDK at query time via `buildProfileQueryOptions()`

### MCP in Claude SDK Integration
When an agent profile has `mcpServersJson`, it's parsed and passed as `opts.mcpServers` to the `query()` call. The Claude Code SDK handles the actual MCP server lifecycle (spawning stdio processes, connecting to HTTP/SSE endpoints).

---

## 4. Frontend-Backend Communication

### Transport
- Pure HTTP REST over localhost (no WebSockets)
- Chat uses Server-Sent Events (SSE) via `createUIMessageStreamResponse()` from AI SDK v6
- Bearer token auth on all endpoints except `/api/health`

### API Routes (registered in `apps/server/src/app.ts`)
| Route | Purpose |
|-------|---------|
| `/api/health` | Health check (no auth) |
| `/api/auth` | Authentication status |
| `/api/chat` | Chat streaming (POST, SSE response) |
| `/api/chat/permission` | Permission request/response |
| `/api/chat/plan` | Plan mode decisions |
| `/api/sessions` | Session CRUD + messages + checkpoints |
| `/api/mcp` | MCP server management |
| `/api/hooks` | Hook configuration |
| `/api/instructions` | CLAUDE.md instruction files |
| `/api/memory` | Memory file management |
| `/api/git` | Git operations |
| `/api/linear` | Linear integration |
| `/api/google` | Google OAuth + Gmail/Calendar/Drive |
| `/api/projects` | Project + workspace management |
| `/api/workspaces` | Workspace operations + diff comments + notes + code review |
| `/api/agent-profiles` | Agent profile CRUD |
| `/api/artifacts` | Dashboard artifacts |
| `/api/tracker` | Issue tracker |
| `/api/documents` | Document management |
| `/api/pipeline` | Document processing pipeline |
| `/api/pdf-forms` | PDF form processing |
| `/api/system` | System info |
| `/api/runtime-capabilities` | Provider capabilities |
| `/api/github` | GitHub repo operations |
| `/api/deployment-settings` | Deployment settings |
| `/api/teams` | Agent teams |

### Shared Types (`packages/shared/src/types.ts`)
All API request/response types are defined here and imported by both frontend and backend:
- `Session`, `Message`, `ChatRequest`
- `StreamEvent` (large union of ~25+ event types)
- `McpServerConfig`, `HookConfig`
- `AgentProfile`, `Workspace`, `Project`
- `PermissionRequest`, `PermissionResponse`
- etc.

### Chat Request Flow
1. Frontend sends `POST /api/chat` with `ChatRequest` body (messages, sessionId, model, effort, provider, providerConfig, workspaceId, profileId, systemPrompt, etc.)
2. Server validates request with Zod schemas
3. Resolves workspace context (cwd, additional dirs, linear issue, github issue, notes)
4. Looks up agent profile if profileId provided
5. Creates `UIMessageStream` -> calls `buildStreamExecute()`
6. `buildStreamExecute()` builds prompt, calls `streamClaude()`, writes events to stream
7. Frontend receives SSE events, processes via `useStreamEvents` hook

---

## 5. Agent Profiles

Agent profiles are a key extensibility mechanism stored in the `agent_profiles` table:

### Profile Fields (relevant to connectors/tools)
- `system_prompt` -- custom system prompt
- `use_claude_code_prompt` -- whether to use Claude Code's default prompt as base
- `model`, `effort`, `thinking_budget_tokens` -- model configuration
- `allowed_tools`, `disallowed_tools` -- tool filtering
- `permission_mode` -- default/acceptEdits/plan/bypassPermissions
- `hooks_json` -- hook configuration JSON
- `mcp_servers_json` -- per-profile MCP server configuration
- `sandbox_json` -- sandbox configuration
- `agents_json` -- sub-agent definitions
- `setting_sources` -- which filesystem setting sources to load

### Profile -> SDK Mapping (`buildProfileQueryOptions()` in `claude.ts`)
All profile fields are mapped to SDK `query()` options. This means each agent profile can have its own set of MCP servers, tools, hooks, and sub-agents.

---

## 6. Key Integration Points for Adding Connectors

### Where MCP servers are configured:
1. **Global**: `.mcp.json` at workspace root (managed via Settings > MCP panel)
2. **Per-profile**: `agent_profiles.mcp_servers_json` (managed via Agent Builder > MCP tab)

### Where tools appear in the stream:
- `session:init` event includes `tools: string[]` (list of available tool names) and `mcpServers: Array<{ name: string; status: string }>`
- `block:start` with `blockType: 'tool_use'` includes `toolName` and `toolUseId`
- `tool:progress` shows elapsed time for running tools
- `tool:result` contains the result
- `tool:summary` provides a human-readable summary

### How to add new connector support:
1. **MCP presets**: Add entries to `MCP_PRESETS` in `apps/desktop/src/components/settings/mcp/types.ts`
2. **Global MCP config**: The existing CRUD API (`/api/mcp/servers`) and `.mcp.json` format support all MCP server types (stdio, http, sse)
3. **Per-profile MCP**: Agent profiles already support `mcpServersJson` which is passed directly to the SDK
4. **The Claude Code SDK handles MCP server lifecycle** -- the app does not need to manage MCP connections itself

### Current .mcp.json on this worktree:
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

---

## Summary

| Aspect | Implementation |
|--------|---------------|
| API Framework | Hono (backend), fetch/apiFetch (frontend) |
| Claude Integration | `@anthropic-ai/claude-agent-sdk` `query()` function |
| Database | SQLite via `bun:sqlite` |
| Session Resume | `claude_session_id` stored per session, passed as `resume` to SDK |
| MCP Management | `.mcp.json` file, CRUD API, per-profile JSON field |
| Streaming | AI SDK v6 `createUIMessageStream` + custom `data-stream-event` channel |
| Auth | Random ephemeral bearer token per Tauri launch; subscription-based Anthropic auth |
| Tool System | Fully delegated to Claude Code SDK; app receives tool events via stream |
| Agent Profiles | Full SDK option override including MCP servers, tools, hooks, sub-agents |
