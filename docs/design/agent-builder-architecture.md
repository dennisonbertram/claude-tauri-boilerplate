# Agent Builder Architecture

**Date:** 2026-03-19
**Status:** Draft
**Authors:** Architecture design based on research from hooks, SDK, React Flow, and UX investigations.

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Core Architecture -- SDK-Based Isolation](#2-core-architecture----sdk-based-isolation)
3. [Agent Profile Data Model](#3-agent-profile-data-model)
4. [Visual Hook Builder Design](#4-visual-hook-builder-design)
5. [Agent Profile Editor Design](#5-agent-profile-editor-design)
6. [Running an Agent Profile](#6-running-an-agent-profile)
7. [API Endpoints](#7-api-endpoints)
8. [Frontend Components](#8-frontend-components)
9. [Database Schema Changes](#9-database-schema-changes)
10. [Implementation Phases](#10-implementation-phases)
11. [Key Technical Decisions](#11-key-technical-decisions)

---

## 1. Feature Overview

The Agent Builder is a visual tool for creating, configuring, and running Claude agents with custom hooks, tools, prompts, and settings -- all from within the claude-tauri-boilerplate desktop app.

### What It Does

A user opens the Agent Builder, creates an "Agent Profile," and configures:

- **System prompt** -- custom instructions (like a portable CLAUDE.md)
- **Model** -- which Claude model to use, with parameter tuning
- **Tools** -- which built-in and MCP tools the agent can access
- **Hooks** -- trigger-condition-action automations that fire at lifecycle events
- **Sandbox** -- filesystem and network restrictions
- **MCP servers** -- external tool servers to connect

When the user starts a chat and selects that profile, the server calls `query()` from the Claude Agent SDK with the exact configuration from the profile. The agent runs with those settings and nothing else -- no contamination from the user's global `~/.claude/settings.json` or project `.claude/settings.json` unless the profile explicitly opts in.

### What It Is Not

- Not a multi-agent orchestration platform (no agent-to-agent communication graphs)
- Not a visual programming language for arbitrary logic
- Not a replacement for writing CLAUDE.md files (it complements them)
- Not an agent marketplace (though export/import enables sharing)

### Core Value Proposition

Today, configuring Claude Code requires editing JSON files across multiple locations (`~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`) and understanding the precedence rules between them. The Agent Builder replaces that with:

1. A single, self-contained profile that captures all configuration
2. A visual interface for building hook automations (no JSON editing)
3. SDK-based isolation that guarantees the profile is what runs (no hidden settings)
4. Instant switching between profiles for different tasks

---

## 2. Core Architecture -- SDK-Based Isolation

### The Critical Insight

The Claude Agent SDK's `query()` function defaults to `settingSources: []`, meaning it loads **no filesystem settings**. This is our sandbox. Every agent profile runs through `query()` with only the configuration defined in the profile -- no leakage from global or project settings.

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI (claude command)                      │
│                                                               │
│  Loads: ~/.claude/settings.json                              │
│         .claude/settings.json                                │
│         .claude/settings.local.json                          │
│         All CLAUDE.md files in hierarchy                     │
│         All skills, rules, MCP configs                       │
│         Managed policy settings                              │
│                                                               │
│  Result: Unpredictable configuration stacking                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SDK query() (our approach)                 │
│                                                               │
│  Loads: NOTHING by default (settingSources: [])              │
│                                                               │
│  We provide: exactly what the profile defines                │
│    - systemPrompt from profile                               │
│    - allowedTools from profile                               │
│    - hooks from profile                                      │
│    - model from profile                                      │
│    - sandbox from profile                                    │
│    - mcpServers from profile                                 │
│    - permissionMode from profile                             │
│                                                               │
│  Result: Deterministic, reproducible agent behavior          │
└─────────────────────────────────────────────────────────────┘
```

### Profile to query() Options Mapping

When a user starts a chat with an agent profile, the server translates the profile into SDK options:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

function buildQueryOptions(profile: AgentProfile, sessionId?: string) {
  const options: Record<string, unknown> = {
    // Isolation: do NOT load any filesystem settings by default
    settingSources: profile.setting_sources ?? [],

    // System prompt
    systemPrompt: profile.use_claude_code_prompt
      ? {
          type: "preset" as const,
          preset: "claude_code" as const,
          append: profile.system_prompt ?? undefined,
        }
      : profile.system_prompt ?? undefined,

    // Model
    model: profile.model ?? undefined,

    // Effort
    effort: profile.effort ?? undefined,

    // Tools
    allowedTools: profile.allowed_tools ?? [],
    disallowedTools: profile.disallowed_tools ?? [],

    // Permission mode
    permissionMode: profile.permission_mode ?? "default",

    // Hooks (direct pass-through -- same format as settings.json)
    hooks: profile.hooks_json ? JSON.parse(profile.hooks_json) : undefined,

    // MCP servers
    mcpServers: profile.mcp_servers_json
      ? JSON.parse(profile.mcp_servers_json)
      : undefined,

    // Sandbox
    sandbox: profile.sandbox_json
      ? JSON.parse(profile.sandbox_json)
      : undefined,

    // Working directory
    cwd: profile.cwd ?? process.cwd(),

    // Streaming
    includePartialMessages: true,

    // Budget controls
    maxTurns: profile.max_turns ?? undefined,
    maxBudgetUsd: profile.max_budget_usd ?? undefined,
  };

  // Multi-turn: resume existing session
  if (sessionId) {
    options.resume = sessionId;
  }

  return options;
}
```

### Available query() Options by Category

| Category | Options | Profile Field |
|----------|---------|---------------|
| **Identity** | `systemPrompt` | `system_prompt`, `use_claude_code_prompt` |
| **Model** | `model`, `effort` | `model`, `effort` |
| **Tools** | `allowedTools`, `disallowedTools`, `tools` | `allowed_tools`, `disallowed_tools` |
| **Permissions** | `permissionMode` | `permission_mode` |
| **Hooks** | `hooks` | `hooks_json` (Claude Code hooks format) |
| **MCP** | `mcpServers`, `strictMcpConfig` | `mcp_servers_json` |
| **Sandbox** | `sandbox` | `sandbox_json` |
| **Execution** | `cwd`, `additionalDirectories` | `cwd`, `additional_directories` |
| **Limits** | `maxTurns`, `maxBudgetUsd` | `max_turns`, `max_budget_usd` |
| **Settings** | `settingSources` | `setting_sources` |
| **Subagents** | `agents` | `agents_json` |
| **Session** | `resume`, `persistSession` | managed by server |

### Opting Back Into Project Context

By default, profiles run in full isolation. But a user may want their custom profile to still read the project's CLAUDE.md or use project-level settings. The `setting_sources` field controls this:

```typescript
// Full isolation (default)
settingSources: []

// Load project CLAUDE.md and project settings
settingSources: ["project"]

// Load everything (same as CLI behavior)
settingSources: ["user", "project", "local"]
```

When `settingSources` includes `"project"`, the profile's system prompt should use the `claude_code` preset to get the full Claude Code system prompt with CLAUDE.md loading:

```typescript
systemPrompt: {
  type: "preset",
  preset: "claude_code",
  append: profile.system_prompt  // additional instructions on top
}
```

### How This Differs From CLI

| Aspect | CLI (`claude` command) | SDK `query()` (Agent Builder) |
|--------|------------------------|-------------------------------|
| Settings loading | Always loads user + project + local | Loads nothing by default |
| CLAUDE.md | Always loaded from hierarchy | Only if opted in via `settingSources` |
| System prompt | Full Claude Code prompt | Minimal by default, or preset |
| Hooks | Merged from all settings scopes | Only what the profile provides |
| MCP servers | All configured servers | Only what the profile provides |
| Permissions | Merged from all scopes | Only what the profile provides |
| Reproducibility | Depends on filesystem state | Deterministic from profile data |

---

## 3. Agent Profile Data Model

### TypeScript Interface

```typescript
interface AgentProfile {
  // --- Metadata ---
  id: string;                          // UUID
  name: string;                        // Display name
  description: string | null;          // What this profile does
  icon: string | null;                 // Emoji or icon identifier
  color: string | null;                // Hex color for card/badge
  is_default: boolean;                 // Is this the default profile?
  sort_order: number;                  // Display ordering

  // --- System Prompt ---
  system_prompt: string | null;        // Custom instructions (markdown)
  use_claude_code_prompt: boolean;     // Use the full Claude Code preset?
  // If true: systemPrompt = { type: "preset", preset: "claude_code", append: system_prompt }
  // If false: systemPrompt = system_prompt (raw string, or null for SDK default)

  // --- Model Configuration ---
  model: string | null;                // Model name (e.g., "claude-sonnet-4-6")
  effort: string | null;               // "low" | "medium" | "high" | "max"
  thinking_budget_tokens: number | null;

  // --- Tool Configuration ---
  allowed_tools: string[];             // Tools to auto-approve
  disallowed_tools: string[];          // Tools to always deny
  permission_mode: string;             // "default" | "acceptEdits" | "plan" | "dontAsk"

  // --- Hooks ---
  hooks_json: string | null;           // JSON string -- Claude Code hooks format
  hooks_canvas_json: string | null;    // JSON string -- React Flow canvas state (for visual editor)

  // --- MCP Servers ---
  mcp_servers_json: string | null;     // JSON string -- McpServerConfig map

  // --- Sandbox ---
  sandbox_json: string | null;         // JSON string -- SandboxSettings

  // --- Execution ---
  cwd: string | null;                  // Working directory override
  additional_directories: string[];    // Extra directories to access
  setting_sources: string[];           // Which filesystem settings to load

  // --- Limits ---
  max_turns: number | null;            // Maximum agentic turns
  max_budget_usd: number | null;       // Maximum spend per session

  // --- Subagents ---
  agents_json: string | null;          // JSON string -- custom subagent definitions

  // --- Timestamps ---
  created_at: string;
  updated_at: string;
}
```

### Hooks JSON Format

The `hooks_json` field stores hooks in the exact same format as Claude Code's `settings.json`. This means profiles can import/export hooks directly from/to Claude Code settings files with zero transformation:

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": ".claude/hooks/block-rm.sh",
          "timeout": 30
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        {
          "type": "command",
          "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
        }
      ]
    }
  ],
  "Stop": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Check if all tasks are complete."
        }
      ]
    }
  ]
}
```

### Hooks Canvas JSON Format

The `hooks_canvas_json` field stores the React Flow visual state (nodes, edges, viewport) for the visual hook builder. This is the visual representation -- it gets compiled down to `hooks_json` when saved:

```json
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 100, "y": 200 },
      "data": {
        "event": "PreToolUse",
        "label": "Before Tool Use"
      }
    },
    {
      "id": "condition-1",
      "type": "condition",
      "position": { "x": 350, "y": 200 },
      "data": {
        "matcher": "Bash",
        "label": "Matches Bash"
      }
    },
    {
      "id": "action-1",
      "type": "action",
      "position": { "x": 600, "y": 200 },
      "data": {
        "hookType": "command",
        "command": ".claude/hooks/block-rm.sh",
        "timeout": 30,
        "label": "Block rm -rf"
      }
    }
  ],
  "edges": [
    { "id": "e-t1-c1", "source": "trigger-1", "target": "condition-1", "type": "smoothstep" },
    { "id": "e-c1-a1", "source": "condition-1", "target": "action-1", "type": "smoothstep" }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY,

  -- Metadata
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  description TEXT,
  icon TEXT,
  color TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- System Prompt
  system_prompt TEXT,
  use_claude_code_prompt INTEGER NOT NULL DEFAULT 1,

  -- Model
  model TEXT,
  effort TEXT CHECK(effort IS NULL OR effort IN ('low', 'medium', 'high', 'max')),
  thinking_budget_tokens INTEGER,

  -- Tools (stored as JSON arrays)
  allowed_tools TEXT NOT NULL DEFAULT '[]',
  disallowed_tools TEXT NOT NULL DEFAULT '[]',
  permission_mode TEXT NOT NULL DEFAULT 'default'
    CHECK(permission_mode IN ('default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk')),

  -- Hooks
  hooks_json TEXT,
  hooks_canvas_json TEXT,

  -- MCP Servers
  mcp_servers_json TEXT,

  -- Sandbox
  sandbox_json TEXT,

  -- Execution
  cwd TEXT,
  additional_directories TEXT NOT NULL DEFAULT '[]',
  setting_sources TEXT NOT NULL DEFAULT '[]',

  -- Limits
  max_turns INTEGER,
  max_budget_usd REAL,

  -- Subagents
  agents_json TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_name ON agent_profiles(name);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_sort_order ON agent_profiles(sort_order);
```

### Sessions Table FK Addition

```sql
-- Migration: add profile_id to sessions
ALTER TABLE sessions ADD COLUMN profile_id TEXT REFERENCES agent_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_profile_id ON sessions(profile_id);
```

When `profile_id` is NULL, the session uses default behavior (no profile, same as current behavior). When set, the server loads the profile and constructs `query()` options from it.

### Hook Templates Table (Phase 3)

```sql
CREATE TABLE IF NOT EXISTS hook_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  hooks_json TEXT NOT NULL,
  hooks_canvas_json TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hook_templates_category ON hook_templates(category);
```

---

## 4. Visual Hook Builder Design

### Overview

The visual hook builder uses React Flow (`@xyflow/react` v12) to provide a canvas where users compose hooks as connected node graphs. Each hook is a flow: **Trigger -> Condition -> Action**.

### Node Types

Three custom node types, each mapping to a part of the Claude Code hooks format:

#### TriggerNode

Represents a hook event (the "when" -- when does this hook fire?).

```
┌──────────────────────────────────────┐
│  TRIGGER                             │
│  ┌──────────────────────────────┐    │
│  │ Event: [PreToolUse        v] │    │
│  └──────────────────────────────┘    │
│                                      │
│  Can block: Yes                      │
│  Fires: Before tool execution    [o]─┤ (source handle)
│                                      │
└──────────────────────────────────────┘
```

Data shape:
```typescript
type TriggerNodeData = {
  event: HookEvent;   // "PreToolUse" | "PostToolUse" | "Stop" | ...
  label: string;      // Display name
};

// All 26 hook events
type HookEvent =
  | "SessionStart" | "SessionEnd"
  | "UserPromptSubmit"
  | "PreToolUse" | "PostToolUse" | "PostToolUseFailure"
  | "PermissionRequest"
  | "Stop" | "StopFailure"
  | "SubagentStart" | "SubagentStop"
  | "TeammateIdle" | "TaskCompleted"
  | "Notification"
  | "PreCompact" | "PostCompact"
  | "ConfigChange"
  | "InstructionsLoaded"
  | "Elicitation" | "ElicitationResult"
  | "WorktreeCreate" | "WorktreeRemove";
```

Visual design:
- Background: gradient with event-category color (green for lifecycle, yellow for blocking, blue for observers)
- Left side: no handle (triggers are sources only)
- Right side: source handle (connects to conditions or directly to actions)
- Dropdown selector for the event type
- Info badge showing "Can block" status

#### ConditionNode

Represents a matcher (the "if" -- which tool/source/type does this apply to?).

```
         ┌──────────────────────────────────────┐
(target) │─[o]  CONDITION                        │
         │  ┌──────────────────────────────┐     │
         │  │ Matcher: [Bash           ]   │     │
         │  └──────────────────────────────┘     │
         │                                       │
         │  Regex preview: /Bash/            [o]─┤ (source: match)
         │  Test: [npm test      ] -> Match  [o]─┤ (source: no-match)
         │                                       │
         └──────────────────────────────────────┘
```

Data shape:
```typescript
type ConditionNodeData = {
  matcher: string;     // Regex pattern (e.g., "Bash", "Edit|Write", "mcp__github__.*")
  label: string;       // Display name
  description?: string;
};
```

Visual design:
- Background: neutral gray/slate
- Left side: target handle (receives from trigger or another condition)
- Right side: two source handles -- "match" (top) and "no-match" (bottom, optional)
- Regex input with live validation (green border = valid regex, red = invalid)
- Test input field: type a tool name and see if it matches in real time
- Hint text showing what the matcher filters for this event type

Condition nodes are **optional**. A trigger can connect directly to an action (equivalent to an empty matcher / `""` which matches everything).

#### ActionNode

Represents the hook itself (the "then" -- what happens when this fires?).

```
         ┌──────────────────────────────────────┐
(target) │─[o]  ACTION                           │
         │  ┌──────────────────────────────┐     │
         │  │ Type: [command           v]  │     │
         │  └──────────────────────────────┘     │
         │                                       │
         │  Command: [.claude/hooks/lint.sh]     │
         │  Timeout: [30] seconds                │
         │  Async: [ ] (checkbox)                │
         │  Status: [Linting...          ]       │
         │                                       │
         └──────────────────────────────────────┘
```

Data shape:
```typescript
type ActionNodeData = {
  hookType: "command" | "http" | "prompt" | "agent";
  label: string;

  // command type
  command?: string;
  timeout?: number;
  async?: boolean;

  // http type
  url?: string;
  headers?: Record<string, string>;
  allowedEnvVars?: string[];

  // prompt type
  prompt?: string;
  model?: string;

  // agent type (same as prompt but with different defaults)

  // Common
  statusMessage?: string;
};
```

Visual design:
- Background: colored by hook type
  - command: green border/accent (terminal icon)
  - http: blue border/accent (globe icon)
  - prompt: purple border/accent (brain icon)
  - agent: purple border/accent (robot icon)
- Left side: target handle (receives from condition or trigger)
- Right side: no handle (actions are sinks)
- Type selector dropdown that dynamically shows/hides fields
- All type-specific fields rendered inline with `nodrag` class for interactivity

### Node Type Registration

```typescript
import { memo } from "react";
import type { NodeTypes } from "@xyflow/react";
import { TriggerNode } from "./nodes/TriggerNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ActionNode } from "./nodes/ActionNode";

// MUST be defined outside component to prevent re-renders
export const hookNodeTypes: NodeTypes = {
  trigger: memo(TriggerNode),
  condition: memo(ConditionNode),
  action: memo(ActionNode),
};
```

### Edge Types and Connection Rules

Edges use `smoothstep` type with animated dashes for visual clarity.

Connection validation rules:

```typescript
const isValidConnection = (connection: Connection): boolean => {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (!sourceNode || !targetNode) return false;

  // Rule 1: Triggers can only connect to conditions or actions
  if (sourceNode.type === "trigger") {
    return targetNode.type === "condition" || targetNode.type === "action";
  }

  // Rule 2: Conditions can only connect to actions or other conditions
  if (sourceNode.type === "condition") {
    return targetNode.type === "action" || targetNode.type === "condition";
  }

  // Rule 3: Actions cannot be sources (they are terminal)
  if (sourceNode.type === "action") {
    return false;
  }

  return false;
};
```

Flow direction: **left to right** (triggers on left, conditions in middle, actions on right).

### Canvas Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐                                                           │
│  │ + Trigger │  ┌──────────┐  ┌──────────┐         ┌─────────────────┐ │
│  │ +Condition│  │  Panel:  │  │  Canvas   │         │  Config Panel   │ │
│  │ + Action  │  │ Templates│  │           │         │  (right sidebar)│ │
│  │           │  │          │  │ [nodes]   │         │                 │ │
│  │  Node     │  │ - Block  │  │  [edges]  │         │ Selected node   │ │
│  │  Palette  │  │   rm -rf │  │           │         │ configuration   │ │
│  │           │  │ - Lint   │  │           │         │ form            │ │
│  │  (left    │  │ - Format │  │           │         │                 │ │
│  │  sidebar) │  │ - Notify │  │           │         │                 │ │
│  │           │  │          │  │           │         │                 │ │
│  └──────────┘  └──────────┘  │           │         └─────────────────┘ │
│                               │  Controls │                             │
│                               │  MiniMap  │                             │
│                               └──────────┘                             │
│  [Save] [Export JSON] [Import JSON] [Clear]    [Undo] [Redo]           │
└─────────────────────────────────────────────────────────────────────────┘
```

Components:
- **Left sidebar**: Node palette (drag to add) + template gallery
- **Center**: React Flow canvas with Background (dots), Controls, MiniMap
- **Right sidebar**: Configuration panel for selected node (appears on click)
- **Bottom toolbar**: Save, Export, Import, Clear, Undo/Redo

### Canvas to Hooks JSON Compilation

When the user saves, the canvas state is compiled to the Claude Code hooks JSON format:

```typescript
function compileCanvasToHooks(
  nodes: Node[],
  edges: Edge[]
): Record<string, HookCallbackMatcher[]> {
  const hooks: Record<string, HookCallbackMatcher[]> = {};

  // Find all trigger nodes
  const triggers = nodes.filter((n) => n.type === "trigger");

  for (const trigger of triggers) {
    const event = trigger.data.event as string;
    if (!hooks[event]) hooks[event] = [];

    // Walk the graph from this trigger
    const paths = findAllPaths(trigger.id, nodes, edges);

    for (const path of paths) {
      // Each path is: trigger -> [conditions...] -> action
      const conditionNodes = path.filter((n) => n.type === "condition");
      const actionNodes = path.filter((n) => n.type === "action");

      // Build matcher from condition chain (combine with |)
      const matcher = conditionNodes
        .map((c) => c.data.matcher)
        .filter(Boolean)
        .join("|") || "";

      // Build hooks array from action nodes
      const hookDefs = actionNodes.map((action) => {
        const def: Record<string, unknown> = {
          type: action.data.hookType,
        };

        switch (action.data.hookType) {
          case "command":
            def.command = action.data.command;
            if (action.data.timeout) def.timeout = action.data.timeout;
            if (action.data.async) def.async = true;
            break;
          case "http":
            def.url = action.data.url;
            if (action.data.headers) def.headers = action.data.headers;
            if (action.data.allowedEnvVars) def.allowedEnvVars = action.data.allowedEnvVars;
            if (action.data.timeout) def.timeout = action.data.timeout;
            break;
          case "prompt":
          case "agent":
            def.prompt = action.data.prompt;
            if (action.data.model) def.model = action.data.model;
            if (action.data.timeout) def.timeout = action.data.timeout;
            break;
        }

        if (action.data.statusMessage) def.statusMessage = action.data.statusMessage;

        return def;
      });

      hooks[event].push({
        matcher,
        hooks: hookDefs,
      });
    }
  }

  return hooks;
}
```

### Import/Export

Export produces a standard Claude Code `settings.json` hooks fragment:

```typescript
function exportHooksJSON(profile: AgentProfile): string {
  const hooks = profile.hooks_json ? JSON.parse(profile.hooks_json) : {};
  return JSON.stringify({ hooks }, null, 2);
}
```

Import parses a Claude Code settings file and populates both `hooks_json` and generates canvas nodes:

```typescript
function importHooksJSON(json: string): {
  hooks_json: string;
  hooks_canvas_json: string;
} {
  const parsed = JSON.parse(json);
  const hooks = parsed.hooks ?? parsed; // Accept { hooks: {...} } or raw hooks object

  // Store the hooks JSON directly
  const hooks_json = JSON.stringify(hooks);

  // Generate canvas layout from hooks
  const { nodes, edges } = generateCanvasFromHooks(hooks);
  const hooks_canvas_json = JSON.stringify({
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  return { hooks_json, hooks_canvas_json };
}
```

### Example Flows

#### Flow 1: Block Dangerous Bash Commands

```
┌──────────────┐     ┌──────────────┐     ┌────────────────────┐
│  TRIGGER      │     │  CONDITION   │     │  ACTION            │
│  PreToolUse   │────>│  Bash        │────>│  command            │
│               │     │              │     │  block-rm.sh        │
│  Can block    │     │  Regex valid │     │  timeout: 30s       │
└──────────────┘     └──────────────┘     └────────────────────┘
```

Compiled hooks JSON:
```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": ".claude/hooks/block-rm.sh",
          "timeout": 30
        }
      ]
    }
  ]
}
```

#### Flow 2: Auto-Lint on File Save + Desktop Notification

```
┌──────────────┐     ┌──────────────┐     ┌────────────────────┐
│  TRIGGER      │     │  CONDITION   │     │  ACTION            │
│  PostToolUse  │────>│  Edit|Write  │────>│  command            │
│               │     │              │     │  prettier --write   │
└──────────────┘     └──────────────┘     └────────────────────┘

┌──────────────┐                          ┌────────────────────┐
│  TRIGGER      │                          │  ACTION            │
│  Notification │─────────────────────────>│  command            │
│               │  (no condition = match   │  osascript notify   │
│               │   everything)            │                    │
└──────────────┘                          └────────────────────┘
```

#### Flow 3: Stop Verification (Prompt Hook)

```
┌──────────────┐                          ┌────────────────────┐
│  TRIGGER      │                          │  ACTION            │
│  Stop         │─────────────────────────>│  prompt             │
│               │                          │  "Check if all      │
│  Can block    │                          │   tasks complete"   │
└──────────────┘                          └────────────────────┘
```

### Templates for Common Patterns

Built-in templates that users can drag onto the canvas:

| Template | Event | Matcher | Action | Description |
|----------|-------|---------|--------|-------------|
| Block rm -rf | PreToolUse | Bash | command: block-rm.sh | Prevents destructive deletion |
| Auto-format | PostToolUse | Edit\|Write | command: prettier --write | Format files after edits |
| Desktop notify | Notification | (all) | command: osascript notify | macOS notification on events |
| Verify completion | Stop | (all) | prompt: "Check tasks" | Verify before stopping |
| Verify tests | Stop | (all) | agent: "Run test suite" | Run tests before stopping |
| Log bash commands | PostToolUse | Bash | command: log to file | Audit trail of commands |
| Protect .env | PreToolUse | Edit\|Write | command: check file path | Block edits to sensitive files |
| Re-inject context | SessionStart | compact | command: echo reminders | Restore context after compaction |

---

## 5. Agent Profile Editor Design

### Layout

The profile editor is a full-page view with a tabbed/sectioned form alongside an optional visual canvas.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agent Profile: [My Code Reviewer]                    [Save] [Test] │
├───────────┬─────────────────────────────────────────────────────────┤
│           │                                                         │
│  General  │  ┌─────────────────────────────────────────────┐       │
│  Prompt   │  │  Profile Name: [My Code Reviewer       ]    │       │
│  Model    │  │  Description:  [Reviews code for style  ]    │       │
│  Tools    │  │  Icon: [magnifying glass emoji picker   ]    │       │
│  Hooks    │  │  Color: [#3B82F6 color picker           ]    │       │
│  MCP      │  │                                              │       │
│  Sandbox  │  │  [ ] Use as default profile                  │       │
│  Advanced │  └─────────────────────────────────────────────┘       │
│           │                                                         │
│  (tab     │                                                         │
│   nav)    │                                                         │
│           │                                                         │
└───────────┴─────────────────────────────────────────────────────────┘
```

### Sections

#### General Tab
- Profile name (required, text input)
- Description (optional, textarea)
- Icon (emoji picker or icon selector)
- Color (color picker, used for card badges and visual identification)
- Default profile toggle

#### Prompt Tab
- **System prompt editor**: full-width markdown editor with preview toggle
  - Syntax highlighting for markdown
  - Preview renders the markdown
  - Token count estimate displayed
- **Use Claude Code system prompt**: checkbox
  - When checked: profile's system prompt is appended to the Claude Code default
  - When unchecked: profile's system prompt replaces everything
- **Setting sources**: multi-select checkboxes for `user`, `project`, `local`
  - Controls whether to load CLAUDE.md, project settings, etc.

#### Model Tab
- **Model selector**: dropdown with available models
  - claude-opus-4-6
  - claude-sonnet-4-6
  - claude-haiku-4
  - (dynamically populated if possible)
- **Effort level**: segmented control (low / medium / high / max)
- **Thinking budget**: slider (1024 - 32000 tokens), only shown when effort is "high" or "max"

#### Tools Tab

Card-based tool picker with search and category filters.

```
┌─────────────────────────────────────────────────────────────────┐
│  Tools                                          [Search tools]  │
├─────────────────────────────────────────────────────────────────┤
│  Permission Mode: [default v]                                   │
│                                                                 │
│  Allowed (auto-approve):                                       │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌──────┐            │
│  │ Read  │ │ Glob  │ │ Grep  │ │ Edit  │ │ + Add│            │
│  │   x   │ │   x   │ │   x   │ │   x   │ │      │            │
│  └───────┘ └───────┘ └───────┘ └───────┘ └──────┘            │
│                                                                 │
│  Disallowed (always deny):                                     │
│  ┌───────────┐ ┌──────────────┐ ┌──────┐                      │
│  │ WebFetch  │ │ Bash(curl *) │ │ + Add│                      │
│  │     x     │ │      x       │ │      │                      │
│  └───────────┘ └──────────────┘ └──────┘                      │
│                                                                 │
│  Available Tools:                                              │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ Bash       Run terminal commands            [Allow]  │      │
│  │ Edit       Make precise file edits          [Allow]  │      │
│  │ Write      Create new files                 [Allow]  │      │
│  │ Read       Read any file                    [Allow]  │      │
│  │ Glob       Find files by pattern            [Allow]  │      │
│  │ Grep       Search file contents             [Allow]  │      │
│  │ WebSearch  Search the web                   [Deny]   │      │
│  │ WebFetch   Fetch web pages                  [Deny]   │      │
│  │ Agent      Delegate to subagents            [---]    │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

Each tool card shows:
- Tool name and brief description
- Toggle: Allow (auto-approve) / Deny (always block) / Default (ask user)
- For Bash: optional specifier pattern (e.g., `Bash(npm test *)`)

#### Hooks Tab

Two views, switchable:

**List view (default)**: form-based hook configuration
```
┌─────────────────────────────────────────────────────────────────┐
│  Hooks                              [List View] / [Canvas View] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PreToolUse                                          [+ Add]    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Matcher: [Bash        ]                                │   │
│  │  Type: [command v]  Command: [.claude/hooks/lint.sh ]   │   │
│  │  Timeout: [30] sec   Async: [ ]              [Delete]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  PostToolUse                                         [+ Add]    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Matcher: [Edit|Write  ]                                │   │
│  │  Type: [command v]  Command: [prettier --write      ]   │   │
│  │  Timeout: [600] sec  Async: [ ]              [Delete]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Stop                                                [+ Add]    │
│  (no hooks configured)                                          │
│                                                                 │
│  [Import from JSON]  [Export as JSON]  [Load Template]          │
└─────────────────────────────────────────────────────────────────┘
```

**Canvas view**: the full React Flow visual hook builder (described in Section 4).

Both views operate on the same underlying data. Switching between them syncs the state:
- Canvas -> List: compile canvas to hooks_json, display as form
- List -> Canvas: generate canvas layout from hooks_json

#### MCP Tab

MCP server configuration. Each server is a card with connection details.

```
┌─────────────────────────────────────────────────────────────────┐
│  MCP Servers                                         [+ Add]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Server: github                                          │   │
│  │  Command: npx -y @modelcontextprotocol/server-github     │   │
│  │  Args: []                                                │   │
│  │  Env: GITHUB_TOKEN=***                        [Delete]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Server: filesystem                                      │   │
│  │  Command: npx -y @modelcontextprotocol/server-filesystem │   │
│  │  Args: ["/path/to/allowed"]                              │   │
│  │  Env: (none)                                  [Delete]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [ ] Use strict MCP config (ignore all other MCP sources)       │
└─────────────────────────────────────────────────────────────────┘
```

MCP server config format (matches Claude Code's `.mcp.json`):
```typescript
type McpServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};
```

#### Sandbox Tab

Filesystem and network restrictions.

```
┌─────────────────────────────────────────────────────────────────┐
│  Sandbox Configuration                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [x] Enable sandbox                                             │
│  [x] Auto-allow Bash commands when sandboxed                    │
│                                                                 │
│  Filesystem:                                                    │
│    Allow write:  [./src] [./tests] [/tmp/build]     [+ Add]    │
│    Deny write:   [/etc] [/usr/local/bin]            [+ Add]    │
│    Deny read:    [~/.aws/credentials] [~/.ssh]      [+ Add]    │
│                                                                 │
│  Network:                                                       │
│    Allowed domains: [github.com] [*.npmjs.org]      [+ Add]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Advanced Tab

Less common settings:

- Working directory override (path picker)
- Additional directories (multi-path picker)
- Max turns (number input)
- Max budget USD (number input with currency formatting)
- Custom subagent definitions (JSON editor with schema validation)

### Test/Preview Section

At the bottom of any tab, a collapsible "Test" panel:

```
┌─────────────────────────────────────────────────────────────────┐
│  Test Profile                                         [Expand]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Preview query() options:                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ {                                                        │   │
│  │   "settingSources": [],                                  │   │
│  │   "systemPrompt": "You are a code reviewer...",         │   │
│  │   "model": "claude-sonnet-4-6",                         │   │
│  │   "allowedTools": ["Read", "Glob", "Grep"],             │   │
│  │   "permissionMode": "dontAsk",                          │   │
│  │   "hooks": { ... }                                      │   │
│  │ }                                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Quick test: [Type a message...              ] [Send]           │
│  (Runs a single-turn query with this profile)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

This shows the exact `query()` options object that will be sent to the SDK, so users can verify their configuration. The quick test sends a single-turn message to validate the profile works.

---

## 6. Running an Agent Profile

### Session Creation with Profile

When a user starts a new chat with a profile selected:

1. Frontend sends `POST /api/sessions` with `{ profileId: "uuid" }`
2. Server creates the session row with `profile_id` set
3. Server returns the session (including profile info)
4. On first message, server loads the profile and builds `query()` options
5. Streaming works exactly like current chat, but with custom config

### Chat Request Flow

```
Frontend                  Server                     SDK
   │                         │                         │
   │  POST /api/chat         │                         │
   │  { messages, sessionId, │                         │
   │    profileId }          │                         │
   │ ──────────────────────> │                         │
   │                         │                         │
   │                         │  Load AgentProfile      │
   │                         │  from SQLite             │
   │                         │                         │
   │                         │  Build query() options   │
   │                         │  from profile            │
   │                         │                         │
   │                         │  query({ prompt, opts }) │
   │                         │ ──────────────────────> │
   │                         │                         │
   │                         │  <── streaming events    │
   │                         │                         │
   │  <── SSE stream         │                         │
   │  (same format as today) │                         │
   │                         │                         │
```

### Backward Compatibility

Existing sessions without a `profile_id` continue to work exactly as they do today. The server checks:

```typescript
// In chat route handler
const profile = session.profile_id
  ? await getAgentProfile(db, session.profile_id)
  : null;

const queryOptions = profile
  ? buildQueryOptions(profile, session.claude_session_id)
  : buildDefaultQueryOptions(session); // current behavior
```

### Switching Profiles

A session is bound to one profile at creation time. To switch profiles, the user starts a new session. This is simpler than mid-conversation switching and avoids confusing the LLM with changed system prompts.

The UI shows the active profile as a badge on the session:

```
┌─────────────────────────────────────────┐
│  Sessions                               │
│  ┌─────────────────────────────────┐   │
│  │  Debug auth module               │   │
│  │  [Code Reviewer] 2 min ago       │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Write tests for API            │   │
│  │  [Test Writer] 15 min ago        │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  General chat                    │   │
│  │  (no profile) 1 hr ago           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Profile Selection in New Chat

When creating a new chat, a profile selector appears:

```
┌─────────────────────────────────────────────────┐
│  New Chat                                        │
│                                                   │
│  Select Agent Profile:                            │
│  ┌──────┐  ┌──────────┐  ┌──────────┐  ┌─────┐ │
│  │ None │  │ Code     │  │ Test     │  │ + New│ │
│  │(default)│ Reviewer │  │ Writer   │  │      │ │
│  │      │  │ #3B82F6  │  │ #10B981  │  │      │ │
│  └──────┘  └──────────┘  └──────────┘  └─────┘ │
│                                                   │
│  [Type your message...]                           │
└─────────────────────────────────────────────────┘
```

---

## 7. API Endpoints

### Agent Profiles CRUD

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent-profiles` | GET | List all profiles |
| `/api/agent-profiles` | POST | Create a new profile |
| `/api/agent-profiles/:id` | GET | Get a single profile |
| `/api/agent-profiles/:id` | PUT | Update a profile |
| `/api/agent-profiles/:id` | DELETE | Delete a profile |
| `/api/agent-profiles/:id/duplicate` | POST | Duplicate a profile |
| `/api/agent-profiles/:id/validate` | POST | Validate profile configuration |

### Profile Validation

`POST /api/agent-profiles/:id/validate`

Checks:
- Hooks JSON is valid and matches Claude Code format
- Matcher regexes are valid
- Command paths exist (for command hooks)
- MCP server configs are well-formed
- Model name is recognized
- No conflicting tool rules (same tool in both allowed and disallowed)

Response:
```json
{
  "valid": false,
  "errors": [
    {
      "field": "hooks_json",
      "path": "PreToolUse[0].matcher",
      "message": "Invalid regex: unmatched parenthesis"
    },
    {
      "field": "allowed_tools",
      "message": "Tool 'Bash' appears in both allowed and disallowed lists"
    }
  ],
  "warnings": [
    {
      "field": "hooks_json",
      "path": "Stop[0].hooks[0]",
      "message": "Stop hooks should check stop_hook_active to prevent infinite loops"
    }
  ]
}
```

### Hook Testing

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent-profiles/:id/hooks/dry-run` | POST | Test hooks against sample payload |

`POST /api/agent-profiles/:id/hooks/dry-run`

Request:
```json
{
  "event": "PreToolUse",
  "payload": {
    "tool_name": "Bash",
    "tool_input": {
      "command": "rm -rf /important"
    }
  }
}
```

Response:
```json
{
  "matched": true,
  "matcherUsed": "Bash",
  "hooksTriggered": [
    {
      "type": "command",
      "command": ".claude/hooks/block-rm.sh",
      "wouldBlock": true,
      "simulatedOutput": "Blocked: rm -rf detected"
    }
  ]
}
```

### Hook Templates

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/hook-templates` | GET | List all templates |
| `/api/hook-templates/:id` | GET | Get a template |
| `/api/hook-templates` | POST | Create a custom template |

### Updated Chat Endpoint

The existing `POST /api/chat` endpoint is extended to accept an optional `profileId`:

```json
{
  "messages": [...],
  "sessionId": "uuid",
  "profileId": "uuid"
}
```

The server loads the profile and uses it to configure the `query()` call.

### Updated Sessions Endpoint

`POST /api/sessions` accepts an optional `profileId`:

```json
{
  "title": "Debug auth module",
  "profileId": "uuid"
}
```

`GET /api/sessions` returns the profile info with each session:

```json
{
  "id": "session-uuid",
  "title": "Debug auth module",
  "profile": {
    "id": "profile-uuid",
    "name": "Code Reviewer",
    "icon": "magnifying_glass",
    "color": "#3B82F6"
  }
}
```

---

## 8. Frontend Components

### New Components

```
apps/desktop/src/
├── components/
│   ├── agent-builder/
│   │   ├── AgentBuilderPage.tsx          # Main page/route
│   │   ├── ProfileList.tsx               # Grid of profile cards
│   │   ├── ProfileCard.tsx               # Single profile card
│   │   ├── ProfileEditor.tsx             # Full editor layout with tabs
│   │   ├── ProfileEditorTabs.tsx         # Tab navigation
│   │   │
│   │   ├── tabs/
│   │   │   ├── GeneralTab.tsx            # Name, description, icon, color
│   │   │   ├── PromptTab.tsx             # System prompt editor
│   │   │   ├── ModelTab.tsx              # Model selector, effort, thinking
│   │   │   ├── ToolsTab.tsx              # Tool picker with cards
│   │   │   ├── HooksTab.tsx              # Hook list view + canvas toggle
│   │   │   ├── McpTab.tsx                # MCP server configuration
│   │   │   ├── SandboxTab.tsx            # Filesystem/network restrictions
│   │   │   └── AdvancedTab.tsx           # CWD, limits, subagents
│   │   │
│   │   ├── hook-canvas/
│   │   │   ├── HookCanvas.tsx            # React Flow wrapper
│   │   │   ├── HookCanvasStore.ts        # Zustand store for canvas state
│   │   │   ├── hookNodeTypes.ts          # Node type registration
│   │   │   ├── connectionRules.ts        # Validation logic
│   │   │   ├── canvasCompiler.ts         # Canvas -> hooks JSON
│   │   │   ├── canvasGenerator.ts        # hooks JSON -> canvas
│   │   │   ├── nodes/
│   │   │   │   ├── TriggerNode.tsx       # Hook event trigger node
│   │   │   │   ├── ConditionNode.tsx     # Matcher/filter node
│   │   │   │   └── ActionNode.tsx        # Hook action node
│   │   │   ├── panels/
│   │   │   │   ├── NodeConfigPanel.tsx   # Right sidebar config panel
│   │   │   │   └── NodePalette.tsx       # Left sidebar drag palette
│   │   │   └── templates/
│   │   │       └── HookTemplateGallery.tsx
│   │   │
│   │   ├── shared/
│   │   │   ├── ToolPicker.tsx            # Reusable tool selection UI
│   │   │   ├── ProfileSelector.tsx       # Dropdown for chat view
│   │   │   ├── ProfileBadge.tsx          # Small badge for session list
│   │   │   └── QueryOptionsPreview.tsx   # JSON preview of query() config
│   │   │
│   │   └── hooks/
│   │       ├── useAgentProfiles.ts       # CRUD operations
│   │       ├── useProfileValidation.ts   # Client-side validation
│   │       └── useHookDryRun.ts          # Test hooks against payloads
│   │
│   └── chat/
│       └── (existing chat components -- minor modifications)
│
├── stores/
│   └── agentProfileStore.ts              # Global state for profiles
│
└── lib/
    └── agentProfileApi.ts                # API client functions
```

### Zustand Store Shape

```typescript
// stores/agentProfileStore.ts
import { create } from "zustand";

interface AgentProfileStore {
  // Data
  profiles: AgentProfile[];
  selectedProfileId: string | null;
  editingProfile: AgentProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProfiles: () => Promise<void>;
  createProfile: (data: Partial<AgentProfile>) => Promise<AgentProfile>;
  updateProfile: (id: string, data: Partial<AgentProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  duplicateProfile: (id: string) => Promise<AgentProfile>;
  setSelectedProfile: (id: string | null) => void;
  setEditingProfile: (profile: AgentProfile | null) => void;
}

export const useAgentProfileStore = create<AgentProfileStore>((set, get) => ({
  profiles: [],
  selectedProfileId: null,
  editingProfile: null,
  isLoading: false,
  error: null,

  fetchProfiles: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/agent-profiles");
      const data = await res.json();
      set({ profiles: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createProfile: async (data) => {
    const res = await fetch("/api/agent-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const profile = await res.json();
    set({ profiles: [...get().profiles, profile] });
    return profile;
  },

  updateProfile: async (id, data) => {
    await fetch(`/api/agent-profiles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    set({
      profiles: get().profiles.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    });
  },

  deleteProfile: async (id) => {
    await fetch(`/api/agent-profiles/${id}`, { method: "DELETE" });
    set({ profiles: get().profiles.filter((p) => p.id !== id) });
  },

  duplicateProfile: async (id) => {
    const res = await fetch(`/api/agent-profiles/${id}/duplicate`, {
      method: "POST",
    });
    const profile = await res.json();
    set({ profiles: [...get().profiles, profile] });
    return profile;
  },

  setSelectedProfile: (id) => set({ selectedProfileId: id }),
  setEditingProfile: (profile) => set({ editingProfile: profile }),
}));
```

### Hook Canvas Zustand Store

```typescript
// hook-canvas/HookCanvasStore.ts
import {
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import { createWithEqualityFn } from "zustand/traditional";

export type HookCanvasState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  // React Flow callbacks
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<Node["data"]>) => void;
  setSelectedNode: (id: string | null) => void;
  clearCanvas: () => void;

  // Serialization
  loadFromJSON: (json: string) => void;
  toJSON: () => string;

  // Compilation
  compileToHooksJSON: () => string;
};

export const useHookCanvasStore = createWithEqualityFn<HookCanvasState>(
  (set, get) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,

    onNodesChange: (changes: NodeChange[]) => {
      set({ nodes: applyNodeChanges(changes, get().nodes) });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
      set({ edges: applyEdgeChanges(changes, get().edges) });
    },

    onConnect: (connection) => {
      // Validate connection before adding
      const { nodes } = get();
      const source = nodes.find((n) => n.id === connection.source);
      const target = nodes.find((n) => n.id === connection.target);

      if (!source || !target) return;

      // Triggers -> conditions or actions only
      if (source.type === "trigger" && target.type === "trigger") return;
      // Actions cannot be sources
      if (source.type === "action") return;
      // Conditions -> actions or conditions only
      if (source.type === "condition" && target.type === "trigger") return;

      set({
        edges: addEdge(
          { ...connection, type: "smoothstep", animated: true },
          get().edges
        ),
      });
    },

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    addNode: (node) => set({ nodes: [...get().nodes, node] }),

    removeNode: (id) =>
      set({
        nodes: get().nodes.filter((n) => n.id !== id),
        edges: get().edges.filter(
          (e) => e.source !== id && e.target !== id
        ),
      }),

    updateNodeData: (id, data) =>
      set({
        nodes: get().nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...data } }
            : node
        ),
      }),

    setSelectedNode: (id) => set({ selectedNodeId: id }),

    clearCanvas: () => set({ nodes: [], edges: [], selectedNodeId: null }),

    loadFromJSON: (json) => {
      try {
        const { nodes, edges } = JSON.parse(json);
        set({ nodes: nodes ?? [], edges: edges ?? [] });
      } catch {
        // Invalid JSON, do nothing
      }
    },

    toJSON: () => {
      const { nodes, edges } = get();
      return JSON.stringify({ nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } });
    },

    compileToHooksJSON: () => {
      const { nodes, edges } = get();
      const hooks = compileCanvasToHooks(nodes, edges);
      return JSON.stringify(hooks);
    },
  })
);
```

### Integration with Existing Chat Flow

The existing chat components need minimal changes:

1. **ChatView**: add profile selector dropdown (when starting a new session)
2. **SessionList**: show profile badge next to each session
3. **ChatInput**: (optional) show active profile indicator
4. **chat.ts route**: accept `profileId`, load profile, build query options

The `streamClaude` function in `apps/server/src/services/claude.ts` is extended:

```typescript
export interface ClaudeStreamOptions {
  // ... existing fields ...
  profile?: AgentProfile;  // NEW: if provided, overrides individual fields
}

export async function* streamClaude(
  options: ClaudeStreamOptions
): AsyncGenerator<StreamEvent> {
  const queryOptions: Record<string, unknown> = {
    includePartialMessages: true,
  };

  if (options.profile) {
    // Profile mode: build all options from profile
    Object.assign(queryOptions, buildQueryOptions(options.profile, options.sessionId));
  } else {
    // Legacy mode: use individual options (current behavior)
    if (options.sessionId) queryOptions.resume = options.sessionId;
    if (options.model) queryOptions.model = options.model;
    if (options.effort) queryOptions.effort = options.effort;
    // ... etc
  }

  // ... rest of streaming logic unchanged
}
```

---

## 9. Database Schema Changes

### Full DDL for New Tables

```sql
-- Agent profiles table
CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  description TEXT,
  icon TEXT,
  color TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  system_prompt TEXT,
  use_claude_code_prompt INTEGER NOT NULL DEFAULT 1,
  model TEXT,
  effort TEXT CHECK(effort IS NULL OR effort IN ('low', 'medium', 'high', 'max')),
  thinking_budget_tokens INTEGER,
  allowed_tools TEXT NOT NULL DEFAULT '[]',
  disallowed_tools TEXT NOT NULL DEFAULT '[]',
  permission_mode TEXT NOT NULL DEFAULT 'default'
    CHECK(permission_mode IN ('default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk')),
  hooks_json TEXT,
  hooks_canvas_json TEXT,
  mcp_servers_json TEXT,
  sandbox_json TEXT,
  cwd TEXT,
  additional_directories TEXT NOT NULL DEFAULT '[]',
  setting_sources TEXT NOT NULL DEFAULT '[]',
  max_turns INTEGER,
  max_budget_usd REAL,
  agents_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_name ON agent_profiles(name);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_sort_order ON agent_profiles(sort_order);

-- Hook templates table (Phase 3)
CREATE TABLE IF NOT EXISTS hook_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  hooks_json TEXT NOT NULL,
  hooks_canvas_json TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hook_templates_category ON hook_templates(category);
```

### Migration for Sessions Table

```typescript
// In schema.ts
export function migrateSessionsProfileId(db: import('bun:sqlite').Database): void {
  const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasProfileId = columns.some((col) => col.name === 'profile_id');
  if (!hasProfileId) {
    db.exec(`ALTER TABLE sessions ADD COLUMN profile_id TEXT REFERENCES agent_profiles(id) ON DELETE SET NULL`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_profile_id ON sessions(profile_id)`);
}
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend    │     │  Server API  │     │  SQLite DB   │
│              │     │              │     │              │
│  Profile     │────>│  CRUD        │────>│ agent_       │
│  Editor      │     │  routes      │     │ profiles     │
│              │     │              │     │              │
│  Canvas      │     │  Validation  │     │ hook_        │
│  (React Flow)│     │  routes      │     │ templates    │
│              │     │              │     │              │
│  Chat View   │────>│  Chat route  │────>│ sessions     │
│  (profile    │     │  (loads      │     │ (profile_id  │
│   selector)  │     │   profile)   │     │  FK)         │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## 10. Implementation Phases

### Phase 1: Agent Profile CRUD + Form Editor + Chat Integration

**Goal:** Users can create profiles, configure them via forms, and use them in chat.

**Backend:**
- [ ] Create `agent_profiles` table and migration
- [ ] Add `profile_id` column to sessions table
- [ ] CRUD routes for `/api/agent-profiles`
- [ ] Profile validation endpoint
- [ ] Extend `POST /api/chat` to accept `profileId`
- [ ] Extend `streamClaude()` to build options from profile
- [ ] Extend `POST /api/sessions` to accept `profileId`
- [ ] Tests for all new routes

**Frontend:**
- [ ] AgentBuilderPage with profile list
- [ ] ProfileCard component
- [ ] ProfileEditor with tabbed form (General, Prompt, Model, Tools, Advanced)
- [ ] Profile selector in new chat flow
- [ ] Profile badge in session list
- [ ] Zustand store for profiles
- [ ] API client functions

**Skip for Phase 1:** Hooks tab (just a JSON textarea), MCP tab (JSON textarea), Sandbox tab (JSON textarea), canvas view.

### Phase 2: Visual Hook Builder with React Flow

**Goal:** Users can visually compose hooks on a canvas.

**Frontend:**
- [ ] Install `@xyflow/react`
- [ ] HookCanvas component with React Flow
- [ ] TriggerNode, ConditionNode, ActionNode custom nodes
- [ ] Connection validation rules
- [ ] Node palette (left sidebar, drag to add)
- [ ] Node config panel (right sidebar, click to edit)
- [ ] Canvas-to-hooks-JSON compiler
- [ ] Hooks-JSON-to-canvas generator (for importing)
- [ ] List view / Canvas view toggle in Hooks tab
- [ ] Zustand store for canvas state
- [ ] Undo/redo support

**Backend:**
- [ ] No backend changes needed (canvas state stored in `hooks_canvas_json`)

### Phase 3: Templates, Testing, Import/Export

**Goal:** Pre-built templates, dry-run testing, and JSON import/export.

**Backend:**
- [ ] `hook_templates` table and migration
- [ ] Template CRUD routes
- [ ] Seed built-in templates (block rm, auto-format, notify, verify, etc.)
- [ ] Dry-run testing endpoint (`/api/agent-profiles/:id/hooks/dry-run`)
- [ ] Import/export hooks as Claude Code settings.json

**Frontend:**
- [ ] HookTemplateGallery component
- [ ] Template drag-to-canvas
- [ ] Dry-run testing panel (pick event, provide payload, see result)
- [ ] Import JSON button (file picker + parse)
- [ ] Export JSON button (download file)
- [ ] MCP tab with proper form fields (not just JSON textarea)
- [ ] Sandbox tab with proper form fields

### Phase 4: Advanced Features

**Goal:** Polish, power features, and community.

- [ ] Natural language profile configuration ("Create a profile that only reads code and never modifies anything")
- [ ] Profile duplication
- [ ] Profile version history
- [ ] Community template sharing (export as portable JSON bundles)
- [ ] Query options preview panel (show exactly what will be sent to SDK)
- [ ] Per-hook dry-run testing on the canvas (click an action node, test it)
- [ ] Custom subagent definitions editor with form UI
- [ ] Profile comparison view (diff two profiles)
- [ ] Profile usage analytics (which profiles are used most, success rates)

---

## 11. Key Technical Decisions

### Why SDK-Based Isolation Over CLI Subprocess

| Factor | SDK `query()` | CLI subprocess |
|--------|--------------|----------------|
| Isolation | `settingSources: []` = no leakage | Must manage `CLAUDE_CONFIG_DIR`, `--setting-sources`, etc. |
| Configuration | Direct JS options object | Environment variables + flags + temp files |
| Streaming | Native async generator | Parse stdout + stderr |
| Multi-turn | `resume` option built in | Session management via CLI flags |
| Error handling | Typed events | Parse error strings |
| Performance | In-process | Process spawn overhead |
| Already in use | Yes (current chat implementation uses `query()`) | No |

The SDK approach is strictly better. We are already using `query()` for chat. Profiles just add more options to the same call.

### Why React Flow Over Alternatives

| Factor | React Flow | Rete.js | Flume |
|--------|-----------|---------|-------|
| React-native | Yes | Framework-agnostic (needs adapters) | Yes |
| TypeScript | First-class | TypeScript but verbose | Basic |
| Maturity | 5+ years, used in production | Mature but smaller community | Less maintained |
| Custom nodes | Full React components | Custom but more complex | Custom but limited |
| Performance | Virtualization, memo patterns | Good | OK |
| Community | Largest (npm downloads) | Smaller | Smallest |
| Documentation | Excellent | Good | Minimal |
| Built-in components | MiniMap, Controls, Background, Panel | Plugins | Basic |
| Used by | Langflow, Flowise, n8n | Smaller tools | Niche |

React Flow is the clear winner. It is the industry standard for node-based UIs in React, already proven in AI workflow builders (Langflow, Flowise), and has the best documentation and TypeScript support.

### Why Hybrid Form + Canvas Over Canvas-Only

Most hook configurations are simple: one trigger, one condition, one action. A full canvas is overkill for these. But complex hook setups (multiple events, branching conditions, parallel actions) benefit enormously from visual representation.

The hybrid approach:
- **Form view (default)**: fast, accessible, works for 80% of use cases
- **Canvas view (opt-in)**: powerful, visual, works for the complex 20%
- **Both operate on the same data**: no sync issues, users can switch freely

This follows the pattern of VS Code AI Toolkit (dual creation paths) and the industry trend of progressive disclosure (Sim Studio, MindStudio).

### JSON as the Interchange Format

The hooks JSON format is identical to Claude Code's `settings.json` hooks format. This means:

1. **Zero transformation** on import/export
2. **Copy-paste compatible** with Claude Code documentation examples
3. **Version-controllable** (commit hook configs to git)
4. **Shareable** (send a JSON file to a colleague)
5. **Future-proof** (if Claude Code adds new hook events or types, the format still works)

We store two JSON blobs:
- `hooks_json`: the canonical hooks configuration (what gets sent to `query()`)
- `hooks_canvas_json`: the visual layout (React Flow state, for rendering the canvas)

The canvas is secondary. If a user imports a JSON file, we generate the canvas layout automatically. If they edit the JSON directly, the canvas regenerates. The hooks JSON is always the source of truth.

### Backward Compatibility Strategy

All changes are additive:

1. **Sessions table**: `profile_id` column added with `ON DELETE SET NULL`. Existing sessions have `NULL`, which means "no profile, use default behavior."
2. **Chat endpoint**: `profileId` is optional. Omitting it produces identical behavior to today.
3. **streamClaude()**: profile mode and legacy mode are separate code paths. Existing callers are unchanged.
4. **No breaking API changes**: all existing endpoints continue to work identically.

The only migration needed is adding the `profile_id` column to sessions and creating the `agent_profiles` table.

---

## Appendix A: Hook Event Quick Reference

For the visual builder, each trigger node needs to know about its event. Here is the complete reference:

| Event | Can Block? | Matcher Field | Common Use |
|-------|-----------|---------------|------------|
| SessionStart | No | source (startup/resume/clear/compact) | Load context, set env |
| SessionEnd | No | reason | Cleanup |
| UserPromptSubmit | Yes | (none) | Validate prompts |
| PreToolUse | Yes | tool_name | Block commands, modify inputs |
| PostToolUse | No | tool_name | Format code, log actions |
| PostToolUseFailure | No | tool_name | Error tracking |
| PermissionRequest | Yes | tool_name | Auto-approve/deny |
| Stop | Yes | (none) | Verify completion |
| StopFailure | No | error type | Alert on API errors |
| SubagentStart | No | agent_type | Track subagent lifecycle |
| SubagentStop | Yes | agent_type | Verify subagent output |
| TeammateIdle | Yes | (none) | Keep teammates active |
| TaskCompleted | Yes | (none) | Verify task quality |
| Notification | No | notification_type | Desktop alerts |
| PreCompact | No | trigger (manual/auto) | Pre-compaction prep |
| PostCompact | No | trigger | Context restore |
| ConfigChange | Yes | source | Audit config changes |
| InstructionsLoaded | No | load_reason | Track instruction loading |
| Elicitation | Yes | MCP server name | Auto-respond to MCP input |
| ElicitationResult | Yes | MCP server name | Modify MCP responses |
| WorktreeCreate | Yes | (none) | Custom worktree creation |
| WorktreeRemove | No | (none) | Worktree cleanup |

## Appendix B: Sample Profile Configurations

### Read-Only Code Reviewer

```json
{
  "name": "Code Reviewer",
  "description": "Reviews code without modifying anything",
  "icon": "magnifying_glass",
  "color": "#3B82F6",
  "system_prompt": "You are a senior code reviewer. Analyze code for bugs, security issues, performance problems, and style violations. Never modify files -- only read and report.",
  "use_claude_code_prompt": false,
  "model": "claude-sonnet-4-6",
  "effort": "high",
  "allowed_tools": ["Read", "Glob", "Grep"],
  "disallowed_tools": ["Bash", "Edit", "Write", "WebFetch"],
  "permission_mode": "dontAsk",
  "setting_sources": ["project"],
  "max_turns": 20
}
```

### Test Writer

```json
{
  "name": "Test Writer",
  "description": "Writes and runs tests for existing code",
  "icon": "test_tube",
  "color": "#10B981",
  "system_prompt": "You are a test engineer. Write comprehensive tests using the project's test framework. Run tests to verify they pass. Focus on edge cases and error handling.",
  "use_claude_code_prompt": true,
  "model": "claude-sonnet-4-6",
  "effort": "high",
  "allowed_tools": ["Read", "Glob", "Grep", "Edit", "Write", "Bash(bun test *)", "Bash(npm test *)"],
  "disallowed_tools": ["Bash(rm *)", "Bash(curl *)", "WebFetch"],
  "permission_mode": "acceptEdits",
  "setting_sources": ["project"],
  "hooks_json": "{\"Stop\":[{\"hooks\":[{\"type\":\"agent\",\"prompt\":\"Verify all tests pass. Run the test suite.\",\"timeout\":120}]}]}"
}
```

### Sandboxed Implementer

```json
{
  "name": "Sandboxed Implementer",
  "description": "Implements features with strict filesystem boundaries",
  "icon": "shield",
  "color": "#F59E0B",
  "system_prompt": null,
  "use_claude_code_prompt": true,
  "model": "claude-sonnet-4-6",
  "effort": "high",
  "allowed_tools": ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
  "disallowed_tools": ["WebFetch", "WebSearch"],
  "permission_mode": "acceptEdits",
  "setting_sources": ["project"],
  "sandbox_json": "{\"enabled\":true,\"autoAllowBashIfSandboxed\":true,\"filesystem\":{\"allowWrite\":[\"./src\",\"./tests\"],\"denyRead\":[\"~/.aws\",\"~/.ssh\"]},\"network\":{\"allowedDomains\":[\"github.com\",\"registry.npmjs.org\"]}}"
}
```
