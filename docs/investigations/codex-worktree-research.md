# Multi-Workspace Desktop App with Git Worktrees + Claude SDK

**Date:** 2026-03-15
**Status:** Research complete
**Topic:** Architecture patterns for building a multi-workspace desktop app (like conductor.build) that uses git worktrees for workspace isolation, with a separate Claude SDK agent per worktree.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Patterns for Managing Multiple Git Worktrees](#2-architecture-patterns-for-managing-multiple-git-worktrees)
3. [Claude SDK Session Management Per Worktree](#3-claude-sdk-session-management-per-worktree)
4. [Process Isolation Strategies](#4-process-isolation-strategies)
5. [UX Patterns: Sidebar with Projects and Workspaces](#5-ux-patterns-sidebar-with-projects-and-workspaces)
6. [Worktree Lifecycle Management](#6-worktree-lifecycle-management)
7. [Existing Implementations and References](#7-existing-implementations-and-references)
8. [Recommended Architecture for This Project](#8-recommended-architecture-for-this-project)
9. [Sources](#9-sources)

---

## 1. Executive Summary

The "multi-workspace agent orchestrator" pattern has emerged as a dominant architecture in AI-assisted coding tools throughout 2025-2026. The core idea: each coding task gets its own **git worktree** (an isolated working copy of the repo sharing the same `.git` directory), and each worktree gets its own **Claude SDK session** with `cwd` pointed at that worktree path. A parent desktop app coordinates creation, monitoring, and cleanup of these workspace-agent pairs.

Key findings:

- **Git worktrees** are the correct isolation primitive (not full clones). They share the repo's `.git` directory, are lightweight (~ms to create), and avoid duplicating history.
- **Claude Agent SDK `query()`** natively supports a `cwd` option that sets the working directory per session. Each `query()` call spawns a **separate child process**, so parallel sessions are naturally process-isolated.
- **Each workspace should be a separate `query()` call / process**. The SDK spawns a Node.js child process per `query()`, so you get process isolation for free. No need for manual process management.
- **Conductor.build, Pane (runpane.com), Mozzie, Commander, and Code-Conductor** are all production implementations of this pattern that can be studied.
- The **V2 preview API** (`unstable_v2_createSession()`) simplifies multi-turn management with explicit `send()`/`stream()` patterns.

---

## 2. Architecture Patterns for Managing Multiple Git Worktrees

### 2.1 Core Concepts

A git worktree is a linked working tree that shares the same `.git` directory as the main repo. Key commands:

```bash
# Create a worktree with a new branch
git worktree add ../worktrees/feature-auth -b feature-auth

# Create from existing branch
git worktree add ../worktrees/fix-login fix-login

# List all worktrees
git worktree list

# Remove a worktree
git worktree remove ../worktrees/feature-auth

# Clean up stale worktree references
git worktree prune
```

### 2.2 Directory Layout Strategies

**Strategy A: Sibling directories (recommended by Conductor, Pane)**
```
~/projects/
  my-repo/                  # Main checkout
  my-repo-worktrees/
    feature-auth/           # Worktree 1
    fix-login/              # Worktree 2
    refactor-db/            # Worktree 3
```

**Strategy B: Nested under `.claude/worktrees/` (used by Claude Code CLI)**
```
my-repo/
  .claude/
    worktrees/
      feature-auth/         # Worktree 1
      fix-login/            # Worktree 2
  src/
  package.json
```

**Strategy C: Under a dedicated app data directory (recommended for desktop apps)**
```
~/.claude-tauri/
  worktrees/
    <repo-hash>/
      feature-auth/         # Worktree 1
      fix-login/            # Worktree 2
```

For a desktop app, **Strategy C** is cleanest. It keeps worktrees out of the user's project directory and centralizes them under the app's data directory. The app maintains a database mapping worktree paths to project metadata.

### 2.3 Programmatic Worktree Management in Node.js

**Option 1: Shell out to `git` (simplest, recommended)**
```typescript
import { execSync, exec } from "child_process";

class WorktreeManager {
  constructor(private repoPath: string) {}

  async create(name: string, baseBranch = "main"): Promise<string> {
    const worktreePath = `${this.getWorktreeDir()}/${name}`;
    const branchName = `workspace/${name}`;
    execSync(
      `git worktree add "${worktreePath}" -b "${branchName}" "${baseBranch}"`,
      { cwd: this.repoPath }
    );
    return worktreePath;
  }

  async list(): Promise<WorktreeInfo[]> {
    const output = execSync("git worktree list --porcelain", {
      cwd: this.repoPath,
      encoding: "utf-8",
    });
    return this.parseWorktreeList(output);
  }

  async remove(name: string): Promise<void> {
    const worktreePath = `${this.getWorktreeDir()}/${name}`;
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: this.repoPath,
    });
  }

  async prune(): Promise<void> {
    execSync("git worktree prune", { cwd: this.repoPath });
  }

  private getWorktreeDir(): string {
    return `${this.repoPath}/.claude-tauri/worktrees`;
  }

  private parseWorktreeList(output: string): WorktreeInfo[] {
    // Parse `git worktree list --porcelain` output
    const entries = output.split("\n\n").filter(Boolean);
    return entries.map((entry) => {
      const lines = entry.split("\n");
      return {
        path: lines[0]?.replace("worktree ", "") ?? "",
        head: lines[1]?.replace("HEAD ", "") ?? "",
        branch: lines[2]?.replace("branch refs/heads/", "") ?? "",
      };
    });
  }
}
```

**Option 2: Use `git-worktree` npm package**
```typescript
import { WorktreeClient } from "git-worktree";

const client = new WorktreeClient("/path/to/repo");
const worktrees = await client.list();
```

**Option 3: Use `simple-git` (popular, full git wrapper)**
```typescript
import simpleGit from "simple-git";

const git = simpleGit("/path/to/repo");
// simple-git doesn't have native worktree support,
// but you can use .raw() for any git command
await git.raw(["worktree", "add", "../wt/feature", "-b", "feature"]);
```

**Recommendation:** Shell out directly to `git`. The worktree API is simple (5 commands), and a thin wrapper is all you need. Avoid adding a dependency for something this straightforward.

### 2.4 Dependency Installation in Worktrees

A critical gotcha: git worktrees share `.git` but NOT `node_modules`, `_build`, or other build artifacts. Each new worktree starts with empty dependency directories.

**Solutions:**

1. **Run install on worktree creation** (simplest, what Conductor does):
   ```typescript
   async createWithDeps(name: string): Promise<string> {
     const path = await this.create(name);
     execSync("pnpm install --frozen-lockfile", { cwd: path });
     return path;
   }
   ```

2. **Symlink `node_modules`** from main repo (fast but fragile):
   ```typescript
   import { symlinkSync } from "fs";
   symlinkSync(`${repoPath}/node_modules`, `${worktreePath}/node_modules`);
   ```

3. **Use pnpm's content-addressable store** (best with pnpm). Since pnpm hard-links packages from a central store, `pnpm install` in a new worktree is near-instant because files are already cached locally.

4. **Setup scripts** (Conductor's approach): Allow users to define a setup script that runs after worktree creation to handle `.env` files, deps, etc.

---

## 3. Claude SDK Session Management Per Worktree

### 3.1 The `cwd` Option

The Claude Agent SDK's `query()` function accepts a `cwd` option that sets the working directory for the spawned Claude process. This is the primary mechanism for pointing an agent at a specific worktree.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Each worktree gets its own query() with its own cwd
const agent = query({
  prompt: "Implement the login feature",
  options: {
    cwd: "/path/to/worktrees/feature-auth",  // Points to worktree
    permissionMode: "acceptEdits",
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    maxTurns: 50,
    settingSources: ["project"],  // Load CLAUDE.md from worktree
  },
});
```

### 3.2 Full Options Reference (Relevant Subset)

| Option | Type | Default | Use for Worktrees |
|--------|------|---------|-------------------|
| `cwd` | `string` | `process.cwd()` | **Primary** -- set to worktree path |
| `additionalDirectories` | `string[]` | `[]` | Grant access to dirs outside worktree |
| `abortController` | `AbortController` | auto | Cancel the agent from the parent app |
| `maxTurns` | `number` | unlimited | Prevent runaway agents |
| `maxBudgetUsd` | `number` | unlimited | Cost control per workspace |
| `resume` | `string` | undefined | Resume a previous session in this worktree |
| `sessionId` | `string` | auto-generated | Use a specific session ID |
| `persistSession` | `boolean` | `true` | Save session for later resumption |
| `settingSources` | `SettingSource[]` | `[]` | Load settings from worktree's `.claude/` |
| `spawnClaudeCodeProcess` | function | default | Custom process spawning |
| `env` | `Record<string, string>` | `process.env` | Custom env vars per workspace |
| `enableFileCheckpointing` | `boolean` | `false` | Track file changes for rewind |
| `debug` | `boolean` | `false` | Debug logging |

### 3.3 Multi-Workspace Session Manager

```typescript
import { query, type Query } from "@anthropic-ai/claude-agent-sdk";

interface Workspace {
  id: string;
  name: string;
  worktreePath: string;
  branch: string;
  query: Query | null;
  sessionId: string | null;
  status: "idle" | "running" | "error" | "completed";
  abortController: AbortController;
}

class WorkspaceSessionManager {
  private workspaces = new Map<string, Workspace>();

  async startAgent(workspaceId: string, prompt: string): Promise<void> {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

    ws.abortController = new AbortController();
    ws.status = "running";

    const q = query({
      prompt,
      options: {
        cwd: ws.worktreePath,
        abortController: ws.abortController,
        permissionMode: "acceptEdits",
        maxTurns: 50,
        maxBudgetUsd: 5.0,
        settingSources: ["project"],
        enableFileCheckpointing: true,
        env: {
          ...process.env,
          CLAUDE_AGENT_SDK_CLIENT_APP: "claude-tauri-workspaces",
        },
      },
    });

    ws.query = q;

    // Stream events from the agent
    try {
      for await (const message of q) {
        if (message.type === "system" && message.subtype === "init") {
          ws.sessionId = message.session_id;
        }
        // Forward events to the frontend via SSE or WebSocket
        this.emitToFrontend(workspaceId, message);
      }
      ws.status = "completed";
    } catch (err) {
      ws.status = "error";
      this.emitToFrontend(workspaceId, { type: "error", error: err });
    }
  }

  async stopAgent(workspaceId: string): Promise<void> {
    const ws = this.workspaces.get(workspaceId);
    if (ws?.query) {
      ws.abortController.abort();
      ws.query.close();
      ws.status = "idle";
    }
  }

  async resumeAgent(workspaceId: string, prompt: string): Promise<void> {
    const ws = this.workspaces.get(workspaceId);
    if (!ws?.sessionId) throw new Error("No session to resume");

    const q = query({
      prompt,
      options: {
        cwd: ws.worktreePath,
        resume: ws.sessionId,  // Resume previous conversation
        permissionMode: "acceptEdits",
      },
    });

    ws.query = q;
    // ... stream events as above
  }

  private emitToFrontend(workspaceId: string, event: unknown): void {
    // Implementation depends on your IPC layer (Tauri events, SSE, WebSocket)
  }
}
```

### 3.4 V2 Preview API (Simpler Multi-Turn)

The new V2 preview API makes multi-turn conversations significantly simpler:

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from "@anthropic-ai/claude-agent-sdk";

// Create a session tied to a worktree
const session = unstable_v2_createSession({
  model: "claude-opus-4-6",
  cwd: "/path/to/worktrees/feature-auth",
  permissionMode: "acceptEdits",
});

// Turn 1
await session.send("Set up the authentication module with JWT");
for await (const msg of session.stream()) {
  forwardToFrontend(workspaceId, msg);
}

// Turn 2 (same session, maintains context)
await session.send("Now add rate limiting to the login endpoint");
for await (const msg of session.stream()) {
  forwardToFrontend(workspaceId, msg);
}

// Store session ID for later
const savedId = session.sessionId;
session.close();

// Later: resume from where we left off
const resumed = unstable_v2_resumeSession(savedId, {
  model: "claude-opus-4-6",
  cwd: "/path/to/worktrees/feature-auth",
});
await resumed.send("Add tests for the rate limiter");
```

### 3.5 Streaming Events to Multiple Frontends

Each workspace agent streams events independently. The backend multiplexes these to the frontend:

```typescript
// In your Hono server
app.get("/api/workspaces/:id/stream", async (c) => {
  const workspaceId = c.req.param("id");
  return streamSSE(c, async (stream) => {
    const workspace = manager.getWorkspace(workspaceId);
    for await (const event of workspace.eventStream()) {
      await stream.writeSSE({
        data: JSON.stringify(event),
        event: event.type,
      });
    }
  });
});
```

---

## 4. Process Isolation Strategies

### 4.1 How the Claude SDK Spawns Processes

Each call to `query()` spawns a **separate child process** running the Claude Code CLI. The SDK:

1. Locates the Claude Code executable (bundled or system-installed)
2. Spawns it as a child process via Node.js `child_process.spawn()`
3. Communicates over stdin/stdout using a JSON protocol
4. The child process has its own `cwd`, env, and filesystem access

This means **parallel `query()` calls are already process-isolated by default**. No additional isolation work is needed for basic use cases.

### 4.2 Process Isolation Options

| Approach | Isolation Level | Complexity | Use When |
|----------|----------------|------------|----------|
| **Multiple `query()` calls** (default) | Process-level | Low | Standard desktop app (recommended) |
| **`spawnClaudeCodeProcess` override** | Custom process | Medium | Need VM/container isolation |
| **Separate Node.js workers** | Thread + process | Medium | Need memory isolation from host |
| **Docker containers per workspace** | Full container | High | Production/hosted/multi-tenant |

### 4.3 Default Pattern (Recommended for Desktop)

```
Parent App (Tauri + Hono sidecar)
  ├── query() → Claude Process 1 (cwd: /worktrees/feature-a)
  ├── query() → Claude Process 2 (cwd: /worktrees/fix-bug)
  └── query() → Claude Process 3 (cwd: /worktrees/refactor)
```

Each Claude process:
- Has its own PID, memory space, and file descriptors
- Can be individually killed via `AbortController` or `query.close()`
- Has its own `cwd` pointing to a different worktree
- Shares the same Anthropic API key but uses separate sessions

### 4.4 Resource Considerations

Per the official SDK docs, each instance requires approximately:
- **1 GiB RAM**
- **5 GiB disk** (for the worktree + deps)
- **1 CPU core**

For a desktop app running 3-5 parallel agents, budget:
- **4-8 GB RAM** overhead for agents
- **15-25 GB disk** for worktrees with dependencies
- **3-5 CPU cores** dedicated to agent work

### 4.5 Custom Spawn for Advanced Isolation

The `spawnClaudeCodeProcess` option allows custom process spawning:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const q = query({
  prompt: "Fix the bug",
  options: {
    cwd: worktreePath,
    spawnClaudeCodeProcess: ({ command, args, cwd, env, signal }) => {
      // Custom spawn logic: could use Docker, SSH to remote, etc.
      const proc = spawn(command, args, {
        cwd,
        env,
        signal,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return {
        stdout: proc.stdout,
        stdin: proc.stdin,
        stderr: proc.stderr,
        on: proc.on.bind(proc),
        kill: proc.kill.bind(proc),
      };
    },
  },
});
```

---

## 5. UX Patterns: Sidebar with Projects and Workspaces

### 5.1 Hierarchy Model

All existing implementations (Conductor, Pane, Mozzie) use a two-level hierarchy:

```
Project (repo)
  └── Workspace (worktree + agent)
       ├── Chat/Agent panel
       ├── Diff viewer
       ├── File explorer
       └── Terminal
```

### 5.2 Sidebar Design Patterns

**Pattern A: Conductor's approach (flat list with status)**
```
┌─────────────────────┐
│ Projects             │
│ ┌─────────────────┐ │
│ │ my-app           │ │
│ │  ● auth-feature  │ │  ← green dot = agent running
│ │  ○ fix-nav       │ │  ← gray dot = idle
│ │  ◉ refactor-db   │ │  ← orange dot = needs review
│ │  + New workspace  │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ api-server       │ │
│ │  ● rate-limiting │ │
│ │  + New workspace  │ │
│ └─────────────────┘ │
└─────────────────────┘
```

**Pattern B: Pane's approach (tabs/panes, not sidebar tree)**
```
┌──────┬──────┬──────┬──────┐
│ auth │ nav  │ db   │  +   │  ← top tab bar
├──────┴──────┴──────┴──────┤
│  [agent] [diff] [files]   │  ← sub-tabs within workspace
│                            │
│  Chat with agent here...   │
│                            │
└────────────────────────────┘
```

**Pattern C: VS Code-style tree (recommended for this project)**
```
┌─────────────────────────┐
│ WORKSPACES              │
│ ▼ my-app                │
│   ▼ auth-feature    🟢  │  ← collapsible with status badge
│     ↳ branch: ws/auth   │
│     ↳ 3 files changed   │
│     ↳ $0.42 spent       │
│   ▶ fix-nav         ⏸   │
│   ▶ refactor-db     ✓   │
│ ▼ api-server            │
│   ▶ rate-limiting   🟢  │
│ ─────────────────────── │
│ + Add Project            │
│ + New Workspace          │
└─────────────────────────┘
```

### 5.3 Status Indicators

| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| Running | spinner/dot | green | Agent actively working |
| Idle | pause | gray | Waiting for user input |
| Completed | checkmark | blue | Task finished, ready for review |
| Error | exclamation | red | Agent hit an error |
| Reviewing | eye | orange | Changes ready for review |
| Merging | merge icon | purple | PR/merge in progress |

### 5.4 Workspace Detail Panel

When a workspace is selected, the main panel shows:

1. **Chat view** (primary) -- the conversation with the agent
2. **Diff view** -- what the agent has changed (`git diff` in that worktree)
3. **File explorer** -- browse the worktree's files
4. **Terminal** -- optional shell access to the worktree
5. **Activity log** -- tool calls, file edits, commands run

### 5.5 Key UX Interactions

- **Create workspace**: Select project, name the workspace, optionally pick a base branch or GitHub issue. The app creates the worktree, installs deps, and spins up an agent.
- **Switch workspace**: Click in sidebar. Loads that workspace's chat history and agent state.
- **Stop agent**: Abort button (calls `query.close()` / `AbortController.abort()`).
- **Review changes**: Inline diff viewer showing what the agent modified.
- **Merge/PR**: One-click to create a PR or merge the branch back to main.
- **Delete workspace**: Removes worktree, cleans up branch, optionally removes the agent session.

---

## 6. Worktree Lifecycle Management

### 6.1 Lifecycle Stages

```
[Create] → [Setup] → [Active] → [Review] → [Merge/Discard] → [Cleanup]
```

### 6.2 Detailed Lifecycle

**Stage 1: Create**
```typescript
async function createWorkspace(
  projectPath: string,
  name: string,
  baseBranch = "main"
): Promise<Workspace> {
  const worktreePath = getWorktreePath(projectPath, name);
  const branch = `workspace/${name}`;

  // Create worktree with new branch
  execSync(
    `git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`,
    { cwd: projectPath }
  );

  return { id: uuid(), name, worktreePath, branch, status: "created" };
}
```

**Stage 2: Setup (dependencies, env files)**
```typescript
async function setupWorkspace(ws: Workspace): Promise<void> {
  // Install dependencies
  execSync("pnpm install --frozen-lockfile", { cwd: ws.worktreePath });

  // Copy .env if it exists in main repo
  const mainEnv = path.join(getMainRepoPath(ws), ".env");
  const wsEnv = path.join(ws.worktreePath, ".env");
  if (existsSync(mainEnv)) {
    copyFileSync(mainEnv, wsEnv);
  }

  // Run user-defined setup script if present
  const setupScript = path.join(ws.worktreePath, ".claude-tauri/setup.sh");
  if (existsSync(setupScript)) {
    execSync(`bash "${setupScript}"`, { cwd: ws.worktreePath });
  }

  ws.status = "ready";
}
```

**Stage 3: Active (agent working)**
```typescript
async function activateWorkspace(ws: Workspace, prompt: string): Promise<void> {
  ws.status = "active";
  ws.abortController = new AbortController();

  ws.query = query({
    prompt,
    options: {
      cwd: ws.worktreePath,
      abortController: ws.abortController,
      permissionMode: "acceptEdits",
      maxTurns: 50,
      enableFileCheckpointing: true,
    },
  });

  for await (const msg of ws.query) {
    ws.sessionId = msg.session_id;
    emitToFrontend(ws.id, msg);
  }

  ws.status = "review";
}
```

**Stage 4: Review**
```typescript
async function getWorkspaceDiff(ws: Workspace): Promise<string> {
  return execSync("git diff HEAD", {
    cwd: ws.worktreePath,
    encoding: "utf-8",
  });
}

async function getChangedFiles(ws: Workspace): Promise<string[]> {
  const output = execSync("git diff --name-only HEAD", {
    cwd: ws.worktreePath,
    encoding: "utf-8",
  });
  return output.trim().split("\n").filter(Boolean);
}
```

**Stage 5: Merge or Discard**
```typescript
async function mergeWorkspace(ws: Workspace, targetBranch = "main"): Promise<void> {
  // Commit any uncommitted changes in worktree
  execSync('git add -A && git commit -m "workspace: final changes"', {
    cwd: ws.worktreePath,
  });

  // Merge into target branch from main repo
  const mainRepoPath = getMainRepoPath(ws);
  execSync(`git merge "${ws.branch}"`, { cwd: mainRepoPath });

  ws.status = "merged";
}

async function createPR(ws: Workspace): Promise<string> {
  execSync(`git push origin "${ws.branch}"`, { cwd: ws.worktreePath });
  const prUrl = execSync(
    `gh pr create --title "Workspace: ${ws.name}" --body "Changes from workspace agent" --head "${ws.branch}"`,
    { cwd: ws.worktreePath, encoding: "utf-8" }
  );
  return prUrl.trim();
}
```

**Stage 6: Cleanup**
```typescript
async function cleanupWorkspace(ws: Workspace): Promise<void> {
  // Close agent if running
  if (ws.query) {
    ws.abortController?.abort();
    ws.query.close();
  }

  // Remove worktree
  const mainRepoPath = getMainRepoPath(ws);
  execSync(`git worktree remove "${ws.worktreePath}" --force`, {
    cwd: mainRepoPath,
  });

  // Optionally delete the branch if merged
  if (ws.status === "merged") {
    execSync(`git branch -d "${ws.branch}"`, { cwd: mainRepoPath });
  }

  // Prune stale worktree references
  execSync("git worktree prune", { cwd: mainRepoPath });
}
```

### 6.3 Automatic Cleanup Strategies

1. **On app close**: Prompt user about active worktrees. Offer to keep or remove.
2. **TTL-based**: Auto-remove worktrees idle for more than X days.
3. **Post-merge**: Automatically clean up after successful merge/PR.
4. **Orphan detection**: On startup, detect worktrees without matching database entries and offer cleanup.

### 6.4 Important Gotchas

- **Cannot checkout same branch in two worktrees.** Each worktree must have a unique branch.
- **Worktrees share reflog and objects.** A `git gc` in one worktree affects all.
- **Deleting a worktree directory without `git worktree remove` leaves stale refs.** Always use the git command, or call `git worktree prune` afterward.
- **Submodules in worktrees** can be tricky. Run `git submodule update --init` after creating a worktree if the repo uses submodules.

---

## 7. Existing Implementations and References

### 7.1 Conductor.build (Closed Source, macOS)

- **URL**: https://www.conductor.build/
- **Architecture**: macOS desktop app for running Claude Code and Codex agents in parallel
- **Worktree management**: Automatic. Each workspace is a git worktree.
- **Agent model**: Each workspace runs an independent Claude Code instance
- **Key UX**: Dashboard showing all active agents, diff-first review model, GitHub PR integration
- **Naming**: Workspaces get unique city names for easy identification
- **Review flow**: Review diffs per-thread, comment directly on diffs with GitHub sync
- **Versions**: v0.28.0 (Dec 2025) added workspace history; v0.29.0 (Jan 2026) added diff commenting

### 7.2 Pane / runpane.com (Closed Source, Cross-Platform)

- **URL**: https://www.runpane.com/
- **Architecture**: Tauri v2 shell, React + Zustand frontend, Rust backend
- **Key pattern**: "Panes and tabs" -- one pane per feature, one worktree per pane. Tabs for agents, diff viewer, file explorer, git tree, logs inside each pane.
- **Worktree management**: Invisible to user. Creating a pane creates a worktree; deleting a pane cleans it up.
- **Multi-agent**: Can run Claude in one tab and Codex in another within the same pane
- **Persistence**: Everything persists across restarts
- **Keyboard-first**: Heavy use of keyboard shortcuts

### 7.3 Code-Conductor (Open Source)

- **URL**: https://github.com/ryanmac/code-conductor
- **Architecture**: GitHub-native orchestration. Agents claim GitHub Issues labeled `conductor:task`, create worktrees, implement, and open PRs.
- **Worktree management**: Each agent creates its own worktree per claimed task
- **Agent model**: Multiple Claude Code sub-agents running in parallel
- **Auto-detection**: Installer detects tech stack and configures accordingly
- **Key pattern**: Task queue + worktree isolation + automated PR creation

### 7.4 Codexia (Open Source, Tauri v2)

- **URL**: https://github.com/milisp/codexia
- **Architecture**: Tauri v2, React + Zustand + shadcn/ui, Rust backend
- **Key features**: Task scheduler, git worktree management, headless web server for remote control, WebSocket broadcast stream
- **Agent integration**: Both Codex CLI and Claude Agent Rust SDK
- **Process model**: "Agents run in separate processes"
- **License**: AGPL-3.0 / Commercial dual license

### 7.5 Commander / Autohand (Open Source, Tauri)

- **URL**: https://github.com/autohand (referenced on rywalker.com)
- **Architecture**: Tauri desktop app for Claude Code, Codex, Gemini CLI
- **Worktree management**: Automatic workspace isolation via worktrees
- **Multi-agent**: Supports multiple AI agents with persistent chat history

### 7.6 Mozzie (Open Source)

- **URL**: https://github.com/usemozzie/mozzie
- **Architecture**: Local-first desktop app for parallel AI agent orchestration
- **Key features**: Work items, git worktrees, dependency tracking, review workflow
- **Agent support**: Claude Code, Gemini CLI, Codex, or custom scripts
- **Scaling**: As many parallel agents as the machine can handle

### 7.7 ComposioHQ Agent-Orchestrator (Open Source)

- **URL**: https://github.com/ComposioHQ/agent-orchestrator
- **Architecture**: Plans tasks, spawns agents, handles CI fixes, merge conflicts, and code reviews autonomously
- **Key pattern**: Full autonomous orchestration with CI awareness

### 7.8 agenttools/worktree (Open Source CLI)

- **URL**: https://github.com/agenttools/worktree
- **Architecture**: CLI tool for managing git worktrees with GitHub Issues and Claude Code integration
- **Key pattern**: Maps GitHub issues to worktrees 1:1

### 7.9 CodeRabbit git-worktree-runner (Open Source)

- **URL**: https://github.com/coderabbitai/git-worktree-runner
- **Architecture**: Bash-based worktree manager with editor and AI tool integration
- **Key pattern**: Automates per-branch worktree creation, config copying, dependency installation

---

## 8. Recommended Architecture for This Project

Based on research across all implementations and the Claude Agent SDK capabilities, here is the recommended architecture for adding multi-workspace support to claude-tauri-boilerplate.

### 8.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Tauri v2 Desktop Shell                                       │
│  ┌─────────────────────────┐  ┌────────────────────────────┐ │
│  │  React Frontend          │  │  Hono/Bun Sidecar          │ │
│  │                          │  │                            │ │
│  │  ┌──────┐ ┌───────────┐ │  │  WorktreeManager           │ │
│  │  │Sidebar│ │ Workspace │ │  │    ├─ create()             │ │
│  │  │ Tree  │ │   Panel   │ │  │    ├─ remove()             │ │
│  │  │      │ │ (Chat+Diff)│ │  │    └─ list()               │ │
│  │  └──────┘ └───────────┘ │  │                            │ │
│  └─────────────────────────┘  │  SessionManager             │ │
│                                │    ├─ startAgent(cwd)       │ │
│                                │    ├─ stopAgent(id)         │ │
│                                │    ├─ resumeAgent(id)       │ │
│                                │    └─ streamEvents(id)→SSE  │ │
│                                │                            │ │
│                                │  SQLite (workspaces table)  │ │
│                                └────────────────────────────┘ │
│                                     │         │        │      │
│                              query()│  query()│ query()│      │
│                                     ▼         ▼        ▼      │
│                              ┌──────┐  ┌──────┐  ┌──────┐    │
│                              │Claude│  │Claude│  │Claude│    │
│                              │Proc 1│  │Proc 2│  │Proc 3│    │
│                              │cwd:A │  │cwd:B │  │cwd:C │    │
│                              └──────┘  └──────┘  └──────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 New Database Tables

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  session_id TEXT,
  last_prompt TEXT,
  cost_usd REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);
```

### 8.3 New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects` | GET | List all projects |
| `/api/projects` | POST | Add a project (repo path) |
| `/api/projects/:id` | DELETE | Remove a project |
| `/api/projects/:id/workspaces` | GET | List workspaces for a project |
| `/api/projects/:id/workspaces` | POST | Create a new workspace (worktree) |
| `/api/workspaces/:id` | GET | Get workspace details |
| `/api/workspaces/:id` | DELETE | Delete workspace (cleanup worktree) |
| `/api/workspaces/:id/agent/start` | POST | Start the agent in this workspace |
| `/api/workspaces/:id/agent/stop` | POST | Stop the running agent |
| `/api/workspaces/:id/agent/resume` | POST | Resume a previous agent session |
| `/api/workspaces/:id/stream` | GET | SSE stream of agent events |
| `/api/workspaces/:id/diff` | GET | Get current diff in workspace |
| `/api/workspaces/:id/merge` | POST | Merge workspace branch |

### 8.4 Implementation Order

1. **Phase 1: WorktreeManager** -- Create/list/remove worktrees, database tables for projects and workspaces.
2. **Phase 2: SessionManager** -- Start/stop/resume Claude SDK sessions per workspace with `cwd` pointing to worktrees.
3. **Phase 3: SSE multiplexing** -- Stream events from multiple concurrent agents to the frontend.
4. **Phase 4: Sidebar UI** -- Project tree with workspace list, status indicators.
5. **Phase 5: Workspace panel** -- Chat view, diff view, file changes within a workspace.
6. **Phase 6: Lifecycle management** -- Merge, PR creation, cleanup, automatic dependency installation.

### 8.5 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Worktree location | `~/.claude-tauri/worktrees/<project-hash>/` | Keeps user's project dir clean |
| Process isolation | Default `query()` (1 process per workspace) | SDK handles it; no extra work |
| Dependency install | `pnpm install` on worktree creation | Reliable; pnpm store makes it fast |
| Session persistence | Enabled by default | Allows resuming after app restart |
| Cleanup policy | Manual + post-merge auto-cleanup | User stays in control |
| SDK API version | V1 `query()` now, migrate to V2 when stable | V2 is still `unstable_` preview |

---

## 9. Sources

- [Conductor.build - Run a team of coding agents on your Mac](https://www.conductor.build/)
- [Conductor Documentation - First Workspace](https://docs.conductor.build/first-workspace)
- [The Parallel Agent Multiplier with Git Worktrees and Conductor](https://elite-ai-assisted-coding.dev/p/the-parallel-agent-multiplier-conductor-with-charlie-holtz)
- [Conductors to Orchestrators: The Future of Agentic Coding](https://addyo.substack.com/p/conductors-to-orchestrators-the-future)
- [A Hands-On Review of Conductor - The New Stack](https://thenewstack.io/a-hands-on-review-of-conductor-an-ai-parallel-runner-app/)
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Agent SDK V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [Claude Agent SDK Hosting Guide](https://platform.claude.com/docs/en/agent-sdk/hosting)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Code-Conductor (GitHub)](https://github.com/ryanmac/code-conductor)
- [Codexia - Agent Workstation (GitHub)](https://github.com/milisp/codexia)
- [Pane - Run any agent, any OS](https://www.runpane.com/)
- [Mozzie - Agent Orchestrator Desktop App](https://github.com/usemozzie/mozzie)
- [ComposioHQ Agent-Orchestrator (GitHub)](https://github.com/ComposioHQ/agent-orchestrator)
- [agenttools/worktree (GitHub)](https://github.com/agenttools/worktree)
- [CodeRabbit git-worktree-runner (GitHub)](https://github.com/coderabbitai/git-worktree-runner)
- [git-worktree npm package](https://www.npmjs.com/package/git-worktree)
- [Git Worktree Official Documentation](https://git-scm.com/docs/git-worktree)
- [Git Worktree Best Practices (Gist)](https://gist.github.com/ChristopherA/4643b2f5e024578606b9cd5d2e6815cc)
- [Tauri Sidecar Manager (GitHub)](https://github.com/radical-data/tauri-sidecar-manager)
- [Tauri v2 - Embedding External Binaries](https://v2.tauri.app/develop/sidecar/)
- [Claude Code Worktrees Guide](https://claudefa.st/blog/guide/development/worktree-guide)
- [Managing Multiple Claude Code Sessions - Claude Remote](https://www.clauderc.com/blog/2026-02-28-managing-multiple-claude-code-sessions/)
- [Parallel Vibe Coding with Git Worktrees](https://www.dandoescode.com/blog/parallel-vibe-coding-with-git-worktrees)
- [Git Worktrees for Parallel AI Coding Agents - Upsun](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/)
- [shadcn/ui Sidebar Component](https://ui.shadcn.com/docs/components/radix/sidebar)
- [PatternFly Tree View Design Guidelines](https://www.patternfly.org/components/tree-view/design-guidelines/)
