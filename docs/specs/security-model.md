# Security Model

Trust boundaries and rules that descendant apps must not weaken.

## Trust Boundaries

```
+------------------+       IPC (Tauri invoke)       +------------------+
|   Renderer       | <---------------------------->  |   Tauri Core     |
|   (webview)      |   capability-gated commands     |   (Rust)         |
+------------------+                                 +------------------+
        |                                                    |
        | HTTP + Bearer token                                | spawns
        v                                                    v
+------------------+                                 +------------------+
|   Sidecar Server |                                 |   OS / FS        |
|   (Node.js)      |                                 +------------------+
+------------------+
```

- **Renderer**: untrusted. May load external content. Never grant direct OS access.
- **Sidecar server**: semi-trusted. Runs as a child process with scoped permissions.
- **Tauri core (Rust)**: trusted. Mediates all privileged operations via capabilities.
- **OS**: fully trusted. Tauri core is the only bridge.

## CSP Requirements

- `tauri.conf.json` `app.security.csp` **must not be `null`**.
- Minimum policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`.
- No `unsafe-eval` in production builds.
- Descendant apps must tighten, never loosen, the CSP.

> **Current state**: CSP is `null` in the boilerplate. Issue tracked -- descendants must fix before shipping.

## Credential Storage

- **Secrets** (API keys, tokens): store via OS keychain (`tauri-plugin-stronghold` or platform keyring). Never in `localStorage`, `SQLite`, or flat files.
- **Session tokens**: hold in memory only. Persist refresh tokens in keychain if needed.
- **`.env` files**: never committed. `.env.example` contains placeholders only.

## Shell Capability Rules

- Use **scoped** shell permissions: `shell:allow-spawn`, `shell:allow-kill`, `shell:allow-stdin-write`.
- **Never** use `shell:default` (blanket shell access).
- Every new shell command must be added to an explicit allow-list in `capabilities/`.
- Sidecar binary path must be declared in `externalBin`; no arbitrary binary execution.

## Transport Security (Renderer <-> Sidecar)

- All HTTP requests from the renderer to the sidecar must include a **Bearer token** in the `Authorization` header.
- The sidecar must validate the token on every request via auth middleware.
- Sidecar listens on `127.0.0.1` only; never bind `0.0.0.0`.
- Use HTTPS in production if the sidecar is exposed beyond localhost.

## What Descendants Must NOT Weaken

1. Do not set CSP to `null` or add `unsafe-eval`.
2. Do not grant `shell:default` or unscoped IPC permissions.
3. Do not store secrets in `localStorage`, cookies, or SQLite.
4. Do not remove Bearer token validation from sidecar middleware.
5. Do not bind the sidecar to `0.0.0.0`.
6. Do not bypass Tauri's capability model with custom IPC bridges.
