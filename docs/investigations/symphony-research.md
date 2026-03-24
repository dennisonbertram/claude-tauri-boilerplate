# OpenAI Symphony Research

**Source:** https://github.com/openai/symphony
**Date:** 2026-03-23
**License:** Apache 2.0

---

## 1. What Symphony Is

Symphony is an orchestration service that polls an issue tracker (currently Linear), creates isolated per-issue workspaces, and spawns autonomous coding agents (Codex) to implement the work. It shifts the engineering model from supervising individual agents to managing a work board -- agents pick up tasks, implement them, submit PRs, handle review feedback, and merge autonomously.

**Key tagline concept:** "Manage work instead of supervising coding agents."

### Architecture Layers

The spec defines six abstraction layers:

| Layer | Responsibility |
|-------|---------------|
| **Policy** | Repo-defined workflow rules (`WORKFLOW.md`) |
| **Configuration** | Typed config with defaults + env var substitution |
| **Coordination** | Orchestrator -- polling, dispatch, retry, state |
| **Execution** | Workspace manager + agent subprocess |
| **Integration** | Tracker adapter (Linear, extensible) |
| **Observability** | Structured logs + optional dashboard/API |

### Core Components

1. **Workflow Loader** -- Parses `WORKFLOW.md` (YAML front matter + Liquid-compatible Markdown prompt template)
2. **Config Layer** -- Typed getters with defaults, `$VAR_NAME` env indirection, dynamic reload
3. **Issue Tracker Client** -- Fetches/normalizes issues from Linear (adapter pattern, extensible)
4. **Orchestrator** -- Single GenServer owning all runtime state: polling, dispatch, retry, reconciliation
5. **Workspace Manager** -- Per-issue filesystem isolation with lifecycle hooks
6. **Agent Runner** -- Prepares workspace, renders prompt, launches Codex subprocess, manages turns
7. **Status Surface** -- Optional Phoenix LiveView dashboard + terminal UI + HTTP API

---

## 2. Project/Task Management

### How Tasks Flow Through the System

```
Linear Board (Todo/In Progress/etc.)
    |
    v
[Orchestrator polls every N ms]
    |
    v
[Candidate Selection: priority sort, blocker check, slot availability]
    |
    v
[Dispatch: spawn worker, create/reuse workspace, run hooks]
    |
    v
[Agent Runner: multi-turn Codex session in isolated workspace]
    |
    v
[Agent handles PR, review, merge autonomously via WORKFLOW.md prompt]
    |
    v
[Orchestrator monitors: reconciliation, stall detection, retry on failure]
```

### Dispatch Rules

An issue is dispatch-eligible when:
- Has required fields (id, identifier, title, state)
- State is in `active_states` (e.g., "Todo", "In Progress") and NOT in `terminal_states`
- Not already running or claimed
- Global concurrency slots available (`max_concurrent_agents`, default 10)
- Per-state slots available (optional `max_concurrent_agents_by_state` map)
- Blocker rule: "Todo" issues cannot dispatch if any blocker is non-terminal

**Sort order:** priority ascending (1=Urgent, 4=Low), then oldest creation date, then identifier as tiebreaker.

### Concurrency Control

- Global cap: `max_concurrent_agents` (default 10)
- Per-state cap: optional map of state name to integer
- Per-host cap: optional for SSH worker extension
- All enforced at dispatch time

### Retry & Backoff

- **Continuation retry** (clean agent exit, issue still active): 1000ms fixed delay
- **Failure retry**: exponential backoff `min(10000 * 2^(attempt-1), max_retry_backoff_ms)`
- Default max backoff: 300,000ms (5 minutes)
- On retry: re-fetch issue, re-validate eligibility, dispatch if slots available

### Reconciliation (runs every poll tick)

1. **Stall detection**: If no agent events for `stall_timeout_ms`, terminate and schedule retry
2. **State refresh**: Fetch current Linear states for all running issues
3. **Terminal transition**: If issue reached Done/Closed/etc., terminate agent and clean workspace
4. **Startup cleanup**: On service start, query terminal issues and remove stale workspaces

---

## 3. Agent Interaction Model

### Agent Subprocess Protocol

Symphony launches agents via shell command (`bash -lc <codex.command>`) with:
- Working directory = per-issue workspace
- Communication = line-delimited JSON-RPC-like messages on stdout
- Stderr = diagnostics only

### Session Handshake

```
1. initialize request (client info + capabilities)
2. initialized notification
3. thread/start request (approval policy, sandbox, cwd)
4. turn/start request (prompt, cwd, title)
```

Session IDs composed as `<thread_id>-<turn_id>`.

### Multi-Turn Execution

Each agent run can span up to `max_turns` (default 20) turns:
- **Turn 1:** Full rendered prompt from `WORKFLOW.md` template
- **Subsequent turns:** Continuation guidance ("Resume from current workspace state")
- After each turn: fetch refreshed issue state from Linear
- Continue if issue still in active state and turns remain

### Tool Integration

Symphony provides **one built-in client-side tool** to agents:

**`linear_graphql`** -- Execute raw GraphQL queries against Linear using Symphony's auth token.
- Input: `{"query": "...", "variables": {...}}`
- One operation per call
- Agents use this to update issue states, add comments, manage PRs

The `DynamicTool` module handles tool registration and dispatch. Tool specs are advertised to the agent, and the agent can invoke them during turns.

**No MCP integration** -- Symphony uses a JSON-RPC-like subprocess protocol, not MCP. The agent process (Codex) runs as a child process with stdio communication. There's no MCP server/client relationship.

### Approval & Sandbox Policies

Configurable per workflow:
- `approval_policy` -- auto-approve, operator-confirm, or auto-fail
- `thread_sandbox` -- Codex sandbox setting
- `turn_sandbox_policy` -- per-turn sandbox
- Default: reject sandbox_approval, rules, and MCP elicitations

---

## 4. Data Model

### Issue Entity (Normalized)

```
Issue {
  id: string              -- Linear internal ID
  identifier: string      -- Human-readable key (e.g., "ABC-123")
  title: string
  description: string?
  priority: integer?      -- 1=Urgent, 2=High, 3=Normal, 4=Low
  state: string           -- Current workflow state name
  branch_name: string?    -- Git branch
  url: string?            -- Linear URL
  assignee_id: string?
  labels: [string]        -- Lowercased label names
  blocked_by: [string]    -- IDs of blocking issues
  assigned_to_worker: boolean  -- Default true
  created_at: datetime?
  updated_at: datetime?
}
```

### Workflow Definition

```
Workflow {
  config: map             -- Parsed YAML front matter
  prompt_template: string -- Markdown body (Liquid-compatible)
}
```

### Orchestrator Runtime State

```
State {
  running: map<issue_id, RunEntry>   -- Active agent sessions
  claimed: set<issue_id>             -- Reserved issues
  retry_attempts: map<issue_id, RetryEntry>
  completed: set<issue_id>
  codex_totals: TokenTotals?
  codex_rate_limits: RateLimits?
  poll_interval_ms: integer
  max_concurrent_agents: integer
}
```

### Run Entry (per running issue)

Contains: pid, monitor ref, identifier, session tracking (session_id, turn count, token usage), worker host, workspace path, started_at.

### Retry Entry

```
RetryEntry {
  issue_id: string
  attempt: integer        -- 1-based
  due_at_ms: integer
  timer_ref: reference
  error: string?
  identifier: string
}
```

### Service Config

```
Config {
  tracker: { kind, endpoint, api_key, project_slug, active_states, terminal_states }
  polling: { interval_ms }
  workspace: { root }
  hooks: { after_create, before_run, after_run, before_remove, timeout_ms }
  agent: { max_concurrent_agents, max_retry_backoff_ms, max_concurrent_agents_by_state }
  codex: { command, approval_policy, thread_sandbox, turn_sandbox_policy, turn_timeout_ms, ... }
}
```

---

## 5. Dashboard / Board View

### There Is No Kanban Board

Symphony does NOT implement its own kanban/board view. The "board" is **Linear itself**. Symphony monitors the Linear board and reacts to state changes. The dashboard is purely an **observability/monitoring** view, not a task management UI.

### Phoenix LiveView Dashboard

Accessible at `GET /` when `--port` flag is provided. Single-page real-time dashboard with:

#### Layout Structure
- **App shell**: max-width 1280px, centered
- **Hero grid**: Two-column layout (content + status) that collapses on mobile
- **Cards**: Hero cards (28px radius), section cards, metric cards, error cards

#### Sections
1. **Header** with status badge (live/offline)
2. **Error state** card (if snapshot unavailable)
3. **Metric cards** (4): Running sessions, Retrying issues, Token usage, Total runtime
4. **Rate limits** section
5. **Running sessions table**: State badge, session ID, runtime/turns, latest activity, token breakdown
6. **Retry queue table**: Issue, attempt count, due time

#### Real-Time Updates
- PubSub subscription to orchestrator state changes
- 1-second timer for elapsed time updates
- LiveView handles `:observability_updated` and `:runtime_tick` events

### Terminal Status Dashboard (Alternative)

A GenServer-based terminal UI (`StatusDashboard`) that:
- Renders to terminal with ANSI colors
- Shows running agents, retry queue, tokens/sec sparklines
- Debounced rendering (avoids flicker)
- Rolling TPS calculation over 5-second windows

### HTTP API Endpoints

```
GET  /api/v1/state              -- JSON runtime snapshot
GET  /api/v1/:issue_identifier  -- Issue-specific debug details
POST /api/v1/refresh            -- Trigger immediate poll cycle
```

---

## 6. Patterns Worth Adopting

### A. Workflow-as-Code Configuration

The `WORKFLOW.md` pattern is elegant:
- Single file defines both config (YAML) and agent instructions (Markdown template)
- Supports `$VAR_NAME` env variable indirection
- Dynamic reload via file watching -- edit the file, changes apply immediately
- Liquid-compatible templating with strict variable checking
- Versioned in the repo alongside the project

**Adoptable pattern:** A single configuration file that defines both system behavior and agent prompts, with hot-reload support.

### B. Orchestrator as Single-State GenServer

All runtime state in one place:
- `running` map, `claimed` set, `retry_attempts` map, `completed` set
- No external database for orchestrator state (in-memory only)
- Clean restart recovery: just re-poll the issue tracker
- Snapshot API for observability

**Adoptable pattern:** In-memory state machine for task orchestration, with the issue tracker as the source of truth. No need for a separate orchestration database.

### C. Workspace Isolation per Task

- Sanitized directory names from issue identifiers
- Path containment validation (no symlink escapes)
- Lifecycle hooks (after_create, before_run, after_run, before_remove)
- Workspaces persist across retries (agent can resume from existing state)

**Adoptable pattern:** Each task gets an isolated workspace. Hooks enable custom setup (git clone, dependency install) without hardcoding.

### D. Poll-Dispatch-Reconcile Loop

The core orchestration loop:
1. Reconcile running tasks (stall detection, state refresh)
2. Validate config
3. Fetch candidates from tracker
4. Sort by priority + age
5. Dispatch while slots available
6. Notify observers

**Adoptable pattern:** A single tick-based loop that handles all orchestration concerns. Simple, debuggable, deterministic.

### E. Exponential Backoff with Continuation Retries

Two retry strategies:
- **Continuation** (agent finished cleanly but issue still active): fast 1s retry
- **Failure** (crash, timeout, stall): exponential backoff with configurable cap

**Adoptable pattern:** Distinguish between "task needs more work" and "something went wrong" retries.

### F. Adapter Pattern for Issue Trackers

The `Tracker` behavior defines callbacks:
- `fetch_candidate_issues()`
- `fetch_issues_by_states(states)`
- `fetch_issue_states_by_ids(ids)`
- `create_comment(id, body)`
- `update_issue_state(id, state)`

With adapters: `Linear.Adapter`, `Tracker.Memory` (for testing).

**Adoptable pattern:** Abstract the issue tracker behind an interface so you can swap Linear for GitHub Issues, Jira, or a local SQLite-backed board.

### G. Agent-Driven State Transitions

Symphony's orchestrator does NOT write to the issue tracker. Agents handle:
- Moving issues between states
- Adding comments (workpad updates)
- Creating/updating PRs
- Merging PRs

The orchestrator only reads from the tracker and reacts.

**Adoptable pattern:** Let agents own the task lifecycle. The orchestrator observes and coordinates, but agents are responsible for marking work done.

### H. Observability-First Design

Three observability surfaces from the same state:
1. Structured logs (always on)
2. Terminal dashboard (optional, for CLI usage)
3. Phoenix LiveView web dashboard (optional, for browser usage)
4. JSON API (optional, for programmatic access)

All draw from the same orchestrator snapshot -- no divergent state.

**Adoptable pattern:** Build observability into the core state model, not as an afterthought.

### I. Single Workpad Comment Pattern

From the WORKFLOW.md prompt: each issue gets one persistent "Codex Workpad" comment that tracks all progress across turns/retries. This acts as the agent's scratchpad and audit trail.

**Adoptable pattern:** A single, persistent progress comment per task that accumulates context across agent sessions.

---

## 7. What Symphony Is NOT

- **Not a task management tool** -- It orchestrates agents against an existing board (Linear)
- **Not a kanban UI** -- The dashboard shows agent status, not task status
- **Not multi-model** -- Currently designed for Codex (OpenAI's coding agent)
- **Not MCP-based** -- Uses its own JSON-RPC-like subprocess protocol
- **Not a framework** -- It's a specification + reference implementation
- **No persistent orchestrator state** -- In-memory only, recoverable from tracker

---

## 8. Architecture Diagram

```
                    +------------------+
                    |   Linear Board   |
                    | (Source of Truth) |
                    +--------+---------+
                             |
                    Poll / Fetch / Reconcile
                             |
                    +--------v---------+
                    |   Orchestrator   |
                    | (GenServer/State)|
                    |                  |
                    | - running map    |
                    | - claimed set    |
                    | - retry queue    |
                    | - token totals   |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v----+  +-----v------+  +----v--------+
     | Agent Run 1 |  | Agent Run 2|  | Agent Run N |
     | (workspace) |  | (workspace)|  | (workspace) |
     +-------------+  +------------+  +-------------+
     | - Codex CLI |  | - Codex CLI|  | - Codex CLI |
     | - Git repo  |  | - Git repo |  | - Git repo  |
     | - Hooks     |  | - Hooks    |  | - Hooks     |
     +------+------+  +-----+------+  +------+------+
            |                |                |
            +-------+--------+-------+--------+
                    |                |
           +--------v------+  +-----v---------+
           | LiveView      |  | Terminal       |
           | Dashboard     |  | Dashboard      |
           | (Browser)     |  | (CLI)          |
           +---------------+  +----------------+
```

---

## 9. Key Differences from What We'd Build

| Aspect | Symphony | Our Tool |
|--------|----------|----------|
| **Board** | External (Linear) | Built-in (local SQLite) |
| **Agent** | Codex only | Claude Code SDK / multiple |
| **UI** | Monitoring dashboard only | Full task management UI |
| **State** | In-memory, no persistence | SQLite-backed |
| **Protocol** | JSON-RPC subprocess | Claude Agent SDK / MCP |
| **Scope** | Orchestration service | End-to-end task tool |
| **Runtime** | Elixir/OTP | TypeScript/Bun (our stack) |

---

## 10. Files Explored

```
/                          README.md, SPEC.md, LICENSE
/elixir/                   README.md, WORKFLOW.md, AGENTS.md, mix.exs
/elixir/lib/
  symphony_elixir.ex
  symphony_elixir/
    orchestrator.ex         -- Core state machine
    agent_runner.ex         -- Agent lifecycle
    workspace.ex            -- Filesystem isolation
    tracker.ex              -- Tracker behavior/adapter
    config.ex               -- Typed configuration
    workflow.ex             -- WORKFLOW.md parser
    workflow_store.ex        -- Workflow file watcher
    prompt_builder.ex        -- Template rendering
    status_dashboard.ex      -- Terminal UI
    http_server.ex           -- HTTP API server
    path_safety.ex           -- Path containment validation
    cli.ex                   -- CLI entry point
    ssh.ex                   -- SSH worker extension
    log_file.ex              -- Log management
    specs_check.ex           -- Spec validation
    codex/
      app_server.ex          -- Codex subprocess protocol
      dynamic_tool.ex        -- Client-side tool registration
    linear/
      adapter.ex             -- Linear tracker adapter
      client.ex              -- Linear GraphQL client
      issue.ex               -- Issue struct/normalization
    tracker/
      (memory adapter for testing)
    config/
      (config struct definitions)
  symphony_elixir_web/
    router.ex                -- Routes
    endpoint.ex              -- Phoenix endpoint
    presenter.ex             -- State -> display transform
    observability_pubsub.ex  -- PubSub for live updates
    static_assets.ex         -- Asset serving
    error_html.ex
    error_json.ex
    live/
      dashboard_live.ex      -- LiveView dashboard
    components/
      layouts.ex
    controllers/
      (API controllers)
/elixir/priv/static/
  dashboard.css              -- Dashboard styles
```
