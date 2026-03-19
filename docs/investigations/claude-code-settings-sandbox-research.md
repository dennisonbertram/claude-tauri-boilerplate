# Claude Code Configuration, Settings, and Sandbox Research

Comprehensive research on how Claude Code can be configured and run with isolated/custom settings, covering CLI flags, settings.json hierarchy, CLAUDE.md memory, the Claude Agent SDK, tool configuration, skills, sandboxing, and environment variables.

**Date:** 2026-03-19

---

## Table of Contents

1. [CLI Flags and Options](#1-cli-flags-and-options)
2. [Settings.json Configuration](#2-settingsjson-configuration)
3. [CLAUDE.md Memory System](#3-claudemd-memory-system)
4. [Claude Agent SDK (Programmatic Usage)](#4-claude-agent-sdk-programmatic-usage)
5. [Tool Configuration and Restrictions](#5-tool-configuration-and-restrictions)
6. [Skills System](#6-skills-system)
7. [Sandboxing and Isolation](#7-sandboxing-and-isolation)
8. [Relationship Between Configuration Layers](#8-relationship-between-configuration-layers)
9. [Environment Variables](#9-environment-variables)
10. [Practical Patterns for Custom/Isolated Execution](#10-practical-patterns-for-customisolated-execution)

---

## 1. CLI Flags and Options

Source: [CLI reference](https://code.claude.com/docs/en/cli-reference)

### Key Configuration Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--settings` | Path to a settings JSON file or a JSON string to load additional settings from | `claude --settings ./settings.json` |
| `--setting-sources` | Comma-separated list of setting sources to load (`user`, `project`, `local`) | `claude --setting-sources user,project` |
| `--model` | Sets the model for the current session (alias or full name) | `claude --model claude-sonnet-4-6` |
| `--system-prompt` | Replace the entire system prompt with custom text | `claude --system-prompt "You are a Python expert"` |
| `--append-system-prompt` | Append custom text to the end of the default system prompt | `claude --append-system-prompt "Always use TypeScript"` |
| `--system-prompt-file` | Replace system prompt with file contents | `claude --system-prompt-file ./prompts/review.txt` |
| `--append-system-prompt-file` | Append file contents to default prompt | `claude --append-system-prompt-file ./style-rules.txt` |
| `--allowedTools` | Tools that execute without prompting for permission | `"Bash(git log *)" "Read"` |
| `--disallowedTools` | Tools that are removed from the model's context entirely | `"Bash(git log *)" "Edit"` |
| `--tools` | Restrict which built-in tools Claude can use | `claude --tools "Bash,Edit,Read"` |
| `--permission-mode` | Begin in a specified permission mode | `claude --permission-mode plan` |
| `--dangerously-skip-permissions` | Skip permission prompts (use with caution) | `claude --dangerously-skip-permissions` |
| `--add-dir` | Add additional working directories for Claude to access | `claude --add-dir ../apps ../lib` |
| `--mcp-config` | Load MCP servers from JSON files or strings | `claude --mcp-config ./mcp.json` |
| `--strict-mcp-config` | Only use MCP servers from `--mcp-config`, ignoring all other MCP configurations | `claude --strict-mcp-config --mcp-config ./mcp.json` |
| `--agent` | Specify an agent for the current session | `claude --agent my-custom-agent` |
| `--agents` | Define custom subagents dynamically via JSON | `claude --agents '{"reviewer":{"description":"Reviews code","prompt":"..."}}'` |
| `--plugin-dir` | Load plugins from a directory for this session only | `claude --plugin-dir ./my-plugins` |
| `--effort` | Set effort level: `low`, `medium`, `high`, `max` | `claude --effort high` |
| `--max-turns` | Limit the number of agentic turns (print mode only) | `claude -p --max-turns 3 "query"` |
| `--max-budget-usd` | Maximum dollar amount to spend on API calls | `claude -p --max-budget-usd 5.00 "query"` |
| `--worktree`, `-w` | Start Claude in an isolated git worktree | `claude -w feature-auth` |
| `--disable-slash-commands` | Disable all skills and commands for this session | `claude --disable-slash-commands` |
| `--no-session-persistence` | Disable session persistence (print mode only) | `claude -p --no-session-persistence "query"` |
| `--debug` | Enable debug mode with optional category filtering | `claude --debug "api,mcp"` |
| `--verbose` | Enable verbose logging | `claude --verbose` |
| `--print`, `-p` | Print response without interactive mode (SDK mode) | `claude -p "query"` |
| `--output-format` | Specify output format: `text`, `json`, `stream-json` | `claude -p "query" --output-format json` |
| `--json-schema` | Get validated JSON output matching a schema (print mode) | `claude -p --json-schema '{"type":"object",...}' "query"` |
| `--betas` | Beta headers to include in API requests | `claude --betas interleaved-thinking` |
| `--fallback-model` | Automatic fallback model when default is overloaded | `claude -p --fallback-model sonnet "query"` |
| `--chrome` / `--no-chrome` | Enable/disable Chrome browser integration | `claude --chrome` |

### System Prompt Flags

`--system-prompt` and `--system-prompt-file` are mutually exclusive. The append flags can be combined with either replacement flag. For most use cases, use an append flag to preserve Claude Code's built-in capabilities while adding your requirements.

### Session Management Flags

| Flag | Description |
|------|-------------|
| `--continue`, `-c` | Load the most recent conversation in the current directory |
| `--resume`, `-r` | Resume a specific session by ID or name |
| `--session-id` | Use a specific session ID (must be a valid UUID) |
| `--fork-session` | When resuming, create a new session ID instead of reusing the original |
| `--name`, `-n` | Set a display name for the session |

### Profile Support

There is **no built-in `--profile` flag** as of March 2026. A [feature request exists](https://github.com/anthropics/claude-code/issues/7075) for profile support with isolated memory, commands, hooks, and settings. Community tools like [claude-code-profiles](https://github.com/pegasusheavy/claude-code-profiles) provide workaround profile management. The closest built-in alternatives are:

- `--settings` with a path to a custom settings file
- `--setting-sources` to control which settings scopes are loaded
- `CLAUDE_CONFIG_DIR` environment variable to point to a completely different config directory

---

## 2. Settings.json Configuration

Sources: [Claude Code settings](https://code.claude.com/docs/en/settings), [Settings reference](https://claudefa.st/blog/guide/settings-reference)

### Configuration Scopes

| Scope | Location | Who it affects | Shared with team? |
|-------|----------|----------------|-------------------|
| **Managed** | Server-managed, plist/registry, or system-level `managed-settings.json` | All users on the machine | Yes (deployed by IT) |
| **User** | `~/.claude/settings.json` | You, across all projects | No |
| **Project** | `.claude/settings.json` | All collaborators on this repository | Yes (committed to git) |
| **Local** | `.claude/settings.local.json` | You, in this repository only | No (gitignored) |

### Precedence (Highest to Lowest)

1. **Managed settings** (cannot be overridden by anything)
2. **Command line arguments** (temporary session overrides)
3. **Local project settings** (`.claude/settings.local.json`)
4. **Shared project settings** (`.claude/settings.json`)
5. **User settings** (`~/.claude/settings.json`)

Array settings (like `permissions.allow`, `sandbox.filesystem.allowWrite`) are **concatenated and deduplicated** across scopes, not replaced.

### Complete Settings Keys

| Key | Description | Example |
|-----|-------------|---------|
| `permissions` | Permission rules (see below) | `{"allow": [...], "deny": [...]}` |
| `permissions.allow` | Array of permission rules to allow | `["Bash(npm run lint)"]` |
| `permissions.deny` | Array of permission rules to deny | `["Bash(curl *)", "Read(./.env)"]` |
| `permissions.ask` | Array of permission rules requiring confirmation | `["Bash(git push *)"]` |
| `permissions.defaultMode` | Default permission mode | `"acceptEdits"` |
| `permissions.disableBypassPermissionsMode` | Prevent bypass mode | `"disable"` |
| `permissions.additionalDirectories` | Additional working directories | `["../docs/"]` |
| `env` | Environment variables for every session | `{"FOO": "bar"}` |
| `model` | Override default model | `"claude-sonnet-4-6"` |
| `availableModels` | Restrict which models users can select | `["sonnet", "haiku"]` |
| `modelOverrides` | Map model IDs to provider-specific IDs | `{"claude-opus-4-6": "arn:..."}` |
| `effortLevel` | Persist effort level across sessions | `"medium"` |
| `hooks` | Custom commands at lifecycle events | See hooks docs |
| `sandbox` | Sandbox configuration (see Section 7) | `{"enabled": true, ...}` |
| `apiKeyHelper` | Custom script to generate auth value | `/bin/generate_temp_api_key.sh` |
| `companyAnnouncements` | Announcements displayed at startup | `["Welcome to Acme Corp!"]` |
| `includeGitInstructions` | Include built-in git workflow instructions | `false` |
| `language` | Claude's preferred response language | `"japanese"` |
| `autoUpdatesChannel` | Release channel (`"stable"` or `"latest"`) | `"stable"` |
| `agent` | Run the main thread as a named subagent | `"code-reviewer"` |
| `forceLoginMethod` | Restrict login method | `"claudeai"` or `"console"` |
| `enableAllProjectMcpServers` | Auto-approve all MCP servers in `.mcp.json` | `true` |
| `enabledMcpjsonServers` | Specific approved MCP servers | `["memory", "github"]` |
| `disabledMcpjsonServers` | Specific rejected MCP servers | `["filesystem"]` |
| `enabledPlugins` | Plugin enable/disable map | `{"formatter@acme-tools": true}` |
| `attribution` | Customize git commit and PR attribution | `{"commit": "...", "pr": ""}` |
| `cleanupPeriodDays` | Session cleanup period (default: 30) | `20` |
| `autoMemoryDirectory` | Custom auto memory storage location | `"~/my-memory-dir"` |
| `plansDirectory` | Custom plan files storage | `"./plans"` |
| `outputStyle` | System prompt output style adjustment | `"Explanatory"` |
| `statusLine` | Custom status line command | `{"type": "command", "command": "..."}` |
| `fileSuggestion` | Custom `@` file autocomplete command | `{"type": "command", "command": "..."}` |
| `worktree.symlinkDirectories` | Directories to symlink in worktrees | `["node_modules", ".cache"]` |
| `worktree.sparsePaths` | Sparse checkout paths for worktrees | `["packages/my-app"]` |
| `claudeMdExcludes` | Skip specific CLAUDE.md files by path/glob | `["**/monorepo/CLAUDE.md"]` |
| `alwaysThinkingEnabled` | Enable extended thinking by default | `true` |
| `spinnerVerbs` | Customize spinner action verbs | `{"mode": "append", "verbs": ["Pondering"]}` |

### Permission Rule Syntax

Rules follow the format `Tool` or `Tool(specifier)`:

| Rule | Effect |
|------|--------|
| `Bash` | Matches all Bash commands |
| `Bash(npm run *)` | Matches commands starting with `npm run` |
| `Read(./.env)` | Matches reading the `.env` file |
| `Read(./secrets/**)` | Matches reading any file under secrets |
| `WebFetch(domain:example.com)` | Matches fetch requests to example.com |
| `Edit(./.env)` | Matches editing the `.env` file |
| `mcp__servername__*` | Matches all tools from an MCP server |
| `Skill(deploy *)` | Matches deploy skill with any args |

Rules are evaluated in order: deny rules first, then ask, then allow. The first matching rule wins.

### Example settings.json

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Read(~/.zshrc)"
    ],
    "deny": [
      "Bash(curl *)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)"
    ],
    "defaultMode": "acceptEdits"
  },
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1"
  },
  "model": "claude-sonnet-4-6",
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "filesystem": {
      "allowWrite": ["/tmp/build", "~/.kube"]
    },
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org"]
    }
  }
}
```

### Schema Validation

Adding `"$schema": "https://json.schemastore.org/claude-code-settings.json"` to your settings.json enables autocomplete and inline validation in VS Code, Cursor, and other editors that support JSON schema validation.

---

## 3. CLAUDE.md Memory System

Source: [How Claude remembers your project](https://code.claude.com/docs/en/memory)

### CLAUDE.md File Hierarchy

| Scope | Location | Purpose | Shared? |
|-------|----------|---------|---------|
| **Managed policy** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`; Linux/WSL: `/etc/claude-code/CLAUDE.md`; Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | Organization-wide instructions | All users |
| **Project instructions** | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team-shared project instructions | Via source control |
| **User instructions** | `~/.claude/CLAUDE.md` | Personal preferences for all projects | Just you |

### Loading Behavior

- Claude Code walks **up the directory tree** from your working directory, loading every CLAUDE.md it finds
- CLAUDE.md files in **subdirectories** are loaded on-demand when Claude reads files in those directories
- Files in ancestor directories are loaded **in full** at launch
- More specific instructions take precedence over broader ones
- Use `claudeMdExcludes` in settings to skip unwanted CLAUDE.md files in large monorepos

### Rules Directory (`.claude/rules/`)

For larger projects, split instructions into modular files:

```
.claude/
  CLAUDE.md           # Main project instructions
  rules/
    code-style.md     # Code style guidelines
    testing.md        # Testing conventions
    security.md       # Security requirements
```

Rules can be **path-specific** using YAML frontmatter:

```yaml
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules
- All API endpoints must include input validation
```

Rules without `paths` frontmatter are loaded unconditionally. User-level rules in `~/.claude/rules/` apply to every project.

### Imports

CLAUDE.md files can import additional files using `@path/to/import` syntax:

```markdown
See @README for project overview and @package.json for available npm commands.
@~/.claude/my-project-instructions.md
```

Maximum import depth: 5 hops.

### Auto Memory

- Claude automatically saves notes in `~/.claude/projects/<project>/memory/`
- `MEMORY.md` entrypoint (first 200 lines loaded at session start)
- Additional topic files loaded on demand
- Toggle with `/memory` or `autoMemoryEnabled` setting
- Disable via `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`

### Relationship with SDK

**Important:** To load CLAUDE.md files when using the Agent SDK, you must:
1. Set `settingSources: ["project"]` (or include `"project"` in the array)
2. Use `systemPrompt: { type: "preset", preset: "claude_code" }` to get the full Claude Code system prompt
3. Set `cwd` to the project directory

Without these, the SDK operates in isolation and does **not** load any filesystem settings or CLAUDE.md files.

---

## 4. Claude Agent SDK (Programmatic Usage)

Sources: [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview), [TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript), [Python reference](https://platform.claude.com/docs/en/agent-sdk/python)

### Installation

```bash
# TypeScript
npm install @anthropic-ai/claude-agent-sdk

# Python
pip install claude-agent-sdk
```

### Core Function: `query()`

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits",
    cwd: "/path/to/project",
    model: "claude-sonnet-4-6"
  }
})) {
  console.log(message);
}
```

### Complete Options Interface (TypeScript)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `abortController` | `AbortController` | `new AbortController()` | Controller for cancelling operations |
| `additionalDirectories` | `string[]` | `[]` | Additional directories Claude can access |
| `agent` | `string` | `undefined` | Agent name for the main thread |
| `agents` | `Record<string, AgentDefinition>` | `undefined` | Programmatically define subagents |
| `allowDangerouslySkipPermissions` | `boolean` | `false` | Enable bypassing permissions |
| `allowedTools` | `string[]` | `[]` | Tools to auto-approve (does NOT restrict Claude to only these) |
| `betas` | `SdkBeta[]` | `[]` | Enable beta features |
| `canUseTool` | `CanUseTool` | `undefined` | Custom permission function |
| `continue` | `boolean` | `false` | Continue the most recent conversation |
| `cwd` | `string` | `process.cwd()` | Current working directory |
| `debug` | `boolean` | `false` | Enable debug mode |
| `debugFile` | `string` | `undefined` | Write debug logs to file |
| `disallowedTools` | `string[]` | `[]` | Tools to always deny (overrides everything) |
| `effort` | `'low' \| 'medium' \| 'high' \| 'max'` | `'high'` | Effort level for responses |
| `enableFileCheckpointing` | `boolean` | `false` | Enable file change tracking |
| `env` | `Record<string, string \| undefined>` | `process.env` | Environment variables |
| `executable` | `'bun' \| 'deno' \| 'node'` | Auto-detected | JavaScript runtime |
| `fallbackModel` | `string` | `undefined` | Fallback model |
| `forkSession` | `boolean` | `false` | Fork when resuming |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | `{}` | Hook callbacks |
| `includePartialMessages` | `boolean` | `false` | Include partial streaming events |
| `maxBudgetUsd` | `number` | `undefined` | Maximum budget in USD |
| `maxTurns` | `number` | `undefined` | Maximum agentic turns |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP server configurations |
| `model` | `string` | CLI default | Claude model to use |
| `outputFormat` | `{ type: 'json_schema', schema: JSONSchema }` | `undefined` | Structured output format |
| `pathToClaudeCodeExecutable` | `string` | Built-in | Path to Claude Code executable |
| `permissionMode` | `PermissionMode` | `'default'` | Permission mode |
| `permissionPromptToolName` | `string` | `undefined` | MCP tool for permission prompts |
| `persistSession` | `boolean` | `true` | Enable session persistence |
| `plugins` | `SdkPluginConfig[]` | `[]` | Load custom plugins |
| `promptSuggestions` | `boolean` | `false` | Enable prompt suggestions |
| `resume` | `string` | `undefined` | Session ID to resume |
| `resumeSessionAt` | `string` | `undefined` | Resume at specific message UUID |
| `sandbox` | `SandboxSettings` | `undefined` | Sandbox configuration |
| `sessionId` | `string` | Auto-generated | Use a specific UUID |
| `settingSources` | `SettingSource[]` | `[]` (none) | Which filesystem settings to load |
| `spawnClaudeCodeProcess` | Function | `undefined` | Custom process spawner (VMs, containers) |
| `stderr` | `(data: string) => void` | `undefined` | Callback for stderr |
| `strictMcpConfig` | `boolean` | `false` | Enforce strict MCP validation |
| `systemPrompt` | `string \| { type: 'preset'; preset: 'claude_code'; append?: string }` | `undefined` (minimal) | System prompt configuration |
| `thinking` | `ThinkingConfig` | `{ type: 'adaptive' }` | Thinking/reasoning behavior |
| `toolConfig` | `ToolConfig` | `undefined` | Built-in tool behavior config |
| `tools` | `string[] \| { type: 'preset'; preset: 'claude_code' }` | `undefined` | Tool configuration |

### SettingSources

Controls which filesystem-based configuration sources the SDK loads from:

```typescript
type SettingSource = "user" | "project" | "local";
```

| Value | Description | Location |
|-------|-------------|----------|
| `'user'` | Global user settings | `~/.claude/settings.json` |
| `'project'` | Shared project settings | `.claude/settings.json` |
| `'local'` | Local project settings | `.claude/settings.local.json` |

**Critical behavior:** When `settingSources` is **omitted** or **undefined**, the SDK does **not** load any filesystem settings. This provides **isolation by default** for SDK applications.

```typescript
// Fully isolated - no filesystem settings loaded (default)
query({ prompt: "...", options: {} })

// Load project settings only
query({ prompt: "...", options: { settingSources: ["project"] } })

// Load all settings (legacy behavior)
query({ prompt: "...", options: { settingSources: ["user", "project", "local"] } })
```

### Permission Modes

```typescript
type PermissionMode =
  | "default"             // Standard permission behavior
  | "acceptEdits"         // Auto-accept file edits
  | "bypassPermissions"   // Bypass all permission checks
  | "plan"                // Planning mode - no execution
  | "dontAsk";            // Don't prompt, deny if not pre-approved
```

### Subagent Definitions

```typescript
type AgentDefinition = {
  description: string;      // When to use this agent
  tools?: string[];         // Allowed tool names (inherits all if omitted)
  disallowedTools?: string[]; // Explicitly disallowed tools
  prompt: string;           // System prompt
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  mcpServers?: AgentMcpServerSpec[];
  skills?: string[];        // Skill names to preload
  maxTurns?: number;
};
```

### Multi-turn Sessions

```typescript
let sessionId: string | undefined;

// First query: capture session ID
for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Resume with full context
for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

### V2 Interface (Preview)

A new V2 interface with `send()` and `stream()` patterns is available as a preview, making multi-turn conversations easier. See the [TypeScript V2 preview docs](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview).

---

## 5. Tool Configuration and Restrictions

Source: [Configure permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)

### Permission Evaluation Order

When Claude requests a tool, the SDK checks permissions in this order:

1. **Hooks** -- can allow, deny, or continue
2. **Deny rules** -- from `disallowedTools` and settings.json. If matched, tool is blocked even in `bypassPermissions`
3. **Permission mode** -- `bypassPermissions` approves everything reaching this step
4. **Allow rules** -- from `allowedTools` and settings.json
5. **canUseTool callback** -- if not resolved by above. In `dontAsk` mode, this step is skipped and tool is denied

### Built-in Tools

| Tool | What it does |
|------|-------------|
| **Read** | Read any file in the working directory |
| **Write** | Create new files |
| **Edit** | Make precise edits to existing files |
| **Bash** | Run terminal commands, scripts, git operations |
| **Glob** | Find files by pattern |
| **Grep** | Search file contents with regex |
| **WebSearch** | Search the web for current information |
| **WebFetch** | Fetch and parse web page content |
| **AskUserQuestion** | Ask the user clarifying questions |
| **Agent** | Delegate to subagents |
| **Skill** | Invoke skills |
| **Task** | Background task management |

### Restricting Tools

**CLI approach:**

```bash
# Restrict to specific tools only
claude --tools "Bash,Edit,Read"

# Disable all tools
claude --tools ""

# Pre-approve specific tools
claude --allowedTools "Bash(git log *)" "Bash(git diff *)" "Read"

# Block specific tools entirely
claude --disallowedTools "Bash(curl *)" "Edit"
```

**SDK approach:**

```typescript
// Read-only agent
query({
  prompt: "Review this code",
  options: {
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "dontAsk"  // Deny anything not listed
  }
})

// Agent with specific bash restrictions
query({
  prompt: "Fix the tests",
  options: {
    allowedTools: ["Read", "Edit", "Bash(npm test *)", "Bash(npm run lint)"],
    disallowedTools: ["Bash(curl *)", "Bash(rm *)"],
    permissionMode: "acceptEdits"
  }
})
```

### MCP Tool Patterns

```typescript
// All tools from a server
"mcp__github__*"

// Specific tool only
"mcp__db__query"

// Multiple servers
["mcp__github__*", "mcp__db__query", "mcp__slack__send_message"]
```

---

## 6. Skills System

Source: [Extend Claude with skills](https://code.claude.com/docs/en/skills)

### What Are Skills?

Skills are markdown files with optional YAML frontmatter that extend Claude's capabilities. They can be invoked with `/skill-name` or loaded automatically by Claude when relevant.

### Skill File Structure

```
my-skill/
  SKILL.md           # Main instructions (required)
  template.md        # Template for Claude to fill in
  examples/
    sample.md        # Example output
  scripts/
    validate.sh      # Script Claude can execute
```

### Skill Locations

| Location | Path | Applies to |
|----------|------|------------|
| Enterprise | Managed settings | All users in organization |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<skill-name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | Where plugin is enabled |

Priority: enterprise > personal > project.

### SKILL.md Frontmatter Reference

```yaml
---
name: my-skill
description: What this skill does and when to use it
argument-hint: "[issue-number]"
disable-model-invocation: true    # Only user can invoke
user-invocable: false              # Only Claude can invoke (background knowledge)
allowed-tools: Read, Grep, Glob   # Tool restrictions when skill is active
model: sonnet                      # Model override
context: fork                      # Run in isolated subagent
agent: Explore                     # Subagent type (Explore, Plan, general-purpose, or custom)
hooks: {}                          # Hooks scoped to this skill
---
```

### Invocation Control

| Frontmatter | You can invoke | Claude can invoke | When loaded |
|-------------|---------------|-------------------|-------------|
| (default) | Yes | Yes | Description always in context, full skill loads when invoked |
| `disable-model-invocation: true` | Yes | No | Description not in context |
| `user-invocable: false` | No | Yes | Description always in context |

### String Substitutions

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed when invoking |
| `$ARGUMENTS[N]` or `$N` | Specific argument by 0-based index |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_SKILL_DIR}` | Directory containing the SKILL.md |

### Dynamic Context Injection

Use `` !`command` `` syntax to run shell commands before the skill content is sent:

```yaml
---
name: pr-summary
context: fork
agent: Explore
---

## PR Context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
```

### Bundled Skills

| Skill | Purpose |
|-------|---------|
| `/batch <instruction>` | Orchestrate large-scale changes in parallel |
| `/claude-api` | Load Claude API reference material |
| `/debug [description]` | Troubleshoot current session |
| `/loop [interval] <prompt>` | Run a prompt repeatedly on schedule |
| `/simplify [focus]` | Review recently changed files for quality |

---

## 7. Sandboxing and Isolation

Source: [Sandboxing](https://code.claude.com/docs/en/sandboxing)

### Overview

Claude Code's sandbox uses OS-level primitives to enforce both filesystem and network isolation:
- **macOS:** Uses Seatbelt framework
- **Linux/WSL2:** Uses bubblewrap (requires `bubblewrap` and `socat` packages)
- **WSL1:** Not supported

### Sandbox Modes

**Auto-allow mode:** Sandboxed commands run automatically without permission. Commands that cannot be sandboxed fall back to regular permission flow.

**Regular permissions mode:** All commands go through standard permission flow, even when sandboxed.

### Filesystem Isolation

- **Default writes:** Read and write access to the current working directory and subdirectories
- **Default reads:** Read access to the entire computer, except certain denied directories
- **Blocked:** Cannot modify files outside cwd without explicit permission
- **Configurable:** Custom allowed and denied paths through settings

### Network Isolation

- Domain restrictions via proxy server running outside the sandbox
- New domain requests trigger permission prompts
- All subprocess commands inherit network restrictions

### Sandbox Settings in settings.json

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["docker", "git"],
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "allowWrite": ["/tmp/build", "~/.kube"],
      "denyWrite": ["/etc", "/usr/local/bin"],
      "denyRead": ["~/.aws/credentials"],
      "allowRead": ["."],
      "allowManagedReadPathsOnly": false
    },
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org"],
      "allowUnixSockets": ["~/.ssh/agent-socket"],
      "allowAllUnixSockets": false,
      "allowLocalBinding": true,
      "allowManagedDomainsOnly": false,
      "httpProxyPort": 8080,
      "socksProxyPort": 8081
    },
    "enableWeakerNestedSandbox": false,
    "enableWeakerNetworkIsolation": false
  }
}
```

### Path Prefix Resolution

| Prefix | Meaning | Example |
|--------|---------|---------|
| `/` | Absolute path from filesystem root | `/tmp/build` |
| `~/` | Relative to home directory | `~/.kube` becomes `$HOME/.kube` |
| `./` or no prefix | Relative to project root (project settings) or `~/.claude` (user settings) | `./output` |

### Security Limitations

- Network filtering operates by restricting domains, not inspecting traffic
- Broad domains like `github.com` may allow data exfiltration
- Domain fronting can bypass network filtering
- `allowUnixSockets` for Docker socket grants host access
- Overly broad filesystem write permissions can enable privilege escalation
- `enableWeakerNestedSandbox` considerably weakens security

### SDK Sandbox Configuration

```typescript
query({
  prompt: "...",
  options: {
    sandbox: {
      enabled: true,
      filesystem: {
        allowWrite: ["/tmp/build"],
        denyRead: ["~/.aws/credentials"]
      },
      network: {
        allowedDomains: ["github.com"]
      }
    }
  }
})
```

### Open Source Sandbox Runtime

The sandbox runtime is available as an open-source npm package:

```bash
npx @anthropic-ai/sandbox-runtime <command-to-sandbox>
```

GitHub: [sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime)

---

## 8. Relationship Between Configuration Layers

### How Everything Fits Together

```
                    ┌─────────────────────────────────────┐
                    │        Managed Policy                │
                    │  (cannot be overridden)              │
                    │  managed-settings.json               │
                    │  /Library/Application Support/       │
                    │  ClaudeCode/CLAUDE.md                │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │        CLI Arguments                  │
                    │  --settings, --setting-sources        │
                    │  --allowedTools, --model, etc.        │
                    └──────────────┬──────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
┌─────────▼─────────┐  ┌──────────▼──────────┐  ┌─────────▼─────────┐
│   Local Settings   │  │  Project Settings   │  │   User Settings   │
│ .claude/settings.  │  │ .claude/settings.   │  │ ~/.claude/        │
│   local.json       │  │   json              │  │   settings.json   │
│ (not committed)    │  │ (committed to git)  │  │ (personal global) │
└─────────┬─────────┘  └──────────┬──────────┘  └─────────┬─────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
┌─────────▼─────────┐  ┌──────────▼──────────┐  ┌─────────▼─────────┐
│   CLAUDE.md Files  │  │    Skills           │  │   MCP Servers     │
│ Project + User +   │  │ .claude/skills/     │  │ .mcp.json (proj)  │
│ Managed + Ancestor │  │ ~/.claude/skills/   │  │ ~/.claude.json    │
│ + Subdirectory     │  │ plugins/skills/     │  │ (user)            │
└───────────────────┘  └─────────────────────┘  └───────────────────┘
```

### Configuration Scope Summary

| Feature | User location | Project location | Local location |
|---------|--------------|-----------------|----------------|
| **Settings** | `~/.claude/settings.json` | `.claude/settings.json` | `.claude/settings.local.json` |
| **Subagents** | `~/.claude/agents/` | `.claude/agents/` | None |
| **MCP servers** | `~/.claude.json` | `.mcp.json` | `~/.claude.json` (per-project) |
| **Skills** | `~/.claude/skills/` | `.claude/skills/` | None |
| **CLAUDE.md** | `~/.claude/CLAUDE.md` | `CLAUDE.md` or `.claude/CLAUDE.md` | None |
| **Rules** | `~/.claude/rules/` | `.claude/rules/` | None |
| **Auto memory** | N/A | `~/.claude/projects/<project>/memory/` | N/A |

### SDK vs CLI Configuration

| Aspect | CLI | SDK |
|--------|-----|-----|
| Settings loading | Loads user + project + local by default | Loads **nothing** by default (must specify `settingSources`) |
| CLAUDE.md loading | Always loads from file hierarchy | Only if `settingSources` includes `"project"` AND `systemPrompt` uses `claude_code` preset |
| System prompt | Full Claude Code prompt by default | Minimal prompt by default (must opt in with `systemPrompt: { type: "preset", preset: "claude_code" }`) |
| Tool availability | All tools by default | All tools by default (but no auto-approve without `allowedTools`) |
| Permission mode | `default` (prompts user) | `default` (falls through to `canUseTool` callback) |
| Session persistence | On by default | On by default (disable with `persistSession: false`) |

---

## 9. Environment Variables

Sources: [Claude Code CLI Environment Variables gist](https://gist.github.com/unkn0wncode/f87295d055dd0f0e8082358a0b5cc467), [Model configuration](https://code.claude.com/docs/en/model-config)

### Authentication

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Primary API key for Claude API |
| `ANTHROPIC_AUTH_TOKEN` | Alternative bearer token (takes priority over API_KEY) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Pre-configured OAuth access token |
| `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` | OAuth refresh token for auto-renewal |

### Model Configuration

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_MODEL` | Override default Claude model |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Override default Haiku model ID |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Override default Sonnet model ID |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Override default Opus model ID |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Force specific model for sub-agent operations |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Maximum output tokens for responses |
| `CLAUDE_CODE_EFFORT_LEVEL` | Reasoning effort: `"low"`, `"medium"`, `"high"` |

### API Configuration

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_BASE_URL` | Custom API endpoint for proxies/alternative backends |
| `ANTHROPIC_CUSTOM_HEADERS` | Custom HTTP headers (newline-separated key:value pairs) |
| `ANTHROPIC_BETAS` | Comma-separated beta feature headers |
| `API_TIMEOUT_MS` | Request timeout in milliseconds (default: 600000) |
| `CLAUDE_CODE_EXTRA_BODY` | Additional JSON to merge into API requests |

### Provider Selection

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_USE_BEDROCK` | Route API calls through AWS Bedrock |
| `CLAUDE_CODE_USE_VERTEX` | Route API calls through Google Vertex AI |
| `CLAUDE_CODE_USE_FOUNDRY` | Route API calls through Azure AI Foundry |

### Core Configuration

| Variable | Description |
|----------|-------------|
| `CLAUDE_CONFIG_DIR` | Custom config directory (default: `~/.claude`) |
| `CLAUDE_CODE_TMPDIR` | Temp directory for operations |
| `CLAUDE_CODE_SHELL` | Override shell for Bash tool (`bash` or `zsh`) |
| `CLAUDE_CODE_SHELL_PREFIX` | Prefix command for shell execution |
| `CLAUDE_CODE_BASE_REF` | Git base ref for diff operations |

### Feature Flags (Enable)

| Variable | Description |
|----------|-------------|
| `ENABLE_LSP_TOOL` | Enable Language Server Protocol tool |
| `ENABLE_TOOL_SEARCH` | Tool search/deferred loading |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | Enable Claude.ai-hosted MCP servers |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Enable telemetry collection |
| `CLAUDE_CODE_ENABLE_TASKS` | Enable task list tools |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | Load CLAUDE.md from `--add-dir` directories |

### Feature Flags (Disable)

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | Disable 1M context window |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | Disable CLAUDE.md loading entirely |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable automatic memory feature |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | Disable background task functionality |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | Disable experimental beta features |
| `CLAUDE_CODE_DISABLE_THINKING` | Completely disable extended thinking |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | Disable fast mode |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | Disable feedback survey popup |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Reduce non-critical network requests |
| `DISABLE_TELEMETRY` | Disable all telemetry collection |
| `DISABLE_ERROR_REPORTING` | Disable automatic error reporting |
| `DISABLE_PROMPT_CACHING` | Disable prompt caching globally |
| `DISABLE_AUTOUPDATER` | Disable automatic update checker |

### Privacy

| Variable | Description |
|----------|-------------|
| `DISABLE_TELEMETRY` | Disable all telemetry |
| `DISABLE_ERROR_REPORTING` | Disable error reporting |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | Disable feedback survey |

### Tool Configuration

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Max concurrent tool executions (default: 10) |
| `BASH_MAX_OUTPUT_LENGTH` | Max bash output characters (default: 30000, max: 150000) |
| `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` | Glob operation timeout (default: 20) |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | Character budget for slash command output |

### MCP Configuration

| Variable | Description |
|----------|-------------|
| `MCP_TIMEOUT` | MCP server connection timeout (default: 30000ms) |
| `MCP_TOOL_TIMEOUT` | Individual MCP tool execution timeout |
| `MAX_MCP_OUTPUT_TOKENS` | Max tokens for MCP tool output (default: 25000) |

### SDK-Specific

| Variable | Description |
|----------|-------------|
| `CLAUDE_AGENT_SDK_VERSION` | Agent SDK version string |
| `CLAUDE_AGENT_SDK_CLIENT_APP` | Client application name (set in `env` option) |
| `CLAUDE_AGENT_SDK_MCP_NO_PREFIX` | Don't prefix tool names with server name |
| `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS` | Disable built-in agent types |
| `DEBUG_SDK` | Enable SDK debug logging |

### Agent Teams (Experimental)

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable experimental agent teams |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | Require agents to use plan mode |
| `CLAUDE_CODE_PLAN_V2_AGENT_COUNT` | Number of agents (1-10) |

### Setting Environment Variables

Environment variables can be set in three ways:
1. **Shell-level:** `export ANTHROPIC_MODEL=claude-sonnet-4-6`
2. **In settings.json:** `"env": { "ANTHROPIC_MODEL": "claude-sonnet-4-6" }`
3. **SDK options:** `options: { env: { ANTHROPIC_MODEL: "claude-sonnet-4-6" } }`

Shell-level variables override settings.json values.

---

## 10. Practical Patterns for Custom/Isolated Execution

### Pattern 1: Fully Isolated SDK Agent

Run Claude with no filesystem settings, custom tools, and a custom system prompt:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Analyze this codebase for security issues",
  options: {
    // No settingSources = fully isolated (default)
    systemPrompt: "You are a security auditor. Only read code, never modify.",
    allowedTools: ["Read", "Glob", "Grep"],
    disallowedTools: ["Bash", "Edit", "Write"],
    permissionMode: "dontAsk",
    cwd: "/path/to/project",
    model: "claude-opus-4-6",
    maxTurns: 10,
    maxBudgetUsd: 2.00,
    persistSession: false
  }
})) {
  // Process messages
}
```

### Pattern 2: CLI with Custom Settings File

```bash
# Create a custom settings file
cat > /tmp/review-settings.json << 'EOF'
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep"],
    "deny": ["Bash", "Edit", "Write", "WebFetch"]
  }
}
EOF

# Run Claude Code with only these settings
claude --settings /tmp/review-settings.json \
       --setting-sources "" \
       --append-system-prompt "You are a code reviewer. Only analyze, never modify." \
       -p "Review the auth module for security issues"
```

### Pattern 3: Sandboxed Execution

```bash
# Enable sandbox with strict network isolation
claude --permission-mode acceptEdits

# Or configure in settings.json for persistent sandboxing
```

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "allowWrite": ["./src", "./tests"],
      "denyRead": ["~/.ssh", "~/.aws"],
      "denyWrite": ["~/.bashrc", "~/.zshrc"]
    },
    "network": {
      "allowedDomains": ["github.com", "registry.npmjs.org"]
    }
  }
}
```

### Pattern 4: Isolated Config Directory

Use `CLAUDE_CONFIG_DIR` for completely separate configuration:

```bash
# Create isolated config
mkdir -p /tmp/isolated-claude
echo '{"permissions": {"deny": ["Bash(rm *)"]}}' > /tmp/isolated-claude/settings.json

# Run with isolated config
CLAUDE_CONFIG_DIR=/tmp/isolated-claude claude -p "query"
```

### Pattern 5: SDK Agent with Project Context but Custom Permissions

```typescript
query({
  prompt: "Implement the feature described in CLAUDE.md",
  options: {
    // Load project settings to get CLAUDE.md
    settingSources: ["project"],
    systemPrompt: { type: "preset", preset: "claude_code" },
    // But override permissions
    allowedTools: ["Read", "Edit", "Write", "Bash(npm test *)"],
    disallowedTools: ["Bash(rm *)", "Bash(curl *)", "WebFetch"],
    permissionMode: "acceptEdits",
    cwd: "/path/to/project",
    // Sandbox for additional isolation
    sandbox: {
      enabled: true,
      filesystem: {
        allowWrite: ["./src", "./tests"],
        denyRead: ["~/.aws"]
      }
    }
  }
})
```

### Pattern 6: Worktree Isolation for Parallel Agents

```bash
# Start Claude in isolated git worktree
claude -w feature-auth "Implement the auth module"

# Or from SDK
query({
  prompt: "Implement the auth module",
  options: {
    cwd: "/path/to/project/.claude/worktrees/feature-auth",
    settingSources: ["project"],
    systemPrompt: { type: "preset", preset: "claude_code" }
  }
})
```

### Pattern 7: Headless CI/CD Agent

```typescript
query({
  prompt: "Run the test suite and fix any failing tests",
  options: {
    settingSources: ["project"],  // Only team-shared settings
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    disallowedTools: ["WebFetch", "WebSearch"],  // No network tools
    maxTurns: 20,
    maxBudgetUsd: 10.00,
    persistSession: false,
    env: {
      CLAUDE_AGENT_SDK_CLIENT_APP: "ci-test-fixer",
      DISABLE_TELEMETRY: "1"
    }
  }
})
```

---

## Sources

- [CLI reference](https://code.claude.com/docs/en/cli-reference) -- Complete CLI commands and flags
- [Claude Code settings](https://code.claude.com/docs/en/settings) -- Settings.json configuration reference
- [How Claude remembers your project](https://code.claude.com/docs/en/memory) -- CLAUDE.md and auto memory
- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- SDK overview and capabilities
- [Agent SDK reference - TypeScript](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Complete TypeScript API reference
- [Agent SDK reference - Python](https://platform.claude.com/docs/en/agent-sdk/python) -- Complete Python API reference
- [Configure permissions](https://platform.claude.com/docs/en/agent-sdk/permissions) -- SDK permission modes and rules
- [Extend Claude with skills](https://code.claude.com/docs/en/skills) -- Skills system documentation
- [Sandboxing](https://code.claude.com/docs/en/sandboxing) -- Sandbox isolation documentation
- [Claude Code CLI Environment Variables](https://gist.github.com/unkn0wncode/f87295d055dd0f0e8082358a0b5cc467) -- Comprehensive environment variable list
- [Feature request: Claude Code profiles](https://github.com/anthropics/claude-code/issues/7075) -- Profile feature request
- [claude-code-profiles](https://github.com/pegasusheavy/claude-code-profiles) -- Community profile management tool
- [Model configuration](https://code.claude.com/docs/en/model-config) -- Model selection and configuration
- [sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) -- Open source sandbox package
