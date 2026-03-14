# Tauri v2 Architecture Research

**Date:** 2026-03-14
**Scope:** Architecture overview, IPC, React/Next.js integration, sidecar servers, SQLite, filesystem, window.__TAURI__, tauri.conf.json

---

## 1. Tauri v2 Architecture Overview

### Main Process vs. Webview

Tauri v2 is a Rust-native desktop/mobile application framework with three conceptual layers:

1. **Webview** — The frontend (HTML/CSS/JS or any web framework). Runs in a platform-native webview (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux).
2. **Rust Core** — The main process. Handles system integration, lifecycle, plugin management, IPC dispatch, window management, and spawning sidecar processes.
3. **Sidecars / Plugins** — External binaries or Rust plugins that extend capabilities (SQLite access, shell execution, HTTP servers, etc.).

There is no bundled Node.js runtime — the Rust backend is the authoritative process orchestrator. This distinguishes Tauri from Electron.

### IPC in v2 (Revised from v1)

v2 IPC is a significant improvement over v1:

- v1 used string serialization through the webview interface (slow, limited).
- v2 uses **custom protocols** (similar in performance to HTTP-based webview communication) for delivering messages between Rust and JavaScript.
- A new **Channel API** allows fast, streaming data delivery from Rust to the frontend.

**Command definition in Rust:**
```rust
#[tauri::command]
fn my_custom_command() {
    println!("I was invoked from JavaScript!");
}

// Register in builder:
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![my_custom_command])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

**Accessing the WebviewWindow inside a command:**
```rust
#[tauri::command]
async fn my_custom_command(webview_window: tauri::WebviewWindow) {
    println!("WebviewWindow: {}", webview_window.label());
}
```

---

## 2. Setting Up Tauri v2 with React or Next.js

### Quickstart (React + Vite — official template)

```bash
npm create tauri-app@latest
# Select: TypeScript, React, Vite
```

This scaffolds:
- `src/` — React frontend (Vite)
- `src-tauri/` — Rust backend (Cargo project, tauri.conf.json, capabilities)

### Adding Tauri to an Existing Next.js Project

```bash
# In your Next.js project root:
npm install -D @tauri-apps/cli@latest
npx tauri init
```

During `tauri init`, specify:
- Dev server URL: `http://localhost:3000` (Next.js default)
- Build output directory: `out` (requires Next.js static export: `output: 'export'` in `next.config.js`)

**Dev workflow:**
```bash
npm run tauri dev    # starts both Next.js dev server and Tauri window
npm run tauri build  # bundles for distribution
```

**Important Next.js note:** Tauri requires a static export (`next export` / `output: 'export'`) for production bundling because there is no Node.js server in production. For development, the live Next.js dev server works fine via `devUrl`.

---

## 3. Running an Embedded Server Sidecar (e.g., Node.js/Hono/Bun)

### Concept

A sidecar is an external binary that Tauri bundles and spawns at runtime. The user does not need the underlying runtime (Node.js, Python, Bun, etc.) installed. The binary is compiled to a self-contained executable.

### Architecture Pattern

```
Tauri Webview (React/Next.js)
        |
        | HTTP fetch to localhost:PORT
        |
Embedded Server Sidecar (Hono/Express/FastAPI/Bun)
        |
   stdin/stdout (optional for token auth or RPC)
        |
Rust Backend (spawns/manages sidecar, handles lifecycle)
```

### Tooling for Bundling JS Servers

| Runtime | Bundling Tool | Notes |
|---------|---------------|-------|
| Node.js | `@yao-pkg/pkg` | Compiles to platform binary; larger output |
| Bun | `bun build --compile` | Native standalone binary; ~60MB → ~29MB app |
| Deno | `deno compile` | ~73MB binary; ~36MB final app |
| Python | `pyinstaller -F` | Single-file executable |

### Hono on Node.js as Sidecar (Practical Example)

1. Create a `sidecar/` directory at the project root.
2. Write your Hono server (`index.ts`), e.g. listening on a fixed or dynamic port.
3. Bundle with `esbuild` + `@yao-pkg/pkg`:
   ```bash
   esbuild index.ts --bundle --platform=node --outfile=dist/server.js
   pkg dist/server.js --output my-sidecar
   ```
4. Rename binary with target triple suffix:
   ```bash
   # macOS ARM64:
   mv my-sidecar my-sidecar-aarch64-apple-darwin
   # Find your triple: rustc --print host-tuple
   ```
5. Place in `src-tauri/binaries/`.

### tauri.conf.json — Register the External Binary

```json
{
  "bundle": {
    "externalBin": ["binaries/my-sidecar"]
  }
}
```

### Capabilities — Grant Shell Permission

In `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "args": true,
          "name": "binaries/my-sidecar",
          "sidecar": true
        }
      ]
    }
  ]
}
```

---

## 4. Shell Sidecar Feature — Spawning and Communicating

### Plugin Setup

Install the shell plugin:
```bash
npm run tauri add shell
# or manually: cargo add tauri-plugin-shell
```

In `lib.rs`:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    // ...
```

### Spawning from Rust with stdout/stdin

```rust
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tauri::Emitter;

let sidecar_command = app.shell().sidecar("my-sidecar").unwrap();
let (mut rx, mut child) = sidecar_command
    .spawn()
    .expect("Failed to spawn sidecar");

tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stdout(line_bytes) = event {
            let line = String::from_utf8_lossy(&line_bytes);
            app.emit("message", Some(format!("'{}'", line)))
                .expect("failed to emit event");
            // Write to sidecar's stdin:
            child.write("message from Rust\n".as_bytes()).unwrap();
        }
    }
});
```

### Spawning from JavaScript

```javascript
import { Command } from '@tauri-apps/plugin-shell';

const command = Command.sidecar('binaries/my-sidecar', ['--port', '4000']);
const output = await command.execute();
console.log(output.stdout);
```

### HTTP Server Sidecar Pattern (Recommended for Hono)

For a long-running HTTP server sidecar, the preferred approach:

1. **Rust spawns the sidecar** at app startup (in `setup` hook or `main.rs`).
2. **Sidecar listens on localhost:PORT** (fixed port or passed via argument).
3. **Frontend fetches directly** to `http://localhost:PORT/api/...` — no Tauri IPC needed for data calls.
4. **Lifecycle management**: Rust kills the sidecar child process when the app closes (use Tauri's `on_window_event` or `CloseRequested` handler).

**Security note on HTTP sidecars:** Since the sidecar is on localhost, any other local process could hit it. Mitigation strategies:
- **Token auth**: Rust generates a per-session secret, passes it to the sidecar via argv or stdin; frontend requests a token via Tauri IPC (`invoke`) then includes it in all HTTP headers.
- **kkrpc (bi-directional RPC over stdin/stdout)**: A library providing type-safe, full-duplex RPC over stdin/stdout, eliminating the need for custom auth logic.

### Communication Modes Summary

| Mode | Use Case | Pros | Cons |
|------|----------|------|------|
| stdout/stdin (one-shot) | Simple commands, short responses | Simple | Not streaming |
| stdin/stdout streaming | Long-lived RPC (kkrpc) | Type-safe, no HTTP overhead | More complex setup |
| localhost HTTP | Full REST/GraphQL API | Easy frontend integration | Security considerations |
| Tauri Event/Channel | Rust-to-frontend push | Built-in, fast | Frontend-initiated only via invoke |

---

## 5. SQLite Integration Options

### Option A: tauri-plugin-sql (Simplest)

Official plugin wrapping `sqlx`. Exposes SQLite to JS frontend via Tauri IPC.

**Install:**
```bash
npm run tauri add sql
cargo add tauri-plugin-sql --features sqlite
```

**Initialize in lib.rs:**
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    // ...
```

**JavaScript usage:**
```javascript
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:myapp.db');

// Execute (INSERT, UPDATE, DELETE):
await db.execute(
    'INSERT INTO todos (id, title, status) VALUES ($1, $2, $3)',
    [1, 'Buy milk', 'pending']
);

// Select:
const rows = await db.select('SELECT * FROM todos WHERE status = $1', ['pending']);
```

**Preload in tauri.conf.json:**
```json
{
  "plugins": {
    "sql": {
      "preload": ["sqlite:myapp.db"]
    }
  }
}
```

**Permissions** (in capabilities file):
- Default: `allow-close`, `allow-load`, `allow-select` (read-only).
- Add `sql:allow-execute` for write operations.

**Synchronous (deferred connection) API:**
```javascript
const db = Database.get('sqlite:test.db');
// Connection opens on first query
```

**Database file location:** Stored in the app's data directory (platform-specific, managed by Tauri).

### Option B: Drizzle ORM + sqlx Proxy Pattern

For teams wanting type-safe ORM on the frontend with SQLite on the backend:

- Write a custom Rust command that acts as a SQL proxy (executes raw SQL via `sqlx`, returns JSON).
- Use Drizzle ORM in "sqlite-proxy" mode on the frontend — it sends all queries to the Rust proxy command via `invoke`.
- Use `tauri-plugin-sql` only for migrations.

```
Frontend (Drizzle) --> invoke('sql_proxy', {query, params}) --> Rust (sqlx) --> SQLite file
```

Reference: [tauri-drizzle-proxy](https://github.com/meditto/tauri-drizzle-proxy)

### Option C: SQLite via HTTP Sidecar

Run SQLite inside a Node.js/Bun sidecar that exposes a REST or RPC API. The frontend fetches from `localhost:PORT`. This allows:
- Using any Node.js SQLite library (`better-sqlite3`, `bun:sqlite`, Drizzle with Node adapter).
- Full ORM support without Rust knowledge.
- Easier to port to a web service later.

**Trade-off:** Larger binary size, security considerations for localhost exposure.

---

## 6. File System Access and App Data Directory

### Plugin Setup

```bash
npm run tauri add fs
```

**Scoped access in capabilities:**
```json
{
  "permissions": [
    {
      "identifier": "fs:scope",
      "allow": [{ "path": "$APPDATA/databases/*" }]
    }
  ]
}
```

### JavaScript API

```javascript
import { appLocalDataDir, appDataDir } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

// Get the app data directory path:
const dataDir = await appLocalDataDir();
// macOS: ~/Library/Application Support/com.example.app
// Windows: C:\Users\user\AppData\Local\com.example.app
// Linux: ~/.local/share/com.example.app

const appDataPath = await appDataDir();

// Read/write files:
const content = await readTextFile('config.json', { baseDir: BaseDirectory.AppData });
await writeTextFile('config.json', JSON.stringify(config), { baseDir: BaseDirectory.AppData });
```

### Key Path Directories

| API Function | Resolves To |
|-------------|-------------|
| `appDataDir()` | `${dataDir}/${identifier}` |
| `appLocalDataDir()` | `${localDataDir}/${identifier}` |
| `appConfigDir()` | `${configDir}/${identifier}` |
| `appCacheDir()` | `${cacheDir}/${identifier}` |
| `appLogDir()` | `${logDir}/${identifier}` |

The `identifier` is set in `tauri.conf.json` (reverse domain format, e.g., `com.company.appname`).

---

## 7. window.__TAURI__ and invoke Patterns

### Enabling the Global Object

In `tauri.conf.json`:
```json
{
  "app": {
    "withGlobalTauri": true
  }
}
```

This exposes all Tauri APIs at `window.__TAURI__`. Useful for non-module JS environments or quick debugging.

### Recommended: npm Package Import

For module-based frontends (React, Next.js, Vue):
```bash
npm install @tauri-apps/api
```

```javascript
import { invoke } from '@tauri-apps/api/core';

// Basic invoke:
const result = await invoke('my_command');

// With arguments:
const result = await invoke('my_command', { message: 'hello', count: 42 });

// With error handling:
try {
    const data = await invoke<MyType>('fetch_data', { id: 1 });
} catch (e) {
    console.error('Command failed:', e);
}
```

### Using window.__TAURI__ (global fallback):
```javascript
const invoke = window.__TAURI__.core.invoke;
await invoke('my_command');
```

### Rust Command with Return Value

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

```javascript
const greeting = await invoke('greet', { name: 'World' });
// greeting === "Hello, World!"
```

### Rust Command with Async + Error

```rust
#[tauri::command]
async fn fetch_data(id: u32) -> Result<String, String> {
    // Err values are propagated to the JS catch block
    Ok(format!("Data for {}", id))
}
```

### Tauri Events (Rust → Frontend push)

```rust
use tauri::Emitter;
app.emit("data-update", payload).unwrap();
```

```javascript
import { listen } from '@tauri-apps/api/event';
const unlisten = await listen('data-update', (event) => {
    console.log(event.payload);
});
// Call unlisten() to stop listening
```

---

## 8. tauri.conf.json Full Structure (v2)

```json
{
  "productName": "My App",
  "version": "0.1.0",
  "identifier": "com.company.myapp",
  "mainBinaryName": "myapp",

  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "label": "main",
        "title": "My App",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "decorations": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src ipc: http://ipc.localhost; http://localhost:4000",
      "pattern": {
        "use": "brownfield"
      },
      "headers": {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp"
      },
      "freezePrototype": false,
      "dangerousDisableAssetCspModification": false
    },
    "trayIcon": {
      "iconPath": "icons/tray.png",
      "iconAsTemplate": true
    },
    "macOSPrivateApi": false,
    "enableGTKAppId": false
  },

  "build": {
    "devUrl": "http://localhost:3000",
    "frontendDist": "../out",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "features": []
  },

  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "externalBin": [
      "binaries/my-server"
    ],
    "fileAssociations": [],
    "macOS": {
      "minimumSystemVersion": "10.15",
      "signingIdentity": null,
      "entitlements": null
    },
    "windows": {
      "digestAlgorithm": "sha256",
      "certificateThumbprint": null
    }
  },

  "plugins": {
    "sql": {
      "preload": ["sqlite:myapp.db"]
    },
    "shell": {
      "open": false
    }
  }
}
```

**Note on CSP and local server sidecars:** If the frontend fetches from a local HTTP sidecar server (e.g., `http://localhost:4000`), the CSP `connect-src` must include that origin.

---

## 9. Recommended Architecture for a Boilerplate

Based on the research, two primary architectures suit a Tauri v2 + React/Next.js + SQLite boilerplate:

### Architecture A: Pure Rust Backend (Simplest / Smallest Binary)

```
Next.js (static export) ←→ Tauri IPC (invoke) ←→ Rust Commands ←→ SQLite (tauri-plugin-sql / sqlx)
```

- **Frontend:** Next.js with `output: 'export'`
- **IPC:** `invoke()` from `@tauri-apps/api/core`
- **Database:** `tauri-plugin-sql` or custom sqlx proxy (for Drizzle)
- **Binary size:** ~5-15MB compressed
- **Pros:** Smallest binary, tightest integration, no extra processes
- **Cons:** Requires Rust knowledge for backend features

### Architecture B: Hono/Node.js Sidecar as Backend (Most Familiar for JS Devs)

```
Next.js (dev server or static) ←→ fetch(localhost:4000) ←→ Hono Server (sidecar)
                                                               ↕ SQLite (better-sqlite3 or bun:sqlite)
                  ←→ invoke() ←→ Rust (lifecycle management only)
```

- **Frontend:** Next.js with static export (prod) or dev server (dev)
- **Backend:** Hono server compiled to binary via `@yao-pkg/pkg` (Node.js) or `bun build --compile` (Bun)
- **Database:** `better-sqlite3` or `bun:sqlite` inside the sidecar, or separate `tauri-plugin-sql`
- **IPC:** HTTP fetch to `localhost:PORT` for data; `invoke()` for app-level operations (window, tray, etc.)
- **Binary size:** ~30-60MB compressed
- **Pros:** Full JS ecosystem, familiar patterns, easy to migrate to web later
- **Cons:** Larger binary, security considerations for localhost HTTP

### Architecture C: Hybrid (Recommended for This Boilerplate)

```
Next.js ←→ invoke() ←→ Rust (IPC layer + lifecycle)
         ←→ fetch(localhost:4000) ←→ Hono Sidecar (API routes)
                                        ↕
                                    SQLite (bun:sqlite)
```

Use Rust for:
- App lifecycle (window events, tray, system dialogs)
- Security-sensitive operations
- Spawning and managing the sidecar

Use Hono sidecar for:
- Business logic API routes
- SQLite database access
- Any Node.js ecosystem libraries

---

## 10. Key External Resources

- [Tauri v2 Official Docs](https://v2.tauri.app/)
- [Tauri v2 Sidecar Guide](https://v2.tauri.app/develop/sidecar/)
- [Node.js as a Tauri Sidecar](https://v2.tauri.app/learn/sidecar-nodejs/)
- [tauri-plugin-sql](https://v2.tauri.app/plugin/sql/)
- [Using Bun/Deno as Web Server in Tauri](https://codeforreal.com/blogs/using-bun-or-deno-as-a-web-server-in-tauri/)
- [Tauri v2 + Next.js + Python Server Sidecar Example](https://github.com/dieharders/example-tauri-v2-python-server-sidecar)
- [Local-First Desktop App with Rust + Node.js (GitHub)](https://github.com/codeforreal1/Local-First-Desktop-App-Rust-NodeJS)
- [Tauri v2 + Drizzle + SQLite Starter Template](https://dev.to/meddjelaili/building-a-tauri-v2-drizzle-sqlite-app-starter-template-15bm)
- [Embedding SQLite in a Tauri Application (2025)](https://dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html)
- [Tauri Configuration Reference](https://v2.tauri.app/reference/config/)
