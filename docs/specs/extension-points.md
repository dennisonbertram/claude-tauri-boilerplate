# Extension Points

How to safely extend the boilerplate without breaking the contract.

## Adding a New Settings Panel

1. Create a component in `apps/desktop/src/components/settings/`.
2. Register it in the settings router/layout (follow existing panel pattern).
3. If the panel needs server-side config, add a route (see below) and a shared type.
4. No capability changes needed -- settings panels are renderer-only.

## Adding New API Routes

1. Create a route file in `apps/server/src/routes/`.
2. Register it in `apps/server/src/index.ts`.
3. Define request/response types in `packages/shared/`.
4. All routes must:
   - Pass through auth middleware (Bearer token validation).
   - Validate input (use Zod or equivalent).
   - Return typed responses matching the shared contract.
5. No direct filesystem or shell access from routes. Use service layer abstractions.

## Adding New Integrations

### MCP Servers
1. Add the MCP server config to `.mcp.json`.
2. Implement a client wrapper in `apps/server/src/services/`.
3. Expose via API routes (see above).
4. Document required environment variables in `.env.example`.

### External APIs
1. Add a service in `apps/server/src/services/`.
2. Store API keys in environment variables, never hardcoded.
3. Add types to `packages/shared/` for any data surfaced to the renderer.
4. Rate-limit and error-handle at the service layer.

## Customizing the Workspace Setup Contract

1. Workspace logic lives in `apps/desktop/src/components/workspaces/`.
2. The workspace setup flow can be replaced entirely -- it is optional (see `boilerplate-contract.md`).
3. If you change the workspace data model, update:
   - Server DB schema (`apps/server/src/db/`).
   - Shared types (`packages/shared/`).
   - Any API routes that reference workspace data.
4. Keep workspace creation idempotent -- the UI may retry on failure.

## Adding New Tauri Capabilities

This is the highest-risk extension. Follow this process:

1. **Identify the minimum permission** needed. Prefer scoped variants (e.g., `fs:allow-read` with a path scope over `fs:default`).
2. **Add to `capabilities/default.json`** (or create a new capability file for separation).
3. **Document why** the capability is needed in a PR description.
4. **Review checklist** before merge:
   - [ ] No blanket permissions (`*:default` patterns).
   - [ ] Scoped to specific windows if possible.
   - [ ] Does not weaken existing security model (see `security-model.md`).
   - [ ] Tested with `cargo tauri build` -- capability validation passes.
5. **Never add `shell:default`**, `fs:default`, or `http:default`. Always use scoped alternatives.

## General Rules for All Extensions

- Types flow through `packages/shared/`. Do not create parallel type definitions.
- Test new functionality: unit tests for services, integration tests for routes.
- Run all quality gates from `boilerplate-contract.md` before opening a PR.
