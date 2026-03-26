# AGENTS.md - Project Policies for AI Agents

All agents working on this project MUST read and follow these policies.

---

## 1. Project Overview

This is **Codex-tauri-boilerplate**, a desktop GUI for Codex that aims for feature parity with Codex CLI. Built as a Tauri v2 desktop app with a React frontend and a Hono/Bun backend sidecar.

**Goal:** MVP boilerplate. Best practices, clean code, no skimping on security -- but no over-engineering for enterprise scale.

---

## 2. Architecture & Tech Stack

```
┌─────────────────────────────────────────────────┐
│  Tauri v2 Desktop Shell                         │
│  ┌───────────────────┐  ┌────────────────────┐  │
│  │  React 19 Frontend│  │  Hono/Bun Sidecar  │  │
│  │  (Vite, port 1420)│──│  (API, port 3131)  │  │
│  │  Tailwind CSS v4  │  │  SQLite (WAL mode) │  │
│  │  AI SDK v6        │  │  Codex Agent SDK  │  │
│  └───────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Monorepo Structure

```
Codex-tauri-boilerplate/
├── apps/
│   ├── desktop/          # Tauri + React frontend
│   │   ├── src/          # React components, hooks, lib
│   │   └── src-tauri/    # Rust shell, Tauri config, sidecar binaries
│   └── server/           # Hono API server (runs as sidecar)
│       └── src/
│           ├── db/       # SQLite schema, database service
│           ├── routes/   # API route handlers
│           └── services/ # Business logic (auth, Codex)
├── packages/
│   └── shared/           # Shared TypeScript types
└── docs/                 # All project documentation
```

### Key Technologies

| Layer | Technology | Version |
|-------|------------|---------|
| Desktop shell | Tauri | v2 |
| Frontend | React + TypeScript | 19.1 / 5.8 |
| Styling | Tailwind CSS | v4 |
| Bundler | Vite | 7.0 |
| Backend runtime | Bun | latest |
| Backend framework | Hono | v4 |
| Database | SQLite (Bun native) | WAL mode, FK on |
| AI integration | Codex Agent SDK | v0.2.76 |
| Chat hooks | Vercel AI SDK | v6 |
| Validation | Zod | v3.23 |
| Package manager | pnpm | workspaces |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Server health check |
| `/api/auth/status` | GET | Auth info (email, plan, subscription) |
| `/api/sessions` | GET | List all sessions |
| `/api/sessions` | POST | Create new session |
| `/api/sessions/:id/messages` | GET | Get messages in session |
| `/api/sessions/:id` | DELETE | Delete session (cascades messages) |
| `/api/chat` | POST | Stream chat response (SSE) |

### Database

SQLite at `~/.Codex-tauri/data.db`. Two tables: `sessions` and `messages`. Foreign keys enabled, WAL journaling. Schema in `apps/server/src/db/schema.ts`.

### Authentication

Uses Codex subscription auth (detected from CLI credentials). If `ANTHROPIC_API_KEY` is set, it overrides subscription auth -- clear it or set to `""` to use subscription.

---

## 3. Development Setup

### Prerequisites

- **pnpm** (package manager)
- **Bun** (server runtime + test runner)
- **Rust + Cargo** (for Tauri)
- **Tauri CLI v2** (`cargo install tauri-cli`)
- A valid **Codex subscription** (for auth) OR `ANTHROPIC_API_KEY`

### Install Dependencies

```bash
pnpm install
```

### Development Commands

```bash
# Start everything (frontend + backend)
pnpm dev:all

# Start individually
pnpm dev           # Frontend only (Vite, port 1420)
pnpm dev:server    # Backend only (Bun, port 3131)

# Run with Tauri desktop shell
cd apps/desktop && pnpm tauri dev
```

### Testing

#### Automated Tests

```bash
# Run all tests
pnpm test

# Run server tests only
cd apps/server && bun test

# Run a specific test file
cd apps/server && bun test src/routes/auth.test.ts
```

Server tests use **Bun's built-in test runner** (not Vitest or Jest). Test files live alongside source files as `*.test.ts`.

#### Manual API Testing with curl

Every backend endpoint or API change MUST be manually tested with curl before considering the work done. Start the server first (`pnpm dev:server`), then test.

```bash
# Health check
curl http://localhost:3131/api/health

# Auth status
curl http://localhost:3131/api/auth/status

# Create a session
curl -X POST http://localhost:3131/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session"}'

# List sessions
curl http://localhost:3131/api/sessions

# Get messages for a session
curl http://localhost:3131/api/sessions/<session-id>/messages

# Delete a session
curl -X DELETE http://localhost:3131/api/sessions/<session-id>

# Stream a chat response
curl -N -X POST http://localhost:3131/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "sessionId": "<session-id>"}'
```

Verify: correct status codes, response shapes match shared types, error cases return proper error JSON, and streaming endpoints actually stream (not buffer).

#### Manual Frontend Testing with agent-browser

Every frontend change MUST be manually verified using the `agent-browser` CLI. This catches visual bugs, layout issues, and interaction problems that unit tests miss.

For Plaid-specific manual verification, use [docs/testing/plaid-sandbox-testing.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/docs/testing/plaid-sandbox-testing.md) as the source of truth for sandbox credentials, browser callback behavior, and the recommended hosted-link workflow.

**Setup:**
1. Start the dev environment: `pnpm dev:all`
2. Install the browser once if needed: `agent-browser install`
3. Navigate to `http://localhost:1420` using `agent-browser open http://localhost:1420`
4. Wait for the page to settle: `agent-browser wait --load networkidle`

**Testing workflow:**
1. **Take a snapshot** with `agent-browser snapshot -i` to get fresh element refs
2. **Take a screenshot** with `agent-browser screenshot .claude/browser-artifacts/agent-browser/<name>.png` to verify the current UI state
3. **Interact with the page** using `agent-browser click`, `fill`, `press`, and `scroll`
4. **Read page state** with `agent-browser snapshot -i`, `agent-browser get text <selector>`, or `agent-browser get url`
5. **Check for console errors** with `agent-browser console` and `agent-browser errors` -- there should be zero unexpected errors
6. **Take a final screenshot** to confirm the feature looks correct after interaction
7. **Return screenshots inline in the response** (in-chat image links) for before/after UI state verification.

**What to verify for each frontend change:**
- Component renders without console errors
- Layout is correct (no overflow, no misalignment)
- Interactive elements work (buttons click, inputs accept text, modals open/close)
- Loading states display properly
- Error states display properly
- Responsive behavior is reasonable

**Recording multi-step interactions:**
Use `agent-browser record start .claude/browser-artifacts/agent-browser/<name>.webm` and `agent-browser record stop` to capture complex user flows. If a GIF is explicitly needed, convert the saved video afterward. `agentation` is separate from `agent-browser` and should only be used when you specifically want its visual-feedback MCP features.

### Building

```bash
# Build sidecar binary (required before Tauri build)
pnpm build:sidecar

# Build all packages
pnpm build

# Build desktop app for distribution
cd apps/desktop && pnpm tauri build
```

The sidecar build compiles the Hono server into a standalone Bun binary at `apps/desktop/src-tauri/binaries/server-<platform-triple>`.

### Ports

| Service | Port | Notes |
|---------|------|-------|
| Frontend (Vite) | 1420 | Strict -- fails if occupied |
| Backend (Hono) | 3131 | Configurable via `PORT` env var |

**Always check ports before starting:** `lsof -i :1420` and `lsof -i :3131`.

### Environment Variables

- `PORT` -- Server port (default: 3131)
- `ANTHROPIC_API_KEY` -- Set to `""` or unset to use subscription auth
- API keys are in `~/.zshrc` (never committed)

---

## 4. Documentation Structure

All project documentation lives in `docs/`. Start with **`docs/INDEX.md`** -- it links to every subfolder.

Every docs subfolder has its own `INDEX.md` with a listing of files and descriptions.

**Rules:**
- When creating a new file in any docs folder, ALWAYS update that folder's `INDEX.md` to include it.
- When a file's content meaningfully changes, update the `INDEX.md` description to reflect the change.
- The top-level `docs/INDEX.md` links to all subfolder indexes. If you add a new subfolder, add it there too.

Current structure:

```
docs/
  INDEX.md                  # Master index -- start here
  research/INDEX.md         # Research notes, library evaluations
  design/INDEX.md           # Design documents, wireframes, architecture
  explorations/INDEX.md     # Spikes, proof-of-concepts
  plans/INDEX.md            # Feature plans with checklists
  investigations/INDEX.md   # Deep-dive tech investigations
  implementation/INDEX.md   # Code change documentation
  testing/INDEX.md          # Test results and validation
  decisions/INDEX.md        # Architecture decision records
  logs/INDEX.md             # Engineering, observational, and systems logs
  runbooks/INDEX.md         # Operational runbooks
  devlog/INDEX.md           # Chronological developer log
  context/INDEX.md          # Onboarding context for new agents
```

---

## 5. Strict TDD + Manual Testing Policy

Test-Driven Development is mandatory. Manual verification is mandatory. No exceptions.

### Automated Tests (TDD)

1. **Write tests FIRST.** Before implementing any feature, write the tests that define correct behavior.
2. **Tests must be meaningful.** No trivial tests like `expect(true).toBe(true)`. Every test must assert something real about the system.
3. **Tests must not be underspecified.** Cover edge cases, error conditions, invalid inputs, and realistic scenarios -- not just the happy path.
4. **Tests must pass before any commit.** If tests fail, the commit is blocked. Fix the code, not the tests (unless the test itself is wrong).

### Manual Testing (Required)

Automated tests alone are not sufficient. Every change must also be manually verified:

5. **Backend changes: test with curl.** Hit every new or modified endpoint with curl. Verify status codes, response shapes, error cases, and streaming behavior. See §3 "Manual API Testing with curl" for examples.
6. **Frontend changes: test with `agent-browser`.** Use the `agent-browser` CLI to navigate to the app, take screenshots, interact with the UI, and check console/page errors. See §3 "Manual Frontend Testing with agent-browser" for the full workflow.
   - If a task changes anything visible, clickable, navigable, or otherwise user-facing in the app, you must verify it in `agent-browser` even if the user did not explicitly ask for browser testing.
   - Do not skip the browser pass because the change seems small or because tests already passed.
7. **Both layers changed? Test both.** If a feature touches backend and frontend, do curl testing first (confirm the API works), then Chrome testing (confirm the UI works end-to-end).
8. **Frontend work is not finished until browser verification passes.** Do not call a frontend task done until you have completed the manual browser pass and verified the UI in `agent-browser`.

### Bug Fix Protocol

8. **Bug fix protocol:**
   - Document the bug in the engineering log (`docs/logs/engineering-log.md`)
   - Write a regression test that **fails** (proving the bug exists)
   - Fix the bug
   - Verify the regression test now passes
   - Manually verify the fix with curl and/or Chrome browser tool
   - Commit

---

## 6. Worktree Workflow

Never commit directly to `main`. All work happens in branches via git worktrees.

- Code-writing subagents MUST use `isolation: "worktree"` to get their own copy of the repo.
- Read-only subagents (research, investigation, exploration) do NOT need worktree isolation.
- If you create a worktree manually, run `./init.sh` immediately after checkout so the worktree is bootstrapped the standard way before any tests or browser verification.
- When all tests pass in a worktree, merge the branch back to `main`.
- After a successful merge, clean up the worktree.

Flow:
```
1. Create worktree (branch is created automatically)
2. Do work in the worktree
3. Run tests -- all must pass
4. Merge branch to main
5. Delete the worktree
```

---

## 7. Feature Development Process

Before implementing any feature:

1. **Create a plan document** in `docs/plans/` with:
   - Feature description (what and why)
   - Acceptance criteria (how we know it's done)
   - Checklist of implementation steps
2. **Update `docs/plans/INDEX.md`** with the new plan.
3. As work progresses, **check items off the checklist** in the plan document.
4. When the feature is complete, mark the plan as done.

This keeps work trackable and lets any agent pick up where another left off.

---

## 8. Logging Requirements

Three logs are maintained in `docs/logs/`. Keep entries dated and concise.

### Engineering Log (`docs/logs/engineering-log.md`)
Record bugs found, fixes applied, and technical decisions made during development. This is the factual record of what happened and why.

Format:
```markdown
## YYYY-MM-DD
### [Brief title]
- **What:** Description of the bug/fix/decision
- **Why:** Reasoning or root cause
- **Result:** Outcome
```

### Observational Log (`docs/logs/observational-log.md`)
Track observations, patterns noticed, things that seem off, performance notes, UX concerns. These are things noticed but not necessarily acted on yet. Think of this as a scratchpad for future investigation.

### Systems Log (`docs/logs/systems-log.md`)
Document each system/module in the project: what it does, how systems interact, dependencies, and what you need to know to work on it. Update this as the architecture evolves. This is the living architecture reference.

---

## 9. GitHub Issues

When reviewing code or spotting problems:

- **Create a GitHub issue** so the work can be tracked and picked up by any agent.
- Issues must include:
  - Clear description of the problem or enhancement
  - Reproduction steps (for bugs)
  - Acceptance criteria (how we know it's fixed/done)
- Label issues appropriately: `bug`, `enhancement`, `documentation`, `tech-debt`, etc.
- Reference related plan documents or log entries when applicable.

---

## 10. Communication Style

- Use **plain language**. Avoid jargon unless it's necessary and well-known.
- The user manages many things and needs to understand how everything fits together at a **high level**.
- Agents handle the technical details; the user handles direction and decisions.
- Be **concise and clear** about what was done and what it means.
- Don't pad responses with filler. Say what matters, then stop.

---

## 11. Agent Task Completion

When an agent completes a task, it MUST report back with:

1. **What was completed** -- a clear summary in 1-3 sentences.
2. **What files were changed or created** -- list the paths.
3. **Any issues encountered** -- problems, blockers, things that didn't work as expected.
4. **Next steps** -- if there's follow-up work, say what it is.
5. **Frontend verification status** -- if the task touched the UI, say whether the manual browser pass was completed and summarize what was verified.

For any task that touches the UI, do not consider the work done, even internally, until the browser verification pass in `agent-browser` has been completed and passed.

Do not give vague summaries. Be specific about what changed and where.

---

## 12. Nightly Tasks

Automated agents can pick up work from **`docs/nightly-tasks.md`**.

Tasks listed there should be:
- **Atomic** -- one task, one concern, independently completable.
- **Well-described** -- clear enough that an agent can do it without asking questions.
- **Prioritized** -- most important tasks first.

When completing a nightly task, remove it from the list and log the completion in the engineering log.

---

## 13. MVP Mindset

This is an MVP. The goal is to build something that works well, not something that handles every edge case at planetary scale.

- Use best practices. Keep code DRY.
- Do NOT skimp on security. Auth, input validation, and data protection are always worth doing right.
- Do NOT optimize for enterprise scale. We don't need distributed caching, multi-region failover, or abstract factory patterns.
- Prefer simplicity over cleverness. If the simple approach works, use it.
- Avoid premature abstraction. Extract patterns when you see them repeated, not before.

---

## 14. Index Maintenance

This is important enough to restate clearly:

- Every `docs/` subfolder has an `INDEX.md`.
- **Creating a file?** Update that folder's `INDEX.md` immediately.
- **Changing a file's content significantly?** Update the `INDEX.md` description.
- **Adding a new docs subfolder?** Add it to `docs/INDEX.md`.
- Never leave an index stale. If you touched files in a docs folder, check the index.
