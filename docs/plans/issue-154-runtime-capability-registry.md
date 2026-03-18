# Issue #154 Runtime Capability Registry

## Goal

Create one shared provider/runtime capability registry so the desktop settings UI, chat transport payload builder, backend validation, and Claude env mapping all use the same source of truth.

## Acceptance Criteria

- [x] Shared registry exists under `packages/shared` and defines the supported providers.
- [x] Shared types derive provider-related unions and config keys from the registry where practical.
- [x] Settings UI renders provider-specific fields from shared metadata instead of hard-coded branches.
- [x] Chat transport builds `providerConfig` from registry metadata instead of a handwritten object.
- [x] Backend request validation consumes shared provider metadata rather than re-declaring provider fields.
- [x] Claude env mapping consumes shared registry/env metadata for Anthropic, Bedrock, Vertex, and custom.
- [x] Regression tests cover registry-driven settings, transport payloads, backend validation, and env mapping.
- [x] Manual API verification covers the runtime-capabilities route and a provider chat payload.

## Implementation Plan

- [x] Add `packages/shared/src/runtime-capabilities.ts` with provider metadata and helper functions.
- [x] Export the new shared module cleanly from `@claude-tauri/shared`.
- [x] Refactor settings state/types to derive provider IDs and config keys from shared metadata.
- [x] Refactor `SettingsPanel` provider field rendering to use registry metadata.
- [x] Refactor `ChatPage` transport body assembly to use registry helpers.
- [x] Refactor `apps/server/src/routes/chat.ts` validation to use registry-derived Zod shapes.
- [x] Refactor `apps/server/src/services/claude.ts` env mapping to use registry env metadata.
- [x] Add `GET /api/runtime-capabilities` diagnostics route and tests.
- [x] Run targeted tests, full suite, curl verification, and browser verification.

## Notes

- Keep the visible provider set unchanged: `anthropic`, `bedrock`, `vertex`, `custom`.
- Preserve existing stored settings keys during the refactor.
- Do not add new runtime implementations in this issue.
