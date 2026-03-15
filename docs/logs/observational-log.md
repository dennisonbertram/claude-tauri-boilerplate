# Observational Log

Observations, patterns, and things noticed during development. Not necessarily acted on — this is a scratchpad for things worth tracking.

## Format
```
### YYYY-MM-DD: [Observation]

**Category**: Performance | UX | Architecture | Code Quality | Security
**Status**: Noted | Investigating | Resolved
**Details**: What was observed
**Action**: Any follow-up action taken or planned
```

---

### 2026-03-15: Agentation MCP Server Added

**Category**: Architecture
**Status**: Noted
**Details**: Agentation MCP server was added to the project-local `.mcp.json` for AI agent visual feedback integration. It runs via `npx -y agentation-mcp server` and defaults to port 4747. The `<Agentation />` component is rendered dev-only in App.tsx.
**Action**: Worth reviewing: (1) Does the MCP server need any additional config, auth, or port setup beyond defaults? (2) Are the MCP tools it exposes useful for our development workflow, specifically for the Chrome browser testing workflow described in CLAUDE.md? (3) Does port 4747 conflict with anything else we run?

---

### 2026-03-14: Initial Project State

**Category**: Architecture
**Status**: Noted
**Details**: Project started as a research/boilerplate repo with Claude Agent SDK and Vercel AI SDK investigations. Contains test files and investigation docs from initial research phase.
**Action**: Formalized documentation structure to support ongoing development.
