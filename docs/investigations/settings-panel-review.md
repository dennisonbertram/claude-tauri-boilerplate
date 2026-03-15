# Settings Panel Review: Current State & Available Data

Investigation of the current SettingsPanel implementation, what Claude Code CLI's `/status` and `/config` show, and what data is already available through existing API endpoints and stream events.

---

## 1. Current Settings Panel Implementation

### File: `apps/desktop/src/components/settings/SettingsPanel.tsx`

The panel is a 420px-wide slide-in drawer from the right, with an overlay. It has **8 tabs**:

| Tab | Component | Data Source |
|-----|-----------|-------------|
| General | `GeneralTab` (inline) | `useSettings` (localStorage) |
| Model | `ModelTab` (inline) | `useSettings` (localStorage) |
| Appearance | `AppearanceTab` (inline) | `useSettings` (localStorage) |
| Instructions | `InstructionsPanel` | API: `/api/instructions`, `/api/instructions/rules` |
| Memory | `MemoryPanel` | API: `/api/memory`, `/api/memory/search` |
| MCP | `McpPanel` | API: `/api/mcp/servers` |
| Hooks | `HooksPanel` | API: `/api/hooks`, `/api/hooks/events` |
| Advanced | `AdvancedTab` (inline) | `useSettings` (localStorage) |

### What Each Tab Currently Shows

**General Tab:**
- API Key (text input, maskable with show/hide toggle)
- Default Model (dropdown: Sonnet, Opus, Haiku)
- Max Tokens (slider: 256 - 32,768)

**Model Tab:**
- Temperature (slider: 0 - 2)
- System Prompt (textarea)
- Thinking Effort (dropdown: Low, Medium, High, Max)

**Appearance Tab:**
- Theme (dropdown: Dark, Light, System)
- Font Size (slider: 10 - 24px)
- Show Thinking (toggle)
- Show Tool Calls (toggle)

**Instructions Tab:**
- Lists CLAUDE.md files by level (project, user, global, managed)
- Inline editor for editing instruction files
- Preview pane for viewing content
- Rules files display with path scopes
- Create CLAUDE.md button

**Memory Tab:**
- List of memory files with size, entrypoint badges
- Search with debounced query
- Inline editor for editing files
- Create/delete memory files
- Auto-memory toggle
- Memory directory path display

**MCP Tab:**
- List of MCP servers with status dots (green/gray for enabled/disabled)
- Type badges (stdio, http, sse)
- Toggle enable/disable per server
- Add/edit/delete servers with form fields
- Shows command/args for stdio, URL for http/sse

**Hooks Tab:**
- Hooks grouped by event type
- Handler type badges (command, http, prompt)
- Enable/disable toggle per hook
- Add/edit/delete hooks
- Event reference chips
- Execution log (empty placeholder)

**Advanced Tab:**
- Permission Mode (dropdown: Default, Accept Edits, Plan, Bypass Permissions)
- Auto-Compact (toggle)
- Max Turns (number input: 1 - 100)

### Settings Data Model (`useSettings` hook)

File: `apps/desktop/src/hooks/useSettings.ts`

All settings are stored in localStorage under key `claude-tauri-settings`. The `AppSettings` interface:

```typescript
interface AppSettings {
  apiKey: string;           // default: ''
  model: 'sonnet' | 'opus' | 'haiku';  // default: 'sonnet'
  maxTokens: number;        // default: 4096
  temperature: number;      // default: 1.0
  systemPrompt: string;     // default: ''
  effort: 'low' | 'medium' | 'high' | 'max';  // default: 'high'
  theme: 'dark' | 'light' | 'system';  // default: 'dark'
  fontSize: number;         // default: 14
  showThinking: boolean;    // default: true
  showToolCalls: boolean;   // default: true
  permissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';  // default: 'default'
  autoCompact: boolean;     // default: false
  maxTurns: number;         // default: 25
}
```

---

## 2. What Claude Code CLI's `/config` Shows

The CLI's `/config` command opens a 3-tab dialog: **Status | Config | Usage**.

### Status Tab

The Status tab was not directly captured in the research doc, but based on CLI behavior and the startup screen, it likely displays:

- **Model**: Current active model (e.g., "Opus 4.6")
- **Subscription tier**: "Claude Max", "Pro", etc.
- **Account email**: User's email
- **Working directory**: Current cwd
- **Git branch**: Current branch + dirty status
- **MCP servers**: Connected/failed counts with status per server
- **Permission mode**: Current mode (Default, Plan, Accept Edits)
- **Claude Code version**: e.g., "v2.1.55"
- **Available tools**: List of available tools
- **Context usage**: Token usage summary

### Config Tab (Captured)

The Config tab shows 23+ toggleable/selectable settings:

| Setting | Type | Default |
|---------|------|---------|
| Auto-compact | bool | true |
| Show tips | bool | true |
| Reduce motion | bool | false |
| Thinking mode | bool | true |
| Fast mode (Opus 4.6 only) | bool | false |
| Rewind code (checkpoints) | bool | true |
| Verbose output | bool | false |
| Terminal progress bar | bool | true |
| Default permission mode | enum | Default |
| Respect .gitignore in file picker | bool | true |
| Auto-update channel | enum | disabled |
| Theme | enum | Dark mode |
| Notifications | enum | Auto |
| Output style | enum | default |
| Language | enum | Default (English) |
| Editor mode | enum | normal |
| Show PR status footer | bool | true |
| Model | enum | Default (recommended) |
| Auto-connect to IDE | bool | false |
| Claude in Chrome enabled | bool | true |
| Teammate mode | enum | auto |
| Remote Control | enum | default |
| Custom API key | bool | false |

### Usage Tab

The Usage tab was not directly captured, but the `/stats` command shows:

- Activity heatmap (GitHub-style contribution grid)
- Token counts per day (ASCII chart)
- Model breakdown with percentages and in/out token counts
- Summary stats: sessions, active days, longest session, streaks, etc.

---

## 3. Data Already Available via API & Stream Events

### `/api/auth/status` (GET)

Returns `AuthStatus`:
```typescript
{
  authenticated: boolean;
  email?: string;      // e.g., "user@example.com"
  plan?: string;       // e.g., "pro", "max"
  error?: string;
}
```

Consumed by `useAuth()` hook on the frontend. This data is available at app startup.

### `session:init` Stream Event

Emitted at the start of every chat stream. Contains:

```typescript
{
  type: 'session:init';
  sessionId: string;           // Claude SDK session ID
  model: string;               // e.g., "claude-opus-4-6"
  tools: string[];             // List of available tool names
  mcpServers: Array<{          // MCP server status from SDK
    name: string;
    status: string;            // "connected", "failed", etc.
  }>;
  claudeCodeVersion: string;   // e.g., "2.1.55"
}
```

This is mapped from the SDK's `system.init` event in `event-mapper.ts`. The `useStreamEvents` hook stores `sessionInfo: { sessionId, model }` from this event, but **does NOT currently store** the `tools`, `mcpServers`, or `claudeCodeVersion` fields.

### `session:result` Stream Event

Emitted at the end of every chat stream. Contains:

```typescript
{
  type: 'session:result';
  success: boolean;
  subtype: string;
  costUsd: number;
  durationMs: number;
  numTurns: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  errors?: string[];
}
```

The `useStreamEvents` hook accumulates these into `cumulativeUsage` across the session.

### Other Relevant API Endpoints

| Endpoint | Data Available |
|----------|---------------|
| `/api/sessions` (GET) | List of all sessions with titles, timestamps |
| `/api/mcp/servers` (GET) | MCP server configs (name, type, enabled, command/url) |
| `/api/hooks` (GET) | Hook configs |
| `/api/hooks/events` (GET) | Available hook event types |
| `/api/instructions` (GET) | CLAUDE.md files by level |
| `/api/instructions/rules` (GET) | Rules files |
| `/api/memory` (GET) | Memory files + memory directory path |

---

## 4. Gap Analysis: What's Missing for a Full Status/Config Panel

### Data Available But Not Surfaced in Settings Panel

| Data Point | Source | Currently Used? |
|------------|--------|-----------------|
| Account email | `/api/auth/status` | Not shown in settings |
| Subscription plan/tier | `/api/auth/status` | Not shown in settings |
| Active model (from SDK) | `session:init` stream event | Stored in `sessionInfo.model` but not shown in settings |
| Claude Code version | `session:init` stream event | Not stored or shown |
| Available tools list | `session:init` stream event | Not stored or shown |
| MCP server live status | `session:init` stream event | Not stored (McpPanel only shows config, not live status) |
| Per-turn cost (USD) | `session:result` stream event | Stored in `usage.costUsd` but not shown in settings |
| Token usage per turn | `session:result` stream event | Stored in `cumulativeUsage` but not shown in settings |
| Duration per turn | `session:result` stream event | Stored but not shown |

### Data Not Available Yet (Would Need New APIs)

| Data Point | What Claude Code CLI Shows | What We'd Need |
|------------|---------------------------|----------------|
| Working directory / cwd | Shown in startup header and status bar | New API: `GET /api/system/cwd` or include in auth/status |
| Git branch + dirty status | Shown in status bar as `[main *]` | New API: `GET /api/git/status` (partially exists) |
| Fast mode status | Toggle in `/fast` dialog | New setting in `AppSettings` + backend support |
| Checkpoint/rewind status | Toggle in `/config` | New setting in `AppSettings` |
| Context window size | Shown in `/context` (e.g., "41k/200k tokens") | Need SDK to report context window limits |
| Context breakdown by category | `/context` shows system prompt, tools, memory, messages, free space | Not available from current SDK events |
| Historical stats (sessions, streaks, etc.) | `/stats` shows all-time activity | Would need to aggregate from DB sessions table |
| Auto-update channel | `/config` shows channel | Desktop-specific, not applicable to sidecar |

### Key Observations

1. **The `session:init` event is rich but underutilized.** It provides model, tools, MCP server status, and version -- but `useStreamEvents` only stores sessionId and model. Expanding this to capture all fields would immediately populate a Status tab.

2. **Auth status is fetched but not displayed in settings.** The `useAuth` hook fetches email and plan, but the SettingsPanel doesn't consume it. Adding it would give us the account info section.

3. **Usage tracking is accumulated but not displayed.** The `cumulativeUsage` object in `useStreamEvents` tracks total tokens across the session but is not rendered anywhere in the UI. This could power a Usage section.

4. **The MCP panel shows config, not live status.** The McpPanel reads from the config file API (`/api/mcp/servers`) but doesn't show whether servers are actually connected. The `session:init` event provides live status (`connected`, `failed`, etc.) that could enhance this.

5. **Several CLI settings don't map to the desktop app.** Terminal-specific settings like "Terminal progress bar", "Respect .gitignore in file picker", "Output style", "Editor mode" are irrelevant. Desktop-relevant ones like Fast mode, Auto-compact, Reduce motion, and Notifications could be added.

---

## 5. Recommended Priority for Enhancement

### Quick Wins (data already available)

1. **Add a Status/Overview section** at the top of Settings showing: email, plan, model, Claude Code version, cwd -- all available from `useAuth` + `session:init`
2. **Store and display tools and MCP status from `session:init`** in `useStreamEvents`
3. **Show cumulative token usage** somewhere in the UI (settings, status bar, or chat footer)

### Medium Effort (needs minor backend work)

4. **Add a `GET /api/system/info` endpoint** returning cwd, git branch, platform, and any other environment info
5. **Add Fast mode toggle** to settings (requires passing through to SDK options)
6. **Enhance McpPanel** to show live connection status from stream events alongside config

### Larger Effort (new features)

7. **Context visualization** (a la `/context`) -- requires tracking context window limits from SDK
8. **Stats/usage history** -- requires aggregating session data from the DB over time
9. **Permissions management UI** (a la `/permissions`) -- needs a new permissions API and backend storage
