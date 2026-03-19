# Claude Code Hooks -- Complete Research

**Date:** 2026-03-19
**Source:** Official Claude Code documentation (code.claude.com/docs/en/hooks, code.claude.com/docs/en/hooks-guide), context7 library research (/anthropics/claude-code, /websites/code_claude, /affaan-m/everything-claude-code)

---

## 1. Overview

Hooks are user-defined automation points that execute at specific stages of Claude Code's lifecycle. They provide **deterministic control** over Claude's behavior -- ensuring certain actions always happen rather than relying on the LLM to choose to run them.

Hooks can:
- Enforce project rules (block dangerous commands, protect files)
- Automate repetitive tasks (format code after edits, log commands)
- Integrate with external systems (notifications, audit logs, CI)
- Inject context (after compaction, at session start)
- Control tool permissions (auto-approve, deny, modify inputs)

---

## 2. Hook Types

There are four hook types:

### 2.1 Command Hooks (`type: "command"`)

Execute shell commands. Receive JSON input via stdin. Return results through exit codes and stdout/stderr.

```json
{
  "type": "command",
  "command": ".claude/hooks/my-script.sh",
  "timeout": 30
}
```

- Default timeout: **600 seconds**
- Support async execution with `"async": true` (fire-and-forget)
- Most common hook type

### 2.2 HTTP Hooks (`type: "http"`)

Send POST requests to a URL. JSON input sent as the request body. Response body uses the same format as command hooks.

```json
{
  "type": "http",
  "url": "http://localhost:8080/hooks/tool-use",
  "headers": {
    "Authorization": "Bearer $MY_TOKEN"
  },
  "allowedEnvVars": ["MY_TOKEN"],
  "timeout": 30
}
```

- Default timeout: **30 seconds**
- Non-2xx responses are non-blocking errors
- To block from HTTP, return 2xx with blocking JSON in the body
- Header values support `$VAR_NAME` / `${VAR_NAME}` interpolation (only for vars listed in `allowedEnvVars`)

### 2.3 Prompt Hooks (`type: "prompt"`)

Send single-turn evaluation to a Claude model. Return yes/no decisions as JSON.

```json
{
  "type": "prompt",
  "prompt": "Evaluate if this bash command is safe. $ARGUMENTS",
  "model": "optional-model-alias",
  "timeout": 30
}
```

- Default timeout: **30 seconds**
- `$ARGUMENTS` placeholder replaced with hook input JSON
- Model defaults to fast model (Haiku) if not specified
- Returns `{"ok": true}` or `{"ok": false, "reason": "..."}`

### 2.4 Agent Hooks (`type: "agent"`)

Spawn subagents with tool access (Read, Grep, Glob). Can verify conditions against the actual codebase before returning decisions.

```json
{
  "type": "agent",
  "prompt": "Verify that all unit tests pass. Run the test suite. $ARGUMENTS",
  "timeout": 120
}
```

- Default timeout: **60 seconds**
- Up to 50 tool-use turns
- Scoped to component's lifetime
- Same `ok`/`reason` response format as prompt hooks

---

## 3. All Hook Events (26 Total)

### 3.1 Lifecycle Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `SessionStart` | New session or resume | No (stderr shown to user) |
| `SessionEnd` | Session terminates | No (stderr shown to user) |
| `InstructionsLoaded` | CLAUDE.md or `.claude/rules/*.md` loaded | No (exit code ignored) |

### 3.2 User Input Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `UserPromptSubmit` | Before Claude processes user prompt | Yes (exit 2 blocks prompt) |

### 3.3 Tool Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `PreToolUse` | Before tool execution | Yes (exit 2 or JSON deny) |
| `PermissionRequest` | Permission dialog about to show | Yes (exit 2) |
| `PostToolUse` | After successful tool execution | No (stderr shown to Claude) |
| `PostToolUseFailure` | After tool failure | No (stderr shown to Claude) |

### 3.4 Agent/Team Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `SubagentStart` | Subagent spawned | No (stderr shown to user) |
| `SubagentStop` | Subagent finished | Yes (exit 2 blocks stop) |
| `Stop` | Main Claude finished responding | Yes (exit 2 blocks stop) |
| `StopFailure` | API error during response | No (output ignored) |
| `TeammateIdle` | Agent team member going idle | Yes (exit 2 or `continue: false`) |
| `TaskCompleted` | Task being marked complete | Yes (exit 2 or `continue: false`) |

### 3.5 Notification Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `Notification` | Claude Code sending notification | No (stderr shown to user) |

### 3.6 Compaction Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `PreCompact` | Before compaction | No (stderr shown to user) |
| `PostCompact` | After compaction completes | No (stderr shown to user) |

### 3.7 Configuration Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `ConfigChange` | Configuration file changed | Yes (except policy_settings) |

### 3.8 MCP/Input Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `Elicitation` | MCP server requesting user input | Yes (can respond programmatically) |
| `ElicitationResult` | User response to elicitation | Yes (can modify response) |

### 3.9 Worktree Events

| Event | When it fires | Can block? |
|-------|--------------|------------|
| `WorktreeCreate` | Creating isolated worktree | Yes (must print path or fail) |
| `WorktreeRemove` | Removing worktree | No (logged in debug mode) |

---

## 4. Configuration

### 4.1 Configuration Locations (Priority Order)

| Location | Scope | Shareable |
|----------|-------|-----------|
| `~/.claude/settings.json` | All projects (global) | No, local to machine |
| `.claude/settings.json` | Single project | Yes, committable |
| `.claude/settings.local.json` | Single project | No, gitignored |
| Managed policy settings | Organization-wide | Admin-controlled |
| Plugin `hooks/hooks.json` | When plugin enabled | Bundled with plugin |
| Skill/Agent frontmatter | While skill/agent active | Defined in component file |

### 4.2 Settings File Format

In `~/.claude/settings.json` or `.claude/settings.json`, hooks go inside a top-level `"hooks"` key:

```json
{
  "hooks": {
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
}
```

### 4.3 Plugin hooks.json Format

In a plugin's `hooks/hooks.json`, it is the same structure:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/security/scan-secrets.sh",
            "timeout": 30
          }
        ],
        "description": "Scan for secrets before file writes"
      }
    ]
  }
}
```

Note: Plugin hooks can include a `"description"` field. User settings cannot.

### 4.4 Hook Definition Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `"command"`, `"http"`, `"prompt"`, or `"agent"` |
| `command` | Yes (command) | Shell command to execute |
| `url` | Yes (http) | URL to POST to |
| `prompt` | Yes (prompt/agent) | Prompt text (`$ARGUMENTS` replaced with input JSON) |
| `headers` | No (http) | HTTP headers with env var interpolation |
| `allowedEnvVars` | No (http) | Env vars allowed in header interpolation |
| `model` | No (prompt/agent) | Model to use (defaults to fast model) |
| `timeout` | No | Seconds before canceling (defaults vary by type) |
| `statusMessage` | No | Custom spinner message during execution |
| `once` | No | Run only once per session (skills only) |
| `async` | No (command) | Run in background without blocking |

### 4.5 Disabling Hooks

```json
{
  "disableAllHooks": true
}
```

Disables user/project/local hooks. Does NOT disable managed hooks (admin can disable those separately). There is no per-hook disable option.

---

## 5. Matchers

Matchers are regex patterns that filter when a hook fires. Without a matcher (or with an empty string/`"*"`), the hook fires on every occurrence of its event.

### 5.1 Matcher Patterns by Event

| Event | What matcher filters | Example values |
|-------|---------------------|----------------|
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest` | Tool name | `Bash`, `Edit\|Write`, `mcp__github__.*` |
| `SessionStart` | How session started | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | Why session ended | `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` |
| `Notification` | Notification type | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` |
| `SubagentStart`, `SubagentStop` | Agent type | `Bash`, `Explore`, `Plan`, or custom names |
| `PreCompact`, `PostCompact` | Compaction trigger | `manual`, `auto` |
| `ConfigChange` | Configuration source | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |
| `StopFailure` | Error type | `rate_limit`, `authentication_failed`, `billing_error`, `invalid_request`, `server_error`, `max_output_tokens`, `unknown` |
| `InstructionsLoaded` | Load reason | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` |
| `Elicitation`, `ElicitationResult` | MCP server name | Your configured MCP server names |

### 5.2 Events with No Matcher Support

These events always fire on every occurrence:
- `UserPromptSubmit`
- `Stop`
- `TeammateIdle`
- `TaskCompleted`
- `WorktreeCreate`
- `WorktreeRemove`

### 5.3 Tool Name Examples for Matchers

Built-in tools:
- `Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Agent`, `WebFetch`, `WebSearch`

MCP tools follow the pattern `mcp__<server>__<tool>`:
- `mcp__github__search_repositories`
- `mcp__memory__create_entities`
- `mcp__filesystem__read_file`

Regex examples:
- `Edit|Write` -- matches Edit or Write
- `mcp__github__.*` -- matches all GitHub MCP tools
- `mcp__.*__write.*` -- matches write tools across all MCP servers
- `.*` -- matches everything (use with caution)

Matchers are **case-sensitive**.

---

## 6. Hook Input (What Hooks Receive)

### 6.1 Common Input Fields (All Events)

Every hook receives this JSON on stdin (command hooks) or as the request body (HTTP hooks):

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

When inside a subagent, two additional fields are present:
- `agent_id`: Unique subagent identifier
- `agent_type`: Agent name (e.g., "Explore")

### 6.2 Event-Specific Input Fields

**PreToolUse:**
```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

**PostToolUse:**
```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  },
  "tool_response": {
    "filePath": "/path/to/file.txt",
    "success": true
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

**UserPromptSubmit:**
```json
{
  "prompt": "Write a function to calculate factorial"
}
```

**SessionStart:**
```json
{
  "source": "startup",
  "model": "claude-sonnet-4-20250514"
}
```
Source values: `startup`, `resume`, `clear`, `compact`

**Stop / SubagentStop:**
```json
{
  "stop_hook_active": false,
  "last_assistant_message": "I've completed the task."
}
```
SubagentStop also includes: `agent_id`, `agent_type`, `agent_transcript_path`

**Notification:**
```json
{
  "message": "Claude needs your permission to use Bash",
  "title": "Permission needed",
  "notification_type": "permission_prompt"
}
```

**StopFailure:**
```json
{
  "error": "rate_limit",
  "error_details": "...",
  "last_assistant_message": "..."
}
```

**ConfigChange:**
```json
{
  "source": "project_settings",
  "file_path": "/path/to/.claude/settings.json"
}
```

**InstructionsLoaded:**
```json
{
  "file_path": "/path/to/CLAUDE.md",
  "memory_type": "...",
  "load_reason": "session_start"
}
```

**WorktreeCreate:**
```json
{
  "name": "worktree-slug-name"
}
```

**WorktreeRemove:**
```json
{
  "worktree_path": "/path/to/worktree"
}
```

### 6.3 Tool Input Shapes

| Tool | `tool_input` fields |
|------|-------------------|
| **Bash** | `command`, `description`, optional `timeout`, `run_in_background` |
| **Write** | `file_path`, `content` |
| **Edit** | `file_path`, `old_string`, `new_string`, `replace_all` |
| **Read** | `file_path`, optional `offset`, `limit` |
| **Glob** | `pattern`, optional `path` |
| **Grep** | `pattern`, optional `path`, `glob`, `output_mode`, `-i`, `multiline` |
| **WebFetch** | `url`, `prompt` |
| **WebSearch** | `query`, optional `allowed_domains`, `blocked_domains` |
| **Agent** | `prompt`, optional `description`, `subagent_type`, `model` |

---

## 7. Hook Output (Controlling Claude's Behavior)

### 7.1 Exit Codes

| Exit Code | Behavior |
|-----------|----------|
| **0** | Success. Action proceeds. JSON from stdout is parsed. For `UserPromptSubmit`/`SessionStart`, stdout text added to context. |
| **2** | Blocking error. Stdout/JSON ignored. Stderr fed back to Claude as feedback. |
| **Any other** | Non-blocking error. Stderr logged in verbose mode (`Ctrl+O`). Execution continues. |

**Important:** Claude Code ignores JSON when exit code is 2. Use exit 2 for simple block-with-reason, or exit 0 with JSON for structured control.

### 7.2 JSON Output Format (Exit 0)

#### Universal Fields

```json
{
  "continue": true,
  "stopReason": "message shown when continue is false",
  "suppressOutput": false,
  "systemMessage": "warning shown to user"
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `continue` | `true` | If `false`, Claude stops entirely |
| `stopReason` | none | Shown when `continue` is `false` |
| `suppressOutput` | `false` | Hide stdout from verbose mode |
| `systemMessage` | none | Warning shown to user |

### 7.3 Decision Control Patterns

**Pattern 1: Top-level `decision`**
Used by: `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStop`, `ConfigChange`

```json
{
  "decision": "block",
  "reason": "Why this is blocked"
}
```

**Pattern 2: `hookSpecificOutput` with `permissionDecision`**
Used by: `PreToolUse`

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Reason for the decision",
    "updatedInput": {
      "field_to_modify": "new value"
    },
    "additionalContext": "Extra context for Claude"
  }
}
```

`permissionDecision` values:
- `"allow"` -- skip the interactive permission prompt (but deny rules still take precedence)
- `"deny"` -- cancel the tool call; reason fed back to Claude
- `"ask"` -- show the normal permission prompt to the user

**Pattern 3: `hookSpecificOutput` with `decision.behavior`**
Used by: `PermissionRequest`

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": {},
      "updatedPermissions": [
        { "type": "setMode", "mode": "acceptEdits", "destination": "session" }
      ],
      "message": "reason for deny"
    }
  }
}
```

**Pattern 4: Exit 2 or `continue: false`**
Used by: `TeammateIdle`, `TaskCompleted`

```bash
exit 2  # stderr as feedback
```
or:
```json
{
  "continue": false,
  "stopReason": "Task not actually complete"
}
```

**Pattern 5: stdout Path**
Used by: `WorktreeCreate`

```bash
echo "/absolute/path/to/worktree"
```

**Pattern 6: `action` + `content`**
Used by: `Elicitation`, `ElicitationResult`

```json
{
  "hookSpecificOutput": {
    "hookEventName": "Elicitation",
    "action": "accept",
    "content": { "field": "value" }
  }
}
```

Action values: `accept`, `decline`, `cancel`

### 7.4 Prompt/Agent Hook Output

Prompt and agent hooks return a simpler format:

```json
{"ok": true}
```
or:
```json
{"ok": false, "reason": "What remains to be done"}
```

When `ok` is `false`, the reason is fed back to Claude so it can adjust.

---

## 8. Environment Variables

### 8.1 Available in All Hooks

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_REMOTE` | Set to `"true"` in remote/web environments |
| `$CLAUDE_PROJECT_DIR` | Project root directory (wrap in quotes for paths with spaces) |

### 8.2 Available in Plugin Hooks

| Variable | Description |
|----------|-------------|
| `${CLAUDE_PLUGIN_ROOT}` | Plugin installation directory |
| `${CLAUDE_PLUGIN_DATA}` | Plugin's persistent data directory |

### 8.3 SessionStart-Only

| Variable | Description |
|----------|-------------|
| `CLAUDE_ENV_FILE` | File path; write `export VAR=value` lines to persist env vars for subsequent Bash commands |

Example:
```bash
echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
```

### 8.4 SessionEnd Timeout Override

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | Override SessionEnd hook timeout (default: 1500ms) |

---

## 9. Practical Examples

### 9.1 Block Destructive Commands

`.claude/hooks/block-rm.sh`:
```bash
#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -q 'rm -rf'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Destructive command blocked by hook"
    }
  }'
else
  exit 0
fi
```

Settings:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-rm.sh"
          }
        ]
      }
    ]
  }
}
```

### 9.2 Auto-Format After Edits

```json
{
  "hooks": {
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
    ]
  }
}
```

### 9.3 Desktop Notifications (macOS)

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

### 9.4 Re-inject Context After Compaction

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing.'"
          }
        ]
      }
    ]
  }
}
```

### 9.5 Auto-Approve ExitPlanMode

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\": {\"hookEventName\": \"PermissionRequest\", \"decision\": {\"behavior\": \"allow\"}}}'"
          }
        ]
      }
    ]
  }
}
```

### 9.6 Verify Tests Before Stopping (Prompt Hook)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if all tasks are complete. If not, respond with {\"ok\": false, \"reason\": \"what remains\"}."
          }
        ]
      }
    ]
  }
}
```

### 9.7 Verify Tests Before Stopping (Agent Hook)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify that all unit tests pass. Run the test suite and check results. $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

### 9.8 Audit Configuration Changes

```json
{
  "hooks": {
    "ConfigChange": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '{timestamp: now | todate, source: .source, file: .file_path}' >> ~/claude-config-audit.log"
          }
        ]
      }
    ]
  }
}
```

### 9.9 Protect Sensitive Files

`.claude/hooks/protect-files.sh`:
```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
```

### 9.10 Log All Bash Commands

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' >> ~/.claude/command-log.txt"
          }
        ]
      }
    ]
  }
}
```

---

## 10. Limitations and Constraints

### 10.1 Timeouts

| Hook Type | Default Timeout |
|-----------|----------------|
| Command | 600 seconds (10 min) |
| HTTP | 30 seconds |
| Prompt | 30 seconds |
| Agent | 60 seconds |
| SessionEnd | 1.5 seconds (configurable via `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`) |

### 10.2 Execution Constraints

1. **Communication is one-way.** Command hooks communicate through stdout, stderr, and exit codes only. They cannot trigger commands or tool calls directly.
2. **PostToolUse cannot undo actions.** The tool has already executed by the time PostToolUse fires.
3. **PermissionRequest hooks do not fire in non-interactive mode (`-p`).** Use `PreToolUse` hooks for automated permission decisions in headless mode.
4. **Stop hooks fire whenever Claude finishes responding**, not only at task completion. They do NOT fire on user interrupts. API errors fire `StopFailure` instead.
5. **Deduplication.** Identical commands and identical URLs are deduplicated automatically. Otherwise hooks run in parallel.
6. **JSON must be clean.** If your shell profile (`.zshrc`, `.bashrc`) contains unconditional `echo` statements, they will pollute stdout and break JSON parsing. Wrap them in `if [[ $- == *i* ]]; then ... fi` checks.
7. **`allow` does not override deny rules.** PreToolUse returning `"allow"` skips the interactive prompt but does not override permission deny rules from any settings scope. Deny rules (including enterprise managed deny lists) always take precedence.
8. **No per-hook disable.** You can only disable all hooks at once with `"disableAllHooks": true`.

### 10.3 Stop Hook Infinite Loop Prevention

Stop hooks must check `stop_hook_active` to avoid infinite loops:

```bash
#!/bin/bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Allow Claude to stop -- this is the second pass
fi
# ... rest of hook logic
```

### 10.4 Shell Profile Interference

Hooks spawn a shell that sources your profile. If your profile outputs text unconditionally, it breaks JSON parsing:

```text
Shell ready on arm64
{"decision": "block", "reason": "Not allowed"}
```

Fix by guarding echo statements:
```bash
# In ~/.zshrc or ~/.bashrc
if [[ $- == *i* ]]; then
  echo "Shell ready"
fi
```

---

## 11. Debugging Hooks

1. **`/hooks` menu** -- Type `/hooks` in Claude Code to browse all configured hooks grouped by event. Read-only; shows event, matcher, type, source file, and command.
2. **Verbose mode** -- Toggle with `Ctrl+O` to see hook output in the transcript.
3. **`claude --debug`** -- Full execution details including which hooks matched and their exit codes.
4. **Manual testing** -- Pipe sample JSON to your script:
   ```bash
   echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh
   echo $?
   ```

---

## 12. Summary Table: Events at a Glance

| Event | Matcher Field | Can Block? | Hook Types | Key Use Cases |
|-------|--------------|------------|------------|---------------|
| SessionStart | source | No | command | Load context, set env vars |
| SessionEnd | reason | No | command | Cleanup, persist state |
| UserPromptSubmit | (none) | Yes | all | Validate prompts, inject context |
| PreToolUse | tool_name | Yes | all | Block commands, modify inputs |
| PermissionRequest | tool_name | Yes | all | Auto-approve/deny permissions |
| PostToolUse | tool_name | No* | all | Format code, log actions |
| PostToolUseFailure | tool_name | No | all | Error tracking |
| Stop | (none) | Yes | all | Verify completion |
| StopFailure | error type | No | all | Alerting on API errors |
| SubagentStart | agent_type | No | all | Track subagent lifecycle |
| SubagentStop | agent_type | Yes | all | Verify subagent output |
| TeammateIdle | (none) | Yes | all | Keep teammates active |
| TaskCompleted | (none) | Yes | all | Verify task quality |
| Notification | notification_type | No | all | Desktop alerts |
| PreCompact | trigger | No | all | Pre-compaction prep |
| PostCompact | trigger | No | all | Post-compaction context restore |
| ConfigChange | source | Yes** | all | Audit, block unauthorized changes |
| InstructionsLoaded | load_reason | No | all | Track instruction loading |
| Elicitation | MCP server name | Yes | all | Auto-respond to MCP input requests |
| ElicitationResult | MCP server name | Yes | all | Modify MCP responses |
| WorktreeCreate | (none) | Yes | command | Custom worktree creation |
| WorktreeRemove | (none) | No | command | Worktree cleanup |

*PostToolUse: stderr is shown to Claude but cannot prevent the already-executed action.
**ConfigChange: Cannot block `policy_settings`.
