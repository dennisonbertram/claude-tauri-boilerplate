# Boilerplate Contract

What every descendant app inherits and what can be customized.

## Required Components

Every derivative **must** retain:

| Component | Path | Why |
|-----------|------|-----|
| Tauri desktop shell | `apps/desktop/src-tauri/` | Window lifecycle, IPC bridge, capability enforcement |
| Sidecar server | `apps/server/` | Auth, API routing, DB; runs as bundled binary |
| Auth flow | `apps/desktop/src/components/auth/` + server middleware | Token issuance, session management |
| Shared package | `packages/shared/` | Type contracts between renderer and server |
| Security config | `tauri.conf.json` `security` section + `capabilities/` | CSP, IPC permissions (see `security-model.md`) |

Removing any of the above breaks the trust model or build pipeline.

## Optional / Removable

| Component | Notes |
|-----------|-------|
| Settings panels (`components/settings/`) | Remove or replace freely |
| Linear integration (`components/linear/`) | Drop if unused |
| Teams UI (`components/teams/`) | Drop if single-user |
| Agent builder (`components/agent-builder/`) | Drop if not needed |
| Workspace UI (`components/workspaces/`) | Replaceable; keep workspace setup contract |

## Version & Dependency Rules

1. **Tauri v2** -- do not downgrade to v1; capability model depends on v2.
2. **Node sidecar** -- pin major version in `package.json`; keep `externalBin` entry in `tauri.conf.json`.
3. **Shared types** -- `packages/shared` is the single source of truth for API contracts. Never duplicate types in `apps/`.
4. **Lock files** -- commit `pnpm-lock.yaml` and `Cargo.lock`. Reproducible builds are mandatory.

## Quality Gates

Every PR must pass **all** of the following before merge:

- `pnpm typecheck` -- zero errors across workspaces
- `pnpm test` -- all unit/integration tests green
- `pnpm build` -- production build succeeds for both renderer and server
- `cargo clippy` -- no warnings in Tauri Rust code
- **Security config assertions**:
  - CSP in `tauri.conf.json` is not `null` (see `security-model.md`)
  - `capabilities/default.json` uses scoped permissions (no `shell:default`)
  - No plaintext secrets in committed files (`.env.example` has placeholders only)
- **Bundle check** -- `externalBin` entry for server binary exists in `tauri.conf.json`
