# Feature Plan: Generative UI

**Status:** Planning
**Created:** 2026-03-16
**Related Research:** `docs/research/generative-ui-landscape.md`, `docs/investigations/generative-ui-ai-sdk-deep-dive.md`

---

## Feature Description

Extend the chat interface to render rich, purpose-built React components for Claude's tool results and structured outputs, instead of generic collapsible JSON blocks. The end result is a "Claude Code Studio" feel: tool outputs look like professional IDE widgets, not debug logs.

**What changes for users:**
- Tool results show as context-aware visual components (file trees, diff viewers, data tables, progress indicators, charts)
- The chat doesn't look like a terminal — it looks like a GUI application
- New slash commands can trigger structured generation (e.g., `/dashboard`, `/report`)
- Custom MCP tools can register their own rendering components

**What does NOT change:**
- The core streaming pipeline (Claude Agent SDK → event mapper → data channel → useStreamEvents)
- The `useChat` + `useStreamEvents` hook architecture
- Authentication, session management, workspace flow

---

## Architecture Proposal

### How It Fits Together

The generative UI system sits entirely on the **frontend rendering layer**. The backend (chat.ts, claude.ts, event-mapper.ts) does not need to change for Phase 1-3. The streaming pipeline already delivers all the data needed.

```
                    Existing Pipeline
                    ─────────────────
Claude Agent SDK
  │
  ▼ StreamEvent (block:start, tool-input:delta, tool:result, etc.)
mapSdkEvent()
  │
  ▼ StreamEvent
chat.ts (data-stream-event writer)
  │
  ▼ SSE stream
useChat (onData) → useStreamEvents
  │
  ▼ ToolCallState Map
ToolCallBlock  ◄────────── NEW: GenUIRegistry lookup
  │
  ├─ FileReadDisplay
  ├─ BashDisplay
  ├─ FileEditDisplay
  └─ NEW: ChartDisplay, TableDisplay, DiffSummary, etc.
```

### Key Design Decisions

1. **Registry over switch/case** — Replace the hard-coded `if (toolCall.name === 'X')` chains with a `Map<string, GenUIRenderer>`. This allows dynamic registration from plugins or MCP tool configurations.

2. **Lifecycle-aware components** — Each renderer receives the full `ToolCallState` including `status` ('running' | 'complete' | 'error'). Components should render skeleton/loading states while running and full content when complete.

3. **Input parsing is per-component** — Each display component owns its own input parsing logic. The registry passes raw `ToolCallState`; components parse `toolCall.input` (a JSON string) as needed.

4. **No new backend endpoints required** for Phase 1-3. Phase 4 adds a `/api/generate` endpoint for `useObject`-based structured generation.

---

## Acceptance Criteria

The feature is done when:

- [ ] `ToolCallBlock` uses a registry-based lookup instead of hard-coded if/switch chains
- [ ] The registry supports runtime registration of new tool-name → renderer mappings
- [ ] All existing tool displays (BashDisplay, FileReadDisplay, etc.) are registered in the registry
- [ ] At least 3 new rich display components exist and are registered
- [ ] Each display component handles all 3 `ToolCallState.status` values (running, complete, error)
- [ ] No existing behavior is broken — all current displays still work
- [ ] All new components have tests (React Testing Library)
- [ ] The registry is exported so future code can register additional renderers
- [ ] TypeScript types are clean — no `any` casts in new code
- [ ] All new components tested in both Vite dev server AND Tauri shell
- [ ] No CSP violations in Tauri shell (check DevTools console)

---

## Phased Implementation Checklist

### Phase 1: Foundation — Tool → Component Registry

Goal: Refactor `ToolCallBlock` to use a registry. Zero user-visible change.

- [ ] Create `apps/desktop/src/components/chat/gen-ui/registry.ts`
  - Export `type GenUIRenderer = (toolCall: ToolCallState) => React.ReactNode`
  - Export `const toolRendererRegistry = new Map<string, GenUIRenderer>()`
  - Export `registerToolRenderer(name: string, renderer: GenUIRenderer): void`
  - Export `getToolRenderer(name: string): GenUIRenderer | undefined`
- [ ] Create `apps/desktop/src/components/chat/gen-ui/defaultRenderers.ts`
  - Import all existing display components
  - Register each with `registerToolRenderer()`
  - This file is imported once at app startup
- [ ] Refactor `ToolCallBlock.tsx`
  - Replace all `if (toolCall.name === 'X')` chains with `getToolRenderer(toolCall.name)`
  - Fall back to the existing generic block for unregistered tools
  - Export the registry so tests can inspect registrations
- [ ] Write tests for the registry module
  - Register a mock renderer, verify lookup
  - Verify unregistered names return undefined
  - Verify fallback behavior in ToolCallBlock
- [ ] Run `pnpm test` — all tests must pass

**Files to create:**
- `apps/desktop/src/components/chat/gen-ui/registry.ts`
- `apps/desktop/src/components/chat/gen-ui/defaultRenderers.ts`
- `apps/desktop/src/components/chat/gen-ui/registry.test.ts`

**Files to modify:**
- `apps/desktop/src/components/chat/ToolCallBlock.tsx` (refactor routing)

### Phase 2: Core Visual Components

Goal: Add 3-5 new purpose-built display components that make tool results look great.

Each component must:
- Accept `toolCall: ToolCallState`
- Handle `status === 'running'` with a skeleton/spinner
- Handle `status === 'complete'` with the full visualization
- Handle `status === 'error'` with an error state
- Have a `*.test.tsx` file testing all three states

**New components to build:**

- [ ] **DiffSummaryDisplay** — for the `Edit` tool, show a compact inline diff summary
  - Input: `toolCall.input` contains `{ file_path, old_string, new_string }`
  - Running: "Editing `filename`..."
  - Complete: Show lines changed, +/- count, collapsible full diff
  - Files: `gen-ui/DiffSummaryDisplay.tsx`, `gen-ui/DiffSummaryDisplay.test.tsx`

- [ ] **FileTreeDisplay** — for file listing operations (Glob tool)
  - Input: `toolCall.result` contains array of file paths
  - Running: "Scanning directory..."
  - Complete: Tree-style file listing with icons
  - Files: `gen-ui/FileTreeDisplay.tsx`, `gen-ui/FileTreeDisplay.test.tsx`

- [ ] **SearchResultsDisplay** — for Grep tool with match highlighting
  - Input: `toolCall.result` contains matches with file, line, content
  - Running: "Searching..."
  - Complete: Grouped by file, line numbers, highlighted match text
  - Files: `gen-ui/SearchResultsDisplay.tsx`, `gen-ui/SearchResultsDisplay.test.tsx`

- [ ] **DataTableDisplay** — for structured tabular data
  - Input: `toolCall.result` is a JSON array of objects
  - Running: Skeleton rows
  - Complete: Sortable table with column auto-detection
  - Files: `gen-ui/DataTableDisplay.tsx`, `gen-ui/DataTableDisplay.test.tsx`

- [ ] **ProgressTracker** — for long Bash commands
  - Input: `toolCall.input` has command; `toolCall.elapsedSeconds` provides timing
  - Running: Animated progress bar with elapsed time and command
  - Complete: Duration, exit code, output (collapsible)
  - Files: `gen-ui/ProgressTracker.tsx`, `gen-ui/ProgressTracker.test.tsx`

**Register all new components in `defaultRenderers.ts`**

### Phase 3: Integration with Existing Chat Flow

Goal: Wire the new components into the live app, verify end-to-end, polish.

- [ ] Import `defaultRenderers.ts` in the app entry point (or in `ChatPage.tsx`)
  - This triggers all `registerToolRenderer()` calls at startup
- [ ] Manual testing with Chrome browser tool:
  - Start a chat, ask Claude to read a file → verify FileReadDisplay still works
  - Ask Claude to edit a file → verify DiffSummaryDisplay renders
  - Ask Claude to grep for something → verify SearchResultsDisplay renders
  - Ask Claude to run a long command → verify ProgressTracker shows elapsed time
- [ ] Check console for errors — zero allowed
- [ ] Fix any visual issues found during manual testing
- [ ] Update `docs/logs/engineering-log.md` with what was found and fixed

**Files to modify:**
- `apps/desktop/src/components/chat/ChatPage.tsx` (or app entry) — add registry initialization import

### Phase 4: Structured Output (useObject Endpoint)

Goal: Add a separate structured generation endpoint for non-chat generative UI (dashboards, reports, forms).

- [ ] Design the schema format — what structured outputs make sense for a Claude Code desktop app?
  - Candidates: code review summary, project health report, file operation plan
- [ ] Add `/api/generate` route to Hono server
  - Uses `streamText` with `Output.object()` from AI SDK
  - Accepts `{ type: string, prompt: string }` in request body
  - Routes to appropriate schema based on `type`
- [ ] Add at least one `useObject`-based component in the frontend
  - `CodeReviewSummary` — asks Claude to analyze files and return structured review
  - Or `ProjectHealthReport` — returns structured workspace health info
- [ ] Add a slash command trigger (e.g., `/review`) in `ChatInput`
  - Command opens a panel that calls the `/api/generate` endpoint
  - Result renders as the structured component
- [ ] Tests:
  - Backend: bun test for the new route (mock LLM output)
  - Frontend: vitest for the new component (mock `useObject` response)
- [ ] Manual curl test of `/api/generate`
- [ ] Manual browser test of the slash command flow

**Files to create:**
- `apps/server/src/routes/generate.ts` (new route)
- `apps/desktop/src/components/gen-ui/CodeReviewSummary.tsx`
- `apps/server/src/routes/generate.test.ts`

**Files to modify:**
- `apps/server/src/index.ts` (register new route)
- `apps/desktop/src/components/chat/ChatInput.tsx` (add slash command)

---

## Key Design Decisions to Make

### 1. Registry initialization timing

**Question:** Where should `defaultRenderers.ts` be imported to ensure registration runs before any components render?

**Options:**
- Import in `main.tsx` (app entry point) — guaranteed early, but couples chat concerns to app shell
- Import in `ChatPage.tsx` — closer to where it's used, runs before chat renders
- Import lazily in `ToolCallBlock.tsx` — simplest, but makes the registry an implicit side effect

**Recommendation:** Import in `ChatPage.tsx`. It's the natural owner of the chat feature.

### 2. How to handle unknown tool names

**Question:** When the Claude Agent SDK introduces a new tool (or a user adds an MCP tool), what should render if there's no registered renderer?

**Options:**
- Show nothing (bad — hides information)
- Show the existing generic `ToolCallBlock` (current behavior — safe fallback)
- Show a "debug" block that dumps raw JSON (useful for development)

**Recommendation:** Default to the existing generic block. Add a dev-mode flag that shows raw JSON.

### 3. Streaming-during-input handling

**Question:** When `status === 'running'` and `toolCall.input` is still being streamed (partial JSON), how should components handle malformed JSON?

**Current behavior:** `ToolCallBlock` shows partial JSON strings as-is.

**Recommendation:** All display components should wrap input parsing in try/catch. Show skeleton during `status === 'running'`; only parse input when status is `'complete'` or `'error'`.

### 4. Phase 4 schema design

**Question:** Should the structured output endpoint use a single generic schema or tool-specific schemas?

**Recommendation:** Use a discriminated union with a `type` field routing to type-specific schemas:
```typescript
const schemas = {
  'code-review': codeReviewSchema,
  'project-health': projectHealthSchema,
};
```

---

## Tauri/WebView Considerations

This feature runs inside a Tauri v2 WebView, not a browser. The following constraints and opportunities apply:

### Performance Constraints
- **WebView memory is shared** — generative UI components should avoid heavy DOM mutations or large canvas operations during streaming. Prefer CSS transitions over JS animations.
- **No virtual scrolling library needed** for typical tool output volumes, but component lists exceeding ~100 items should use windowing (`@tanstack/react-virtual` already available or easy to add).
- **React 19 concurrent features work** inside Tauri WebView — `useTransition` and `startTransition` can be used to defer non-urgent renders during streaming.

### Native Integration Opportunities
- **File system access** — tool outputs that are file paths can open native file dialogs or reveal files in Finder/Explorer via `@tauri-apps/plugin-shell` or `@tauri-apps/plugin-opener`. The `FileReadDisplay` component already exists as a model.
- **Clipboard** — code block components can use Tauri's clipboard API (`@tauri-apps/plugin-clipboard-manager`) for copy-to-clipboard, avoiding the web `navigator.clipboard` API which may behave differently in WebView.
- **Window management** — image or chart components can potentially open in a new Tauri window for a "pop out" view.

### Security Model
- Tauri's CSP (Content Security Policy) is configured in `tauri.conf.json`. Any generative UI component that loads external resources (images from URLs, iframes) must be compatible with the CSP. Do NOT loosen the CSP — instead, proxy external resources through the Hono sidecar if needed.
- The `sanitizeToolOutput` utility (see Issue #[sanitization issue]) must validate URLs against the CSP-allowed origins before rendering as `<img>` or `<a>` tags.
- `dangerouslySetInnerHTML` is strictly prohibited in all generative UI components.

### Testing in Tauri vs Browser
- Run Chrome browser tool tests at `http://localhost:1420` (Vite dev server) during development — this catches most issues.
- Before any merge, test inside the actual Tauri shell (`pnpm tauri dev`) to catch WebView-specific rendering differences.
- Known WebView quirk: CSS `backdrop-filter` and some `filter` values may render differently — test glassmorphism or blur effects in-shell.

---

## Files to Create

```
apps/desktop/src/components/chat/gen-ui/
├── registry.ts                  # Registry module
├── registry.test.ts             # Registry tests
├── defaultRenderers.ts          # Registers all built-in renderers
├── DiffSummaryDisplay.tsx       # Phase 2
├── DiffSummaryDisplay.test.tsx  # Phase 2
├── FileTreeDisplay.tsx          # Phase 2
├── FileTreeDisplay.test.tsx     # Phase 2
├── SearchResultsDisplay.tsx     # Phase 2
├── SearchResultsDisplay.test.tsx # Phase 2
├── DataTableDisplay.tsx         # Phase 2
├── DataTableDisplay.test.tsx    # Phase 2
└── ProgressTracker.tsx          # Phase 2
└── ProgressTracker.test.tsx     # Phase 2

apps/server/src/routes/
└── generate.ts                  # Phase 4
└── generate.test.ts             # Phase 4

apps/desktop/src/components/gen-ui/
└── CodeReviewSummary.tsx        # Phase 4
```

## Files to Modify

```
apps/desktop/src/components/chat/ToolCallBlock.tsx      # Phase 1: registry lookup
apps/desktop/src/components/chat/ChatPage.tsx           # Phase 3: registry init
apps/server/src/index.ts                                 # Phase 4: register route
apps/desktop/src/components/chat/ChatInput.tsx          # Phase 4: slash command
```

---

## Dependencies

No new npm packages required for Phase 1-3. All UI is built from existing primitives (Tailwind, lucide-react, existing components).

Phase 4 may require nothing additional if a chart/table library is deferred to a later phase. If charts are needed: consider `recharts` (already popular in shadcn ecosystems) or `@observablehq/plot` (lightweight).

---

## Testing Requirements

Per project policy (CLAUDE.md §5):

- **TDD**: Write tests before implementing each component
- **Backend (Phase 4)**: `bun test` for the generate route
- **Frontend**: `vitest` + React Testing Library for all new components
- **Manual (Phase 3)**: Chrome browser tool to verify all tool types render correctly
- **Manual (Phase 4)**: `curl` test of `/api/generate` before frontend integration

---

## Definition of Done

This feature is complete when:
1. All checklist items above are checked
2. `pnpm test` passes with no failures
3. Manual browser testing confirms all Phase 1-3 components render correctly in a live chat
4. No console errors during normal operation
5. Engineering log updated with any issues found and fixed
