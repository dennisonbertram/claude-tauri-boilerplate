# Generative UI Plan — Architect Review

**Reviewed by:** Grok-4 (grok-4-latest) via `llm` CLI
**Date:** 2026-03-17
**Plan reviewed:** `docs/plans/generative-ui-feature.md`
**Context provided:** `docs/research/generative-ui-landscape.md`, `docs/investigations/generative-ui-ai-sdk-deep-dive.md`

---

## Review Prompt

> You are an expert software architect reviewing a feature implementation plan for a Tauri desktop app with React 19 frontend and Hono/Bun backend. Review the FEATURE PLAN thoroughly using the research context to inform your review. Be direct, specific, and critical. Don't pad with filler. This is a desktop app (Tauri v2), NOT a web app.

---

## 1. STRENGTHS

- **Alignment with existing architecture**: The plan correctly identifies that generative UI can be layered on the frontend rendering without altering the core streaming pipeline (Claude Agent SDK → event mapper → data channel → useStreamEvents). This matches the research's recommendation to extend the tool-result-to-component registry rather than forcing AI SDK's `streamText` integration (Deep Dive section 4).
- **Phased rollout**: Breaking into phases (1: Foundation with zero user-visible change; 2: New components; 3: Integration; 4: Structured output) is pragmatic, allowing incremental testing and minimizing risk. Phase 1's registry refactor directly addresses the research's critique of hard-coded if/switch chains.
- **Focus on lifecycle and states**: Requiring components to handle `'running'`, `'complete'`, and `'error'` states aligns with AI SDK tool parts and ensures robust streaming UX, even though the plan uses custom `ToolCallState`.
- **Extensibility**: Exporting the registry for runtime registration supports future MCP tools, echoing the research's emphasis on dynamic mappings for custom tools (Deep Dive section 4).
- **Testing emphasis**: Mandating React Testing Library for components, vitest/bun tests, and manual verification follows project policy and covers end-to-end flows, reducing regression risks.

---

## 2. CONCERNS

- **Over-reliance on frontend-only changes**: Phases 1-3 claim no backend modifications, but the plan assumes all tool data fits raw `ToolCallState` parsing. If Claude Agent SDK events evolve (e.g., new MCP tools with complex outputs), frontend parsing could fail without backend event mapping adjustments, conflicting with Deep Dive's note on adapting data channels for richer parts (section 3).
- **Input parsing decentralization**: Delegating parsing to individual components risks inconsistency or errors (e.g., malformed JSON during streaming), as highlighted in Key Design Decisions question 3. The recommendation to use try/catch is good but not enforced, potentially leading to unhandled exceptions in production.
- **Tauri-specific risks ignored**: Rendering rich components (e.g., charts, tables) could impact performance in Tauri's WebView (e.g., memory leaks from unoptimized React components or heavy libraries like recharts). The plan doesn't address desktop constraints like variable window sizes or offline behavior.
- **Phase 4's useObject integration**: It introduces a new `/api/generate` endpoint using `streamText`, but the project primarily uses Claude Agent SDK. This creates a split architecture (Agent SDK for chat, AI SDK for structured gen), risking inconsistencies in model usage or error handling (Deep Dive section 2 incompatibility note).
- **Security in desktop context**: No mention of sanitizing tool outputs before rendering, which is riskier in Tauri (direct file system access) than in browsers. Research's `show_widget` approach warns of high security risks from injected content, applicable here if MCP tools return unsanitized data.

---

## 3. GAPS

- **Accessibility and UX polish**: No criteria for a11y (e.g., ARIA labels for tables/charts, keyboard navigation in file trees), critical for a desktop app where users expect native-like interactions.
- **Error recovery and user feedback**: Acceptance Criteria cover basic error states, but not scenarios like partial streaming failures. AI SDK's `'approval-requested'` tool state isn't mirrored.
- **Performance metrics**: No benchmarks for rendering complex components (e.g., large `DataTableDisplay`) in Tauri's WebView, nor handling for heavy tool results in desktop environments.
- **Phase 4 schema details**: Phase 4 lists candidates (code review summary, project health) but lacks concrete schemas or prompt engineering guidelines, leaving it underspecified.
- **Integration with Tauri APIs**: Misses opportunities to leverage Tauri's `fs`/`dialog` modules for components like `FileTreeDisplay`, or window management for slash-command panels.
- **Documentation**: No user-facing docs (e.g., how to use `/dashboard`) or metrics on feature adoption.

---

## 4. RECOMMENDATIONS

### 4.1 Centralize parsing with a utility

Add a shared `parseToolInput` function in `gen-ui/utils.ts`. Update Key Design Decisions #3 to mandate its use:

```typescript
// gen-ui/utils.ts
export function parseToolInput<T>(toolCall: ToolCallState): T | null {
  if (toolCall.status !== 'complete') return null;
  try {
    return JSON.parse(toolCall.input) as T;
  } catch {
    return null;
  }
}
```

### 4.2 Add Tauri-specific optimizations

In Phase 2, consider Tauri's `invoke` for native file dialogs in `FileTreeDisplay`. Add `useMemo` hooks in components to memoize heavy renders (e.g., diff calculations in `DiffSummaryDisplay`). Test with Tauri's dev tools for WebView memory usage.

### 4.3 Unify Phase 4 with Claude SDK

Instead of splitting model access in Phase 4 (Claude Agent SDK for chat, AI SDK `streamText` for `/api/generate`), consider wrapping the Claude Agent SDK's `query()` in the new endpoint to maintain consistency. Use the AI SDK's Anthropic provider only if `Output.object()` is strictly required, and adapt events to match the existing pipeline (Deep Dive Pattern B).

### 4.4 Enhance security

Add an optional sanitizer param to `GenUIRenderer` type in `registry.ts`. For MCP tools, require Zod validation of output before rendering to prevent injection attacks.

### 4.5 Flesh out Phase 4 schemas

Define at least one concrete schema in the plan before implementation begins:

```typescript
const codeReviewSchema = z.object({
  summary: z.string(),
  issues: z.array(z.object({
    file: z.string(),
    severity: z.enum(['low', 'high']),
    description: z.string(),
  })),
});
```

Route via discriminated union as per Key Design Decisions #4.

### 4.6 Fill testing gaps

Add e2e tests using Tauri's test harness for Phase 3 manual flows. Include accessibility tests with `@testing-library/react` (e.g., `screen.getByRole('treeitem')` for `FileTreeDisplay`).

---

## 5. VERDICT

**Needs revision before implementation.**

The plan is strong on core concepts and alignment with the research — the registry pattern, phased rollout, and lifecycle-aware components are all well-considered. However, it has critical gaps in:

1. **Tauri-specific handling** — performance, native APIs, WebView constraints
2. **Security** — no output sanitization strategy for MCP/tool data
3. **Phase 4 architecture** — split model usage (Agent SDK vs AI SDK `streamText`) needs resolution
4. **Input parsing** — decentralized, unenforced; needs a shared utility

**Revised recommendation:** Phases 1-3 are ready to implement once a shared `parseToolInput` utility and basic output sanitization are added to the acceptance criteria. Hold Phase 4 implementation until concrete schemas are designed and the split-architecture concern is resolved.
