# Desktop Runtime Security Boundary

## Overview

The Tauri desktop app enforces a minimal trust boundary between the
webview renderer and the host operating system.

## Renderer (webview)

- Runs under a strict Content Security Policy (CSP).
- `script-src 'self'` — only first-party scripts execute.
- `connect-src` is limited to IPC and the local sidecar port.
- `object-src 'none'` and `frame-ancestors 'none'` block embedding attacks.

## Shell Access

- The only permitted spawn target is the `binaries/server` sidecar.
- Arguments are validated by regex (`^\d{4,5}$` for the port flag).
- `shell:allow-stdin-write` and `shell:allow-execute` are **not** granted.
- `shell:allow-kill` is retained so the app can stop the sidecar on exit.

## Sidecar Communication

- The sidecar runs as a local HTTP server on a dynamically chosen port.
- The renderer talks to it over `http://localhost:<port>`.
- No direct filesystem or OS access is exposed to the renderer.

## Guidelines for Downstream Apps

- Keep capabilities minimal — only add permissions you actively use.
- Scope every `shell:allow-spawn` entry to a specific binary and args.
- Never set `"csp": null` in production builds.
- Audit `capabilities/default.json` whenever you add a new Tauri plugin.
