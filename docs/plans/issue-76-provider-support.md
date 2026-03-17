# Issue #76: Provider Support (Wave 1)

## Scope
- Add provider selection in settings for Anthropic, AWS Bedrock, Google Vertex, and Custom base URL.
- Persist provider fields in app settings so values survive restarts.
- Pass provider and provider-specific config from desktop request payload to server stream service.
- Add backend support for provider-specific environment variables.

## Acceptance Checklist
- [x] Settings UI shows provider selection with Bedrock / Vertex / Custom options.
- [x] Bedrock-specific fields are shown only for Bedrock and persisted.
- [x] Vertex-specific fields are shown only for Vertex and persisted.
- [x] Custom base URL field is shown only for Custom and persisted.
- [x] Chat transport sends provider and providerConfig in each request body.
- [x] Chat route forwards provider/providerConfig to `streamClaude`.
- [x] Server service maps provider config to environment variables used by Claude Agent SDK.
- [x] Provider env state is restored after each stream, including error paths.
- [x] Automated tests added/updated for provider selection and provider env behavior.
