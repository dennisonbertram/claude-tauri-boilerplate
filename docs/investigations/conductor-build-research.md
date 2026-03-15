# conductor.build Research

**Date:** 2026-03-15
**Purpose:** Competitive analysis and architectural inspiration for claude-tauri-boilerplate

---

## 1. What is conductor.build?

Conductor is a standalone macOS desktop application for orchestrating teams of AI coding agents working in parallel. Built by **Melty Labs** (founded by Charlie Holtz and Jackson de Campos), it was backed by **Y Combinator Summer 2024** batch and is based in San Francisco.

- **Website:** https://www.conductor.build/
- **Docs:** https://docs.conductor.build/
- **Current version:** 0.39.0 (as of March 2026)
- **Pricing:** Free -- uses your existing Claude Code / Codex credentials
- **Platform:** macOS only (Apple Silicon required; Windows waitlist exists)

The core value proposition: "Run a team of coding agents on your Mac." In one click, create a new Claude Code instance in an isolated copy of your codebase. Monitor all agents from a single dashboard, review diffs, create PRs, and merge -- all without leaving the app.

**Trusted by engineers at:** Linear, Vercel, Notion, Stripe, Life360.

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| Desktop framework | **Tauri** |
| Frontend | **React** |
| Language | **TypeScript** |
| AI integration | **Claude Code SDK** (TypeScript wrapper around the CLI) |
| Supported agents | Claude Code, OpenAI Codex |
| Agent binaries | Bundled at `~/Library/Application Support/com.conductor.app/bin` |

This is directly relevant to our project -- **Conductor uses the same Tauri + React + TypeScript stack** that claude-tauri-boilerplate uses. They also use the Claude Code SDK (the TypeScript wrapper), not the CLI directly.

---

## 3. How It Manages Projects and Workspaces

### Adding a Project

1. Add a repository to Conductor from either a **local folder** or a **Git URL**.
2. You must be authenticated with GitHub (`gh auth status`).
3. Conductor clones or references the repo locally.

### Creating Workspaces

Each workspace in Conductor is a **separate Git worktree**. When you create a workspace:

1. Conductor automatically creates a new git worktree and associated branch.
2. Only git-tracked files are copied to the worktree.
3. A user-configurable **setup script** runs to handle untracked files (`.env`, `node_modules`, etc.).
4. Worktrees live at `~/conductor/worktrees/[repo-name]` (or similar path).
5. Each workspace gets a unique city name for identification.

Workspace creation options:
- **New from current branch** (Cmd+Shift+N)
- **New from a specific branch**
- **New from a GitHub pull request**
- **New from a Linear issue**

### Workspace Lifecycle

1. Create workspace (worktree + branch + setup script)
2. Work in the workspace (chat with Claude, edit in IDE)
3. Review changes via built-in diff viewer (Cmd+D)
4. Create PR (Cmd+Shift+P) with conflict detection
5. Merge and archive the workspace

---

## 4. Git Worktrees: Confirmed Core Primitive

Yes, **git worktrees are the fundamental isolation mechanism**. From the founder (HN discussion):

> "We create an isolated git worktree locally on your machine -- whereas Codex (I believe) is running a container on the cloud."

Key details:
- Each agent gets its own worktree -- its own branch, its own copy of the working tree.
- Only git-tracked files are copied; setup scripts handle the rest.
- **Setup scripts** are configurable per-repo and run on every workspace creation (e.g., `cp .env.example .env && pnpm install`).
- Worktrees are the reason concurrent agents don't conflict with each other.

### Limitations of Worktrees (Discussed on HN)

- **Submodules**: Git docs say "support for submodules is incomplete" with worktrees.
- **Untracked files**: `.env`, `node_modules`, etc. are NOT copied. Setup scripts are the workaround.
- **Storage overhead**: Each worktree duplicates the working directory (not the `.git` objects, but the files on disk).
- **Shared services**: If two worktrees both run a dev server on port 3000, they conflict. Not Conductor's problem to solve, but a real UX issue.

---

## 5. How It Runs AI Instances Per Workspace

- Conductor uses the **Claude Code SDK** (TypeScript wrapper) -- NOT the CLI directly. This gives programmatic control while maintaining output parity with the CLI.
- Claude Code and Codex binaries are **bundled with the app** at `~/Library/Application Support/com.conductor.app/bin`.
- Each workspace gets its own Claude Code session. The agent operates within the worktree's file system.
- **Authentication**: Conductor reuses however you're already logged into Claude Code -- API key, Claude Pro, or Max subscription. No separate billing.
- **Context management**: Built-in monitoring shows token counts and costs per workspace.
- **Plan mode** (Shift+Tab): Agents outline steps before editing, giving the human a chance to review before code changes.

---

## 6. UX Flow

### First Launch

1. Download and install the Mac app.
2. Ensure `gh auth status` passes (GitHub CLI auth).
3. Add a repository (local folder or Git URL).
4. Conductor creates your first workspace automatically.

### Day-to-Day Usage

- **Cmd+N**: New workspace (new worktree + new Claude session)
- **Cmd+T**: New chat within a workspace
- **Cmd+D**: Open diff viewer for the current workspace
- **Cmd+O**: Open workspace in your IDE (VS Code, etc.)
- **Cmd+Shift+P**: Create a pull request from the workspace
- **Shift+Tab**: Toggle plan mode (agent explains before editing)

### Dashboard View

All active workspaces are visible in a single view. Each workspace shows:
- What the agent is currently working on
- File modifications in real-time
- Token usage and cost
- Checkpoint timeline

---

## 7. Handling Multiple Concurrent AI Sessions

Conductor's entire design is built around concurrent sessions:

1. **Isolation via worktrees**: Each session has its own branch and file system. No conflicts.
2. **Dashboard monitoring**: See all agents at a glance -- what they're doing, what files they've changed.
3. **Per-workspace checkpointing**: Each workspace has its own checkpoint timeline for rewind.
4. **Merge conflict resolution**: When two agents' changes conflict during merge, Claude can resolve them via a `/resolve merge conflicts` slash command.
5. **The `.context` directory**: Introduced in v0.28.1 -- a gitignored directory that stores plans, notes, and attachments. Agents in one workspace can reference context from another using `@` mentions.

### The `.context` Directory (Cross-Agent Context Sharing)

A filesystem-based approach for sharing context between agents:
- Automatically captures plans, attachments, images, documents, Linear issues, and chat summaries.
- Gitignored by default -- doesn't pollute diffs or PRs.
- Users can `@`-mention context from one workspace in another.
- Design philosophy: "Coding agents are already great at manipulating files (and so are humans!). It's a simple, flexible solution."

---

## 8. Notable Features and Technical Decisions

### Checkpointing

Conductor built a custom checkpointing system using **hidden git refs** stored at `.git/refs/conductor-checkpoints/<id>`. This captures three layers of state:

1. **Current commit** (HEAD)
2. **Index** (staged changes)
3. **Worktree** (all files including untracked)

Implementation:
- Hooks into the agent lifecycle at turn start/end.
- Converts index and worktree to tree objects via `git write-tree`.
- For worktree capture, creates a temporary index using `GIT_INDEX_FILE` env var.
- Bundles three SHA-1 hashes into a commit message, stored as a private ref.
- API: `capture()`, `revert(checkpointId)`, `diff(id1, id2)`.

They rejected alternatives: `git stash` (can't include untracked files without disk modification), SQLite (would require rebuilding git diff functionality), private refs alone (miss uncommitted changes).

Interesting: **GPT-5 was used to design this subsystem.** The team provided their spec and failed approaches, and GPT-5 recommended hidden git refs and virtually one-shotted the implementation.

### Diff Viewer

Built-in file-level diff viewer (Cmd+D) shows exactly what the agent changed. Supports commenting on diffs with GitHub synchronization (v0.29.0).

### Checks Tab

A task management feature that blocks workspace progression until all checks are completed -- a pre-merge quality gate.

### MCP (Model Context Protocol)

Conductor supports MCP servers, configured via the Claude Code CLI:
```bash
claude mcp add <server-name> -s user -- <command> [args...]
```
This gives Claude Code access to external tools, databases, and APIs.

### Linear Integration

Create workspaces directly from Linear issues. Planned deeper integration for issue linking and status updates.

---

## 9. Release Timeline

| Date | Version | Key Feature |
|------|---------|-------------|
| Jul 24, 2025 | 0.1.0 | Initial release |
| Dec 3, 2025 | ~0.27.x | Checkpointing blog post |
| Dec 22, 2025 | 0.28.0 | Workspaces for history tracking |
| Dec 23, 2025 | 0.28.1 | `.context` directory |
| Jan 7, 2026 | 0.29.0 | Code commenting on diffs with GitHub sync |
| Jan 10, 2026 | 0.29.3 | Bug fixes |
| Mar 2026 | 0.39.0 | Current version |

Rapid iteration -- 39 minor versions in ~8 months.

---

## 10. Competitors and Alternatives (from HN Discussion)

| Tool | Approach |
|------|----------|
| **Crystal** | Open-source, works with existing checkouts |
| **Claude Squad** | Free, open-source multi-agent runner |
| **autowt** | Python-based worktree wrapper |
| **Par** | tmux-based CLI approach |
| **Plandex** | Shadow git repo isolation |
| **GitHub Copilot Workspace** | Cloud-hosted |
| **OpenAI Codex** | Cloud containers |

---

## 11. Known Limitations

1. **macOS only** -- Windows/Linux not yet supported.
2. **Storage overhead** -- Each worktree duplicates the working tree on disk.
3. **Git submodule support is incomplete** -- documented git limitation with worktrees.
4. **Shared dev services conflict** -- Two workspaces can't both bind the same port.
5. **No team/collaboration features** -- Individual developer tool only.
6. **Human review is the bottleneck** -- As one HN commenter noted: "the bottleneck was never the AI not being able to write 10 different POCs simultaneously -- but the human factor."
7. **Setup script friction** -- `.env` files, `node_modules`, Docker volumes, etc. require manual configuration via setup scripts.

---

## 12. Lessons for claude-tauri-boilerplate

### Architecture Overlap

Conductor uses **the exact same tech stack** as our project: Tauri + React + TypeScript + Claude Code SDK. This validates our architectural choices. Key differences:

| Aspect | Conductor | claude-tauri-boilerplate |
|--------|-----------|-------------------------|
| Backend | Claude Code SDK (TS wrapper) | Hono/Bun sidecar server |
| Database | Hidden git refs (checkpoints) | SQLite (WAL mode) |
| AI integration | Bundled Claude Code binary | Claude Agent SDK via Hono |
| Multi-session | Git worktrees | Single session (currently) |

### Ideas Worth Adopting

1. **Git worktree-based workspace isolation**: This is clearly the proven pattern for multi-agent coding. Our project already uses worktrees in the development workflow (CLAUDE.md Section 6). Conductor validates this approach at the product level.

2. **Setup scripts per project**: A simple, powerful pattern for workspace initialization. Users configure what needs to happen when a new workspace is created.

3. **Checkpointing via hidden git refs**: Elegant approach that avoids a separate database for state management while capturing complete state (commit + index + worktree). Uses git's own primitives.

4. **The `.context` directory for cross-agent context**: Filesystem-based context sharing is simple and works with agents' existing file manipulation capabilities. No need for a complex database or API.

5. **Bundled agent binaries**: Conductor bundles Claude Code at a known path (`~/Library/Application Support/`). We already bundle our Hono sidecar as a Tauri sidecar binary -- same pattern.

6. **Dashboard view for multiple sessions**: Real-time visibility into what each agent is doing, with file modification tracking and cost monitoring.

7. **Diff-first review workflow**: Instead of reviewing entire files, surface only what changed. This is the right UX for reviewing AI-generated code.

8. **Plan mode**: Let the agent explain its approach before making changes. A trust-building UX pattern.

### Gaps and Opportunities

Conductor is focused narrowly on **workspace orchestration** -- it doesn't try to replicate the full Claude Code CLI experience in a GUI. Our project aims for broader **feature parity with Claude Code CLI** in a desktop app, which means:

- We offer a richer chat UI experience (not just a terminal wrapper).
- We have a proper database (SQLite) for session/message persistence.
- We can build features Conductor doesn't have: settings management, auth status, usage tracking, etc.
- Multi-workspace support could be a future differentiator if we adopt their worktree pattern.

### What to Avoid

- Don't try to solve shared service port conflicts -- that's the user's problem.
- Don't require GitHub auth for local-only usage.
- Don't over-engineer the workspace system before the core chat experience is solid.

---

## Sources

- [Conductor Homepage](https://www.conductor.build/)
- [Conductor Docs](https://docs.conductor.build/)
- [YC Company Page](https://www.ycombinator.com/companies/conductor)
- [Grokipedia: Conductor.build](https://grokipedia.com/page/Conductorbuild)
- [HN: Show HN - Conductor](https://news.ycombinator.com/item?id=44594584)
- [The New Stack: Hands-On Review](https://thenewstack.io/a-hands-on-review-of-conductor-an-ai-parallel-runner-app/)
- [O'Reilly: Conductors to Orchestrators](https://www.oreilly.com/radar/conductors-to-orchestrators-the-future-of-agentic-coding/)
- [Elite AI-Assisted Coding: Interview with Charlie Holtz](https://elite-ai-assisted-coding.dev/p/the-parallel-agent-multiplier-conductor-with-charlie-holtz)
- [Conductor Blog: How We Built Checkpointing](https://blog.conductor.build/checkpointing/)
- [Conductor Blog: The .context Directory](https://www.conductor.build/blog/context)
- [Today on Mac: Conductor](https://www.todayonmac.com/conductor/)
- [KDJingPai: Conductor Collaboration Tool](https://www.kdjingpai.com/en/conductor/)
- [YC Job Posting: Founding Engineer](https://www.ycombinator.com/companies/conductor/jobs/MYjJzBV-founding-engineer)
- [Product Hunt: Conductor](https://www.producthunt.com/products/conductor-aa77ddef-e6d3-4805-a179-7b2e17b6e22e)
