# Architecture Decision Record: Claude Tauri Boilerplate

**Date**: 2026-03-14
**Status**: Accepted
**Authors**: Research synthesis from tauri-v2-architecture, hono-server-architecture, shadcn-ai-elements-setup, ai-sdk-elements, and multiturn-stream-test-results investigations

---

## 1. System Overview

### Full Stack Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  macOS / Windows / Linux (Host OS)                                  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Tauri v2 Shell (Rust)                                        │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────┐                          │  │
│  │  │  Webview (WKWebView / WebView2) │                          │  │
│  │  │                                 │                          │  │
│  │  │  React 19 + Vite                │                          │  │
│  │  │  ┌───────────────────────────┐  │                          │  │
│  │  │  │  AI Elements Components   │  │                          │  │
│  │  │  │  - <Conversation>         │  │                          │  │
│  │  │  │  - <Message>              │  │                          │  │
│  │  │  │  - <PromptInput>          │  │                          │  │
│  │  │  │  - <Reasoning>            │  │                          │  │
│  │  │  │  - <Tool>                 │  │                          │  │
│  │  │  └────────────┬──────────────┘  │                          │  │
│  │  │               │ @ai-sdk/react   │                          │  │
│  │  │               │ useChat()       │                          │  │
│  │  └───────────────┼─────────────────┘                          │  │
│  │                  │                                             │  │
│  │         HTTP POST + SSE stream                                 │  │
│  │     http://localhost:3030/api/chat                             │  │
│  │                  │                                             │  │
│  │  ┌───────────────▼──────────────────────────────────────────┐ │  │
│  │  │  Hono Server (Node.js sidecar process)  :3030            │ │  │
│  │  │                                                          │ │  │
│  │  │  POST /api/chat  ──► streamSSE() ──► toUIMessageStream   │ │  │
│  │  │  GET  /api/sessions                                      │ │  │
│  │  │  POST /api/sessions                                      │ │  │
│  │  │  GET  /api/sessions/:id/messages                        │ │  │
│  │  │                                                          │ │  │
│  │  │  ┌──────────────────┐   ┌───────────────────────────┐   │ │  │
│  │  │  │  better-sqlite3  │   │  @anthropic-ai/claude-    │   │ │  │
│  │  │  │  SQLite file     │   │     agent-sdk             │   │ │  │
│  │  │  │  sessions +      │   │  query() w/ subscription  │   │ │  │
│  │  │  │  messages tables │   │  auth (no API key)        │   │ │  │
│  │  │  └──────────────────┘   └───────────┬───────────────┘   │ │  │
│  │  └──────────────────────────────────────┼───────────────────┘ │  │
│  │                                         │ spawns subprocess    │  │
│  └─────────────────────────────────────────┼─────────────────────┘  │
│                                            │                         │
│                            ┌───────────────▼──────────────────┐     │
│                            │  claude CLI binary               │     │
│                            │  (~/.local/bin/claude)           │     │
│                            │  Claude Code subscription auth   │     │
│                            └───────────────┬──────────────────┘     │
│                                            │ HTTPS                   │
└────────────────────────────────────────────┼────────────────────────┘
                                             ▼
                              ┌──────────────────────────┐
                              │  Anthropic API           │
                              │  (Claude Code Pro/Max    │
                              │   subscription)          │
                              └──────────────────────────┘
```

### Lifecycle: Tauri Shell Controls the Sidecar

```
App Launch
    │
    ▼
Rust main() / setup hook
    │
    ├─► Spawn Hono sidecar binary (src-tauri/binaries/hono-server-*)
    │       └─► Sidecar binds to :3030
    │
    ├─► Load Webview → React app (frontend/dist/)
    │       └─► useChat() connects to http://localhost:3030/api/chat
    │
    └─► Register CloseRequested handler
            └─► On window close: kill sidecar child process → exit

```

---

### Data Flow: Chat Message End-to-End

```
User types message and presses Enter
        │
        ▼
[React] sendMessage({ text: "..." })
  via useChat() DefaultChatTransport
        │
        │ HTTP POST http://localhost:3030/api/chat
        │ Body: { messages: UIMessage[], sessionId?: string }
        │
        ▼
[Hono Server] POST /api/chat handler
  1. Parse body: messages, sessionId
  2. Extract last user message content
  3. Call query() from @anthropic-ai/claude-agent-sdk
     - options.resume = sessionId (if multi-turn)
     - options.includePartialMessages = true  ← enables token streaming
  4. Open SSE stream via streamSSE()
        │
        │ SSE stream (text/event-stream)
        │
        ▼
[claude-agent-sdk] query() async generator
  Events emitted in sequence:
  ┌─────────────────────────────────────────────┐
  │ { type:"system", subtype:"init",            │
  │   session_id: "7a25bfd7-..." }              │  ← capture session_id here
  │                                             │
  │ { type:"stream_event", event: {             │
  │   type:"content_block_delta",               │
  │   delta: { type:"text_delta", text:"..." }} │  ← token chunks
  │   ... (N more text_delta events) ...        │
  │                                             │
  │ { type:"assistant", message: {...} }        │  ← final assembled message
  │                                             │
  │ { type:"result", subtype:"success",         │
  │   total_cost_usd: 0.029699 }               │
  └─────────────────────────────────────────────┘
        │
        ▼
[Hono] Translate claude-agent-sdk events → AI SDK data stream protocol
  - system/init      → writeSSE event:"session" with session_id
  - text_delta       → write "0:\"token text\"\n"  (AI SDK text part format)
  - result           → writeSSE event:"result" with cost
  - Persist messages to SQLite after stream completes
        │
        │ SSE wire format:
        │   data: 0:"Hello"
        │   data: 0:" world"
        │   event: session
        │   data: {"type":"session","sessionId":"7a25bfd7-..."}
        │   event: result
        │   data: {"type":"result","cost":0.029699}
        │
        ▼
[React] useChat() DefaultChatTransport receives stream
  - Accumulates text parts into messages[] state
  - status transitions: "ready" → "submitted" → "streaming" → "ready"
  - onData callback: captures sessionId for next turn
        │
        ▼
[AI Elements] Re-renders on each state update
  - <MessageResponse> streams markdown tokens without full re-parse
  - <Reasoning> auto-opens/closes for thinking blocks
  - <PromptInputSubmit> shows stop button during streaming

Conversation saved in localStorage (sessionId) for multi-turn resumption.
```

---

## 2. Tech Stack Decision

### Final Chosen Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Shell** | Tauri v2 (Rust) | Smallest desktop binary (~5MB compressed), native webview, no Node.js runtime needed in shell, cross-platform (macOS/Windows/Linux) |
| **Frontend framework** | React 19 + Vite | Required by AI Elements (targets React 19, no `forwardRef`); Vite gives fast HMR; avoids Next.js static export complexity |
| **Styling** | Tailwind CSS v4 | Required by AI Elements; zero config (no `tailwind.config.js`); CSS-in-CSS variables for theming |
| **UI primitives** | shadcn/ui (Vite variant) | Foundation for AI Elements; copy-and-own model means we control all component code; Radix UI primitives for accessibility |
| **AI UI layer** | AI SDK Elements | Pre-built streaming-aware chat components (Message, Conversation, PromptInput, Reasoning, Tool); handles markdown streaming, tool visualization, attachments |
| **AI SDK hooks** | `@ai-sdk/react` useChat + `DefaultChatTransport` | Standard hook for streaming chat; `DefaultChatTransport` allows pointing at any HTTP endpoint (our Hono server); AI SDK v6+ |
| **Backend** | Hono on Node.js (`@hono/node-server`) | Ultrafast, Web Standards-based, <20KB; runs on Node.js without framework overhead; built-in SSE streaming, CORS, and typed RPC client |
| **AI backend** | `@anthropic-ai/claude-agent-sdk` query() | Confirmed working (all tests PASS): subscription auth via local `claude` binary, token-level streaming, multi-turn session resumption. No API key required. |
| **Database** | SQLite via `better-sqlite3` | Synchronous API (simplest for Hono route handlers); fastest local SQLite for Node.js; no async overhead; fits local-first model perfectly |
| **Sidecar bundling** | `esbuild` + `@yao-pkg/pkg` (Node.js) OR `bun build --compile` | pkg: more compatible with better-sqlite3 native modules; bun: smaller binary (~15MB vs ~80MB) but native module support varies |

### Why Hono Sidecar Instead of Pure Rust Backend

The claude-agent-sdk is a Node.js package — it spawns the local `claude` CLI binary. There is no Rust equivalent. All AI integration logic must live in a Node.js process. Given that requirement, a Hono sidecar is the natural fit:

- Hono's `streamSSE()` maps directly onto the claude-agent-sdk async generator event loop (confirmed in tests)
- `better-sqlite3` in the same process handles persistence without IPC overhead
- The Hono typed RPC client (`hono/client`) gives the frontend end-to-end type safety without code generation
- The Rust shell becomes a thin lifecycle manager (spawn sidecar, kill on exit) — no Rust knowledge needed for AI or data features

### Why Not tauri-plugin-sql

Using `tauri-plugin-sql` for SQLite would require routing all database calls through Tauri IPC (invoke), adding latency for every query. Since the Hono sidecar must already exist for AI integration, co-locating the database in the same process with `better-sqlite3` eliminates an extra IPC hop.

### Why Not Vercel AI SDK streamText (standard Anthropic provider)

The standard `@ai-sdk/anthropic` provider requires an `ANTHROPIC_API_KEY` with credits. This boilerplate targets Claude Code subscription users who authenticate via the local `claude` binary — not API keys. The claude-agent-sdk's `query()` function handles subscription auth automatically and has been verified working.

---

## 3. Project Structure

```
claude-tauri-boilerplate/
│
├── package.json                    # Root workspace (npm workspaces)
│   └── workspaces: ["frontend", "server"]
│
├── src-tauri/                      # Tauri Rust shell
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── build.rs
│   ├── binaries/                   # Compiled sidecar binaries (gitignored except placeholder)
│   │   └── hono-server-aarch64-apple-darwin   # macOS ARM64
│   │   └── hono-server-x86_64-pc-windows-msvc # Windows x64
│   │   └── hono-server-x86_64-unknown-linux-gnu
│   ├── capabilities/
│   │   └── default.json            # Shell permission: allow sidecar execution
│   ├── icons/
│   ├── src/
│   │   ├── main.rs                 # Entry point
│   │   └── lib.rs                  # Tauri builder, sidecar spawn, shutdown handler
│   └── tauri.conf.json
│
├── frontend/                       # React/Vite webview app
│   ├── package.json
│   ├── tsconfig.json               # strict: true, paths: @/* → ./src/*
│   ├── vite.config.ts              # @tailwindcss/vite plugin, @/ alias
│   ├── components.json             # shadcn config (rsc: false, Tailwind v4)
│   ├── index.html
│   └── src/
│       ├── main.tsx                # React 19 createRoot()
│       ├── App.tsx                 # Root component, session state, routing
│       ├── styles/
│       │   └── globals.css         # @import "tailwindcss"; + theme variables
│       │                           # @source for streamdown (MessageResponse req.)
│       ├── components/
│       │   ├── ui/                 # shadcn/ui primitives (Button, Input, etc.)
│       │   ├── ai-elements/        # AI Elements (installed via npx ai-elements@latest add)
│       │   │   ├── message.tsx
│       │   │   ├── conversation.tsx
│       │   │   ├── prompt-input.tsx
│       │   │   ├── reasoning.tsx
│       │   │   └── tool.tsx
│       │   ├── Chat.tsx            # Main chat view (Conversation + PromptInput)
│       │   └── SessionSidebar.tsx  # Session list sidebar
│       ├── hooks/
│       │   └── useSession.ts       # Session ID state + localStorage persistence
│       └── lib/
│           └── utils.ts            # shadcn cn() helper
│
└── server/                         # Hono Node.js sidecar
    ├── package.json
    ├── tsconfig.json               # strict: true, module: NodeNext
    ├── build.mjs                   # esbuild bundle + pkg compile script
    └── src/
        ├── index.ts                # Server entry: serve(), CORS, graceful shutdown
        ├── routes/
        │   ├── chat.ts             # POST /api/chat — claude-agent-sdk SSE bridge
        │   └── sessions.ts         # GET/POST /api/sessions, GET /api/sessions/:id/messages
        └── db/
            ├── schema.ts           # CREATE TABLE sessions, messages
            ├── client.ts           # better-sqlite3 Database instance (singleton)
            └── migrations.ts       # Run schema on startup
```

### Key File Responsibilities

**`src-tauri/src/lib.rs`**: Spawns the Hono sidecar binary on app setup, listens for stdout to know when server is ready, kills the sidecar child process when the window is closed.

**`server/src/index.ts`**: Entry point for the Hono server. Runs migrations, registers middleware (CORS, logger), mounts route groups, starts `serve()` on port 3030, handles SIGINT for graceful shutdown.

**`server/src/routes/chat.ts`**: The core bridge between `useChat` and `claude-agent-sdk`. Receives UIMessage array, calls `query()`, translates events to AI SDK data stream protocol via `streamSSE()`.

**`frontend/src/components/Chat.tsx`**: Composes AI Elements components with `useChat`. Handles session ID tracking via `onData` callback.

---

## 4. Sidecar Strategy

### Build Pipeline

The Hono server is a TypeScript project that must be compiled to a standalone binary for Tauri to bundle it.

**Step 1: Bundle TypeScript → Single JS file with esbuild**

```bash
# server/build.mjs
import { build } from 'esbuild'
import { execSync } from 'child_process'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/server.js',
  // better-sqlite3 is a native module — must be external
  external: ['better-sqlite3'],
})
```

**Step 2: Compile to standalone binary with pkg**

```bash
npx @yao-pkg/pkg dist/server.js \
  --target node20-macos-arm64 \
  --output ../src-tauri/binaries/hono-server-aarch64-apple-darwin

# For cross-platform builds, target all platforms:
npx @yao-pkg/pkg dist/server.js \
  --targets node20-macos-arm64,node20-win-x64,node20-linux-x64 \
  --output hono-server
```

**Note on native modules**: `better-sqlite3` contains a precompiled `.node` binary. `pkg` cannot bundle native modules — they must be shipped alongside the binary or built into the pkg virtual filesystem using pkg's `assets` config. The simpler approach: use `bun:sqlite` (Bun's built-in SQLite) with `bun build --compile`, which handles native bindings automatically.

**Bun alternative (recommended for simplicity)**:

```bash
# If using Bun runtime:
bun build --compile --minify src/index.ts \
  --outfile ../src-tauri/binaries/hono-server-aarch64-apple-darwin
# Result: ~15MB standalone binary with SQLite included
```

### Tauri Configuration

**`src-tauri/tauri.conf.json`** — register the external binary and set CSP to allow localhost connections:

```json
{
  "productName": "Claude Tauri Boilerplate",
  "version": "0.1.0",
  "identifier": "com.yourname.claude-tauri-boilerplate",
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": [
      "binaries/hono-server"
    ]
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Claude Tauri Boilerplate",
        "width": 1280,
        "height": 800,
        "resizable": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src ipc: http://ipc.localhost http://localhost:3030; script-src 'self' 'unsafe-inline'"
    }
  },
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../frontend/dist",
    "beforeDevCommand": "cd frontend && npm run dev",
    "beforeBuildCommand": "cd frontend && npm run build"
  }
}
```

**`src-tauri/capabilities/default.json`** — grant shell plugin permission for sidecar:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "binaries/hono-server",
          "sidecar": true,
          "args": true
        }
      ]
    }
  ]
}
```

### Sidecar Lifecycle in Rust

**`src-tauri/src/lib.rs`**:

```rust
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Spawn the Hono sidecar
            let sidecar = handle
                .shell()
                .sidecar("hono-server")
                .unwrap()
                .args(["--port", "3030"]);

            let (mut rx, child) = sidecar.spawn().expect("Failed to spawn hono-server sidecar");

            // Store child handle for cleanup
            app.manage(std::sync::Mutex::new(Some(child)));

            // Log sidecar stdout/stderr in dev
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[sidecar] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[sidecar:err] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(status) => {
                            eprintln!("[sidecar] terminated: {:?}", status);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the sidecar on window close
                if let Some(child_mutex) = window.app_handle().try_state::<std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>>() {
                    if let Ok(mut child_opt) = child_mutex.lock() {
                        if let Some(child) = child_opt.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Port Negotiation

Use a **fixed port (3030)** with a startup check in the sidecar:

```typescript
// server/src/index.ts
const PORT = parseInt(process.env.PORT ?? '3030', 10)

// Check if port is in use before binding
try {
  const server = serve({ fetch: app.fetch, port: PORT })
  console.log(`[hono-server] listening on :${PORT}`)
  process.stdout.write(`READY:${PORT}\n`)  // Signal to Rust that server is up
} catch (err: any) {
  if (err.code === 'EADDRINUSE') {
    // Try PORT+1, PORT+2 ... or exit with error code
    console.error(`[hono-server] port ${PORT} in use`)
    process.exit(1)
  }
  throw err
}
```

The Rust sidecar spawn loop reads stdout. When it sees `READY:3030`, it knows the server is accepting connections. The frontend should wait for this signal (or simply retry with exponential backoff) before making API calls.

---

## 5. Chat Route Implementation

This is the core bridge between the AI SDK UI layer and the claude-agent-sdk. The pattern below is derived from the confirmed working test results.

**`server/src/routes/chat.ts`**:

```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { db } from '../db/client'

const chat = new Hono()

chat.post('/', async (c) => {
  const { messages, sessionId } = await c.req.json<{
    messages: Array<{ role: string; content: string }>
    sessionId?: string
  }>()

  // Extract the last user message
  const lastUserMessage = messages.filter(m => m.role === 'user').at(-1)
  if (!lastUserMessage) {
    return c.json({ error: 'No user message found' }, 400)
  }

  const prompt = typeof lastUserMessage.content === 'string'
    ? lastUserMessage.content
    : JSON.stringify(lastUserMessage.content)

  return streamSSE(c, async (stream) => {
    let capturedSessionId: string | null = sessionId ?? null
    let fullText = ''

    const agentStream = query({
      prompt,
      options: {
        resume: sessionId ?? undefined,   // multi-turn: pass previous session_id
        includePartialMessages: true,      // REQUIRED for token-level streaming
        maxTurns: 10,
        // CRITICAL: do NOT pass ANTHROPIC_API_KEY — subscription auth must be used
        // env: { ANTHROPIC_API_KEY: '' }  // Uncomment if env var leaks into subprocess
      },
    })

    for await (const event of agentStream) {
      // ── Session init: emit session_id to frontend ──────────────────
      if (event.type === 'system' && event.subtype === 'init') {
        capturedSessionId = event.session_id
        await stream.writeSSE({
          event: 'session',
          data: JSON.stringify({ type: 'session', sessionId: event.session_id }),
        })
      }

      // ── Token streaming: translate to AI SDK data stream format ────
      if (event.type === 'stream_event') {
        const e = event.event
        if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
          const token = e.delta.text
          fullText += token
          // AI SDK data stream protocol: "0:" prefix for text parts
          // The \n is part of the SSE data line — SSE adds another \n after
          await stream.writeSSE({ data: `0:${JSON.stringify(token)}\n` })
        }
      }

      // ── Result: emit cost and finalize ─────────────────────────────
      if (event.type === 'result') {
        await stream.writeSSE({
          event: 'result',
          data: JSON.stringify({
            type: 'result',
            cost: event.total_cost_usd,
            sessionId: capturedSessionId,
          }),
        })
      }
    }

    // ── Persist to SQLite after stream completes ────────────────────
    if (capturedSessionId && fullText) {
      const insertMsg = db.prepare(
        'INSERT OR IGNORE INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      const msgId = crypto.randomUUID()
      insertMsg.run(msgId, capturedSessionId, 'assistant', fullText, Date.now())

      // Also persist the user message that triggered this
      const userMsgId = crypto.randomUUID()
      db.prepare(
        'INSERT OR IGNORE INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(userMsgId, capturedSessionId, 'user', prompt, Date.now() - 1)

      // Update session updated_at
      db.prepare('UPDATE sessions SET updated_at = ? WHERE claude_session_id = ?')
        .run(Date.now(), capturedSessionId)
    }
  })
})

export default chat
```

### Important Protocol Notes

The AI SDK's `useChat` with `DefaultChatTransport` expects the **AI SDK data stream protocol**, not raw SSE. Key format details:

- **Text token**: `data: 0:"token text"\n\n` (the `0:` prefix indicates a text part)
- **Custom data**: `event: <name>\ndata: <json>\n\n`
- **Required header**: `x-vercel-ai-ui-message-stream: v1` — without this, `useChat` will not parse the stream correctly

To ensure the header is set, either add it in the `streamSSE` call or use middleware:

```typescript
// Option: Add the required header in the route
return streamSSE(c, async (stream) => {
  c.header('x-vercel-ai-ui-message-stream', 'v1')
  // ... rest of handler
})
```

Alternatively, if the format mismatch causes issues, fall back to using the Vercel AI SDK's `streamText` with `@ai-sdk/anthropic` for the `toUIMessageStreamResponse()` convenience — but this requires an API key, not subscription auth. The custom SSE approach is necessary for subscription auth via claude-agent-sdk.

---

## 6. SQLite Schema

**`server/src/db/schema.ts`**:

```sql
-- Application sessions (our internal sessions, linked to claude-agent-sdk sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                    -- our UUID (app-level)
  title TEXT,                             -- user-facing name (auto-generated or manual)
  created_at INTEGER NOT NULL,            -- Unix timestamp ms
  updated_at INTEGER NOT NULL,            -- Unix timestamp ms
  claude_session_id TEXT                  -- session_id from claude-agent-sdk init event
                                          -- used in options.resume for multi-turn
);

-- Individual messages within a session
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                    -- UUID
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,                  -- plain text or JSON for structured content
  created_at INTEGER NOT NULL,            -- Unix timestamp ms
  cost_usd REAL                           -- nullable; set for assistant messages
);

-- Index for efficient session message lookup (ordered by time)
CREATE INDEX IF NOT EXISTS idx_messages_session_created
  ON messages(session_id, created_at);

-- Index for finding session by claude_session_id during resume
CREATE INDEX IF NOT EXISTS idx_sessions_claude_id
  ON sessions(claude_session_id);
```

**`server/src/db/client.ts`**:

```typescript
import Database from 'better-sqlite3'
import { resolve } from 'path'

// In production (sidecar), store DB in a writable location
// The sidecar receives the app data directory via argv or env
const DB_PATH = process.env.DB_PATH ?? resolve(process.cwd(), 'claude-chat.db')

export const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
```

**`server/src/db/migrations.ts`**:

```typescript
import { db } from './client'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function runMigrations() {
  const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8')
  db.exec(schema)
  console.log('[db] migrations applied')
}
```

### Sessions Route

**`server/src/routes/sessions.ts`**:

```typescript
import { Hono } from 'hono'
import { db } from '../db/client'

const sessions = new Hono()

// List all sessions, ordered newest first
sessions.get('/', (c) => {
  const rows = db.prepare(
    'SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 50'
  ).all()
  return c.json(rows)
})

// Create a new session (called before first message)
sessions.post('/', async (c) => {
  const { title } = await c.req.json<{ title?: string }>()
  const id = crypto.randomUUID()
  const now = Date.now()
  db.prepare(
    'INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, title ?? 'New Chat', now, now)
  return c.json({ id }, 201)
})

// Get messages for a session
sessions.get('/:id/messages', (c) => {
  const { id } = c.req.param()
  const messages = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(id)
  return c.json(messages)
})

// Delete a session
sessions.delete('/:id', (c) => {
  const { id } = c.req.param()
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  return c.json({ ok: true })
})

export default sessions
```

---

## 7. Frontend useChat Setup

### Session Management Hook

**`frontend/src/hooks/useSession.ts`**:

```typescript
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'claude-chat-session-id'

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  )

  const saveSession = (id: string) => {
    setSessionId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const clearSession = () => {
    setSessionId(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return { sessionId, saveSession, clearSession }
}
```

### Chat Component with useChat

**`frontend/src/components/Chat.tsx`**:

```typescript
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useSession } from '../hooks/useSession'

// AI Elements imports
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageToolbar,
  MessageActions,
  MessageAction
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit
} from '@/components/ai-elements/prompt-input'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { Loader } from '@/components/ai-elements/loader'

const API_BASE = 'http://localhost:3030'

export function Chat() {
  const { sessionId, saveSession } = useSession()

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `${API_BASE}/api/chat`,
      // Include sessionId in every request body for multi-turn continuity
      body: () => ({ sessionId }),
    }),
    onData: (part) => {
      // Capture session ID from the stream on first turn
      // The server emits: event: session, data: { type: 'session', sessionId: '...' }
      if ((part as any).type === 'session' && (part as any).sessionId) {
        saveSession((part as any).sessionId)
      }
    },
  })

  const handleSubmit = ({ text }: { text: string; files?: File[] }) => {
    if (!text.trim()) return
    sendMessage({ text })
  }

  return (
    <div className="flex h-screen flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <ConversationEmptyState
              title="Claude Code"
              description="Powered by your Claude Code subscription"
            />
          )}

          {messages.map((message) => (
            <div key={message.id}>
              {message.parts.map((part, i) => {
                const isLastStreaming =
                  status === 'streaming' &&
                  i === message.parts.length - 1 &&
                  message.id === messages.at(-1)?.id

                switch (part.type) {
                  case 'text':
                    return (
                      <Message key={i} from={message.role as 'user' | 'assistant'}>
                        <MessageContent>
                          <MessageResponse>{part.text}</MessageResponse>
                        </MessageContent>
                        {message.role === 'assistant' && !isLastStreaming && (
                          <MessageToolbar>
                            <MessageActions>
                              <MessageAction
                                tooltip="Copy"
                                onClick={() => navigator.clipboard.writeText(part.text)}
                              >
                                {/* Copy icon */}
                              </MessageAction>
                            </MessageActions>
                          </MessageToolbar>
                        )}
                      </Message>
                    )
                  case 'reasoning':
                    return (
                      <Reasoning key={i} isStreaming={isLastStreaming}>
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    )
                  default:
                    return null
                }
              })}
            </div>
          ))}

          {status === 'submitted' && <Loader />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={handleSubmit} className="border-t">
        <PromptInputTextarea placeholder="Message Claude..." />
        <PromptInputFooter>
          <div />
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
```

### CSS Required for MessageResponse

**`frontend/src/styles/globals.css`** must include the streamdown source directive or `MessageResponse` will not render streaming markdown:

```css
@import "tailwindcss";
@import "tw-animate-css";

/* REQUIRED: without this, MessageResponse markdown streaming will not work */
@source "../node_modules/streamdown/dist/*.js";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... full shadcn theme variables ... */
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ... rest of light theme ... */
}

.dark {
  --background: oklch(0.145 0 0);
  /* ... rest of dark theme ... */
}
```

### Hono Server Entry Point

**`server/src/index.ts`**:

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { runMigrations } from './db/migrations'
import chat from './routes/chat'
import sessions from './routes/sessions'

runMigrations()

const app = new Hono()

// CORS: allow Tauri webview origins (both macOS and Windows protocols)
app.use('*', cors({
  origin: [
    'tauri://localhost',        // Tauri custom protocol (macOS/Linux)
    'https://tauri.localhost',  // Tauri on Windows
    'http://localhost:5173',    // Vite dev server
    'http://localhost:1420',    // Alternative Vite port
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-vercel-ai-ui-message-stream'],
  credentials: true,
}))

app.use('*', logger())

app.route('/api/chat', chat)
app.route('/api/sessions', sessions)

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))

const PORT = parseInt(process.env.PORT ?? '3030', 10)

const server = serve({
  fetch: app.fetch,
  port: PORT,
})

// Signal to Tauri Rust shell that server is ready
process.stdout.write(`READY:${PORT}\n`)
console.log(`[hono-server] listening on http://localhost:${PORT}`)

process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})

export type AppType = typeof app
```

---

## 8. Key Open Questions and Risks

### Risk 1: AI SDK Data Stream Protocol Compatibility

**Question**: Does `useChat` with `DefaultChatTransport` correctly parse a hand-crafted SSE stream that uses `0:"token"\n` format?

**Status**: Unverified in integration. The format is documented in the AI SDK source and has been confirmed in other custom-backend integrations with Hono, but not yet tested end-to-end with the claude-agent-sdk event translation.

**Mitigation**: The `x-vercel-ai-ui-message-stream: v1` header is required. If the streaming is not parsed correctly, a fallback is to use `TextStreamChatTransport` with a simpler plain-text stream:

```typescript
// Frontend fallback:
import { TextStreamChatTransport } from 'ai'
transport: new TextStreamChatTransport({ api: `${API_BASE}/api/chat` })

// Server fallback: use streamText() instead of raw SSE
return streamText(c, async (stream) => {
  for await (const event of agentStream) {
    if (event.type === 'stream_event') {
      const e = event.event
      if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
        await stream.write(e.delta.text)
      }
    }
  }
})
```

This loses custom events (session ID, cost) but guarantees compatibility with `useChat`.

### Risk 2: Sidecar Binary Size

| Bundler | Node.js pkg | Bun compile |
|---------|-------------|-------------|
| Binary size | ~80-100MB | ~15-30MB |
| Native module support | Requires pkg assets config | Built-in |
| SQLite | `better-sqlite3` (external .node) | `bun:sqlite` (compiled in) |
| Maturity | Stable, widely used | Newer, less tested |

**Recommendation**: Start with Bun for development. The `bun:sqlite` API is compatible enough with `better-sqlite3` for our schema (minor API differences: `db.query()` vs `db.prepare()`). Switch to pkg only if specific `better-sqlite3` features are needed.

**If using Bun SQLite**, adjust the db client:

```typescript
// server/src/db/client.ts (Bun version)
import { Database } from 'bun:sqlite'
export const db = new Database(process.env.DB_PATH ?? 'claude-chat.db')
db.run('PRAGMA journal_mode = WAL')
db.run('PRAGMA foreign_keys = ON')
```

### Risk 3: Claude Code Auth — ANTHROPIC_API_KEY Leakage

**Critical finding from tests**: If `ANTHROPIC_API_KEY` is set in the environment (even from `.zshrc`), the claude-agent-sdk will use API key auth instead of subscription auth. This silently fails if the key has no credits or is invalid.

**Mitigation strategies**:

1. Pass a blank env override to the sidecar via Rust argv: `--env ANTHROPIC_API_KEY=`
2. In the sidecar entry point, explicitly blank the key before calling `query()`:
   ```typescript
   // server/src/index.ts — top of file, before any imports that might read env
   delete process.env.ANTHROPIC_API_KEY
   ```
3. In the `query()` options, override the env passed to the subprocess:
   ```typescript
   query({
     prompt,
     options: {
       env: { ANTHROPIC_API_KEY: '' },  // blank it for the subprocess
       // ... other options
     }
   })
   ```

**Testing**: Always test subscription auth with `ANTHROPIC_API_KEY=""` prefix to verify it's not leaking from the shell environment.

### Risk 4: Port Conflicts

Fixed port 3030 may be occupied by another process on the user's machine.

**Mitigation**: Implement port scanning in the sidecar startup:

```typescript
import { createServer } from 'net'

async function findAvailablePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(start, () => {
      const port = (server.address() as any).port
      server.close(() => resolve(port))
    })
    server.on('error', () => findAvailablePort(start + 1).then(resolve).catch(reject))
  })
}

const PORT = await findAvailablePort(3030)
```

The Rust shell reads `READY:<port>` from stdout and stores the port; the React app reads it via `window.__TAURI__.invoke('get_server_port')` or a Tauri event before making any API calls.

### Risk 5: claude-agent-sdk Event Schema Stability

The SDK is versioned at v0.2.76 — pre-1.0. Event shapes (especially `stream_event` internals) may change. The event translation layer in `chat.ts` directly accesses `event.event.delta.text` — this path could break on SDK updates.

**Mitigation**: Pin the SDK version in `server/package.json`:
```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "0.2.76"
  }
}
```

Upgrade only after verifying the test suite passes with the new version.

---

## 9. Development Workflow

### Local Development (No Binary Needed)

During development, the sidecar can be run as a plain Node.js process alongside the Tauri dev server:

```bash
# Terminal 1: Start Hono server
cd server && npm run dev   # ts-node or tsx watching src/

# Terminal 2: Start Tauri dev (Vite + Rust watcher)
# Edit tauri.conf.json devUrl to point at vite dev server
npm run tauri dev
```

In dev mode, the Tauri shell does not need to spawn the sidecar — it is already running. Configure `devUrl` in `tauri.conf.json` and point `DefaultChatTransport` at `http://localhost:3030`.

### Production Build Sequence

```bash
# 1. Build and bundle the Hono server
cd server && npm run build
# → dist/server.js (esbuild bundle)

# 2. Compile to platform binary
npm run pkg:macos    # → src-tauri/binaries/hono-server-aarch64-apple-darwin
npm run pkg:windows  # → src-tauri/binaries/hono-server-x86_64-pc-windows-msvc
npm run pkg:linux    # → src-tauri/binaries/hono-server-x86_64-unknown-linux-gnu

# 3. Build frontend
cd frontend && npm run build
# → frontend/dist/

# 4. Build Tauri app
npm run tauri build
# → src-tauri/target/release/bundle/
```

### Environment Variable Requirements

| Variable | Where Set | Purpose |
|----------|-----------|---------|
| `ANTHROPIC_API_KEY` | Must be UNSET or blank | Subscription auth requires this absent |
| `DB_PATH` | Set by Rust shell via sidecar argv | Path to SQLite file in app data dir |
| `PORT` | Optional | Defaults to 3030; override for conflict resolution |

The SQLite database should be stored in the platform app data directory, resolved by Tauri:

```rust
// In lib.rs setup:
let app_data = app.path().app_data_dir()?.to_str().unwrap().to_string();
sidecar.args(["--port", "3030", "--db-path", &format!("{}/chat.db", app_data)])
```

---

## 10. Package Manifest Summary

**`server/package.json`**:
```json
{
  "name": "claude-tauri-server",
  "type": "module",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "0.2.76",
    "@hono/node-server": "^1.13.0",
    "better-sqlite3": "^11.0.0",
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@yao-pkg/pkg": "^5.12.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.7.0"
  }
}
```

**`frontend/package.json`**:
```json
{
  "name": "claude-tauri-frontend",
  "dependencies": {
    "@ai-sdk/react": "^1.0.0",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "ai": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

**AI Elements** (installed via CLI, not npm):
```bash
npx ai-elements@latest add conversation message prompt-input reasoning tool loader
```

---

## Summary

This architecture delivers a fully local-first desktop AI chat application with the following verified properties:

1. **Subscription auth works** — claude-agent-sdk `query()` authenticates via the local `claude` CLI binary with no API key (all tests passed).
2. **Token-level streaming works** — `options.includePartialMessages: true` emits `stream_event` / `content_block_delta` events that translate cleanly to SSE output.
3. **Multi-turn context works** — `options.resume: sessionId` correctly loads conversation history (Turn 2 recalled Turn 1 context in tests).
4. **The full stack is JavaScript-friendly** — the Rust shell is minimal boilerplate; all AI logic, database access, and HTTP routing live in the Node.js sidecar which any JS developer can work on without Rust knowledge.
