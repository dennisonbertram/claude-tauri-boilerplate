# Generative UI Landscape

Research into generative UI approaches, tools, and trade-offs for the claude-tauri-boilerplate stack.

---

## What is Generative UI?

Generative UI is the practice of having a large language model decide not only *what to say*, but *what interface to render*. Instead of returning markdown text, the AI selects from a vocabulary of UI components and drives their content dynamically.

The core mental model is: **LLM as a dynamic router**. The model understands user intent and calls one of several pre-defined "tools," each of which maps to a React component. The tool result becomes the component's data.

This is distinct from:
- **Text-to-code** (generating code that is then compiled or executed)
- **Low-code builders** (drag-and-drop with AI assist)
- **Template filling** (AI populates a fixed layout)

Generative UI treats the UI layer itself as a structured output format.

---

## Core Approaches

There are five distinct approaches in the wild today, ranging from fully constrained to fully dynamic.

### Approach 1: RSC streamUI (Vercel AI SDK 3.x)

The original Vercel generative UI approach introduced in AI SDK 3.0. The model calls server-side tools whose `generate` function yields React Server Components (RSCs). Components stream from the server to the client as serialized React elements.

**How it works:**
1. Define tools with a `generate` async generator function
2. Each tool returns JSX (React Server Components)
3. `streamUI()` serializes the JSX and sends it over the wire
4. Client receives live component trees without client-side JS for each component

**Status:** Development is **currently paused**. Vercel recommends migrating to AI SDK UI (`useChat` + tool parts) for production. The RSC approach required Next.js with React Server Components, which is unavailable in Vite-based environments.

**Verdict for this project:** Not viable. Requires Next.js. Development paused.

### Approach 2: AI SDK UI — Tool Parts + useChat (Current Stable)

This is the **currently recommended** generative UI approach in AI SDK 5.x/6.x. It works without RSC and is fully compatible with Vite/React.

**How it works:**
1. Define tools server-side using `createTool()` or `tool()`
2. The model calls tools; results appear in `message.parts` array as typed parts
3. Each part has a type like `tool-displayWeather`
4. The client renders the appropriate component based on `part.type` and `part.state`
5. Tool states: `input-streaming` → `input-available` → `output-available` / `output-error`

```typescript
// Server-side: define a tool
export const weatherTool = createTool({
  description: 'Display the weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The location to get the weather for'),
  }),
  execute: async ({ location }) => {
    return { weather: 'Sunny', temperature: 75, location };
  },
});

// Client-side: render based on part type
{message.parts.map(part => {
  if (part.type === 'tool-displayWeather') {
    switch (part.state) {
      case 'input-available':
        return <WeatherSkeleton key={part.toolCallId} />;
      case 'output-available':
        return <WeatherCard key={part.toolCallId} {...part.output} />;
    }
  }
})}
```

**Verdict for this project:** This is the right approach for standard generative UI with the AI SDK directly. However, this project uses the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) as the AI layer, not `streamText`. The Claude SDK manages its own tool loop internally and streams events over a custom event protocol. This creates a mismatch with the AI SDK's tool parts system.

### Approach 3: useObject — Streaming Structured JSON

`experimental_useObject` streams a partial, validated JSON object from the server to the client as it generates. This is suitable when you want the model to produce a structured data payload that then drives component rendering — rather than having the model call a specific tool.

**How it works:**
1. Define a Zod schema for the desired JSON shape
2. Server uses `streamText` with `Output.object({ schema })` to generate JSON
3. Client uses `useObject({ api, schema })` to consume it
4. `object` property updates progressively as JSON arrives
5. Components render from the partial object, handling nulls gracefully

```typescript
// Server
import { streamText, Output } from 'ai';

const result = streamText({
  model: openai('gpt-4o'),
  output: Output.object({ schema: notificationSchema }),
  prompt: 'Generate a notification for...',
});

// Client
import { experimental_useObject as useObject } from '@ai-sdk/react';

const { object, submit, isLoading } = useObject({
  api: '/api/generate',
  schema: notificationSchema,
});

// Render partial object
return <NotificationCard data={object} />;
```

**Status:** Experimental. Works in React, Svelte, Vue (no RSC required). Suitable for Vite.

**Verdict for this project:** Useful for scenarios where you want Claude to generate structured content (dashboards, form schemas, report layouts). Less useful for the main chat flow since it requires a separate endpoint, not part of the streaming conversation.

### Approach 4: json-render (Vercel Labs)

json-render is an open-source framework from Vercel Labs that takes a catalog-driven approach. Developers define a catalog of permitted components, the LLM generates JSON constrained to that catalog, and json-render renders the result.

**How it works:**
1. Developer defines a catalog (which components and props are allowed)
2. The catalog schema is passed to the LLM as a constraint
3. LLM generates JSON matching the catalog structure
4. json-render renders components from the JSON, progressively as streaming arrives
5. The UI can be exported as standalone React code

```javascript
import { defineCatalog } from '@json-render/core';
import { z } from 'zod';

export const catalog = defineCatalog(schema, {
  components: {
    Card: {
      props: z.object({
        title: z.string(),
        description: z.string().nullable(),
      }),
      hasChildren: true,
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['primary', 'secondary']),
      }),
    },
  }
});
```

**Key features:**
- 39 pre-built components (Card, Button, Table, Graph variants, etc.)
- 6 action types for interactions
- React and React Native support from the same catalog
- Code export as standalone React (no runtime dependencies)
- Data binding via `$state`, `$item`, `$index` syntax
- Model- and framework-agnostic

**Packages:** `@json-render/core`, `@json-render/react`

**Status:** Open source, Vercel Labs project. Active as of early 2025.

**Community reaction:** Practical for "text to dashboard" use cases. Critics note it reinvents existing solutions; supporters note it adds safety constraints (prevents hallucination of non-existent components) that generic code generation lacks.

**Verdict for this project:** Compelling for dashboard/report generation use cases. The catalog approach is safe and predictable. The downside is it adds a new abstraction layer and requires structuring prompts around catalog constraints. Could be integrated as an optional rendering mode for specific interactions.

### Approach 5: Claude's show_widget Pattern (HTML Injection)

Claude.ai uses a `show_widget` tool that accepts raw HTML as a parameter. The HTML streams token-by-token as the model generates it, and morphdom patches the DOM incrementally.

**How it works:**
1. Claude calls `show_widget` with `widget_code` (HTML fragment), `title`, and `loading_messages`
2. Before generating the widget, Claude calls `visualize_read_me` to load relevant documentation (chart libraries, diagram tools, etc.) on demand
3. HTML is injected directly into the DOM (not an iframe)
4. Security via Content Security Policy (restricted CDN allow-list)
5. Scripts execute only after streaming completes

This pattern has been reverse-engineered and implemented for desktop apps using native WebView windows (WKWebView on macOS, WebView2 on Windows).

**Verdict for this project:** Powerful and flexible, but introduces significant security complexity (CSP management, script sandboxing). The `morphdom` progressive streaming approach is elegant for complex visualizations. A viable option for a "visualization mode" if security can be properly managed.

---

## Framework Comparison

| Approach | RSC Required | AI SDK Native | Works with Claude SDK | Security Risk | Streaming | Complexity |
|----------|-------------|---------------|----------------------|---------------|-----------|------------|
| streamUI (RSC) | Yes | Yes | No | Low | Native | High |
| Tool Parts + useChat | No | Yes | Partial | Low | Native | Medium |
| useObject | No | Yes | Via wrapper | Low | Native | Low |
| json-render | No | No | Yes | Low | Yes | Medium |
| show_widget HTML | No | No | Yes | High | Via morphdom | High |

---

## Trade-offs for a Desktop Tauri App

### What changes in a desktop context

1. **No network latency** — the Hono backend runs as a local sidecar. Streaming is over localhost, not the internet. This makes even heavy streaming approaches negligible in latency.

2. **Security model differs** — a desktop app can use a WebView (Tauri's webview) for sandboxed HTML rendering with stricter control than a browser. The show_widget HTML injection approach is more viable here because Tauri lets you configure CSP at the app level.

3. **No SSR/RSC** — Tauri uses Vite + React 19 on the client side. There is no server-side rendering, no Next.js, no React Server Components. Any approach requiring RSC is ruled out.

4. **The Claude Agent SDK manages the tool loop** — this project uses `@anthropic-ai/claude-agent-sdk`'s `query()` function, which handles multi-step tool execution internally. The AI SDK's `streamText` with `tools` is a parallel tool-calling abstraction. The project's architecture routes Claude Agent SDK events through a custom event protocol to the frontend, not through AI SDK tool calls directly.

### Best fit for this project's stack

The project's existing architecture already has a **de facto tool parts pattern** in the `ToolCallBlock` component. The `useStreamEvents` hook processes `block:start`, `tool-input:delta`, and `tool:result` events from the Claude Agent SDK and maintains a `Map<string, ToolCallState>`. `ToolCallBlock` then routes each `ToolCallState` to a specialized display component (BashDisplay, FileReadDisplay, etc.).

This is functionally equivalent to the AI SDK's tool parts pattern, just implemented manually using Claude Agent SDK events rather than AI SDK's built-in mechanism.

**Recommended approach: Extend the existing tool-result-to-component registry**

The most natural evolution for generative UI in this codebase is:
1. Keep the existing event pipeline (Claude SDK → event mapper → data channel → `useStreamEvents` → `ToolCallBlock`)
2. Extend the `ToolCallBlock` routing to handle new tool names with richer visual components
3. Add a `GenUIComponentRegistry` for registering tool name → React component mappings at startup
4. For structured data generation, add a separate `useObject`-based flow for dashboard/report scenarios

This approach requires zero architectural change to the streaming pipeline and builds directly on the existing codebase.

---

## Key Libraries to Know

| Library | Package | Purpose | Status |
|---------|---------|---------|--------|
| AI SDK UI | `ai`, `@ai-sdk/react` | useChat, tool parts, useObject | Stable |
| json-render | `@json-render/core`, `@json-render/react` | Catalog-driven JSON→UI | Active Labs |
| AI Elements | Vercel | Pre-built AI UI components (shadcn-based) | New (2025) |
| Hashbrown | `hashbrown` | Client-side tool calling framework | Active |
| morphdom | `morphdom` | DOM diffing for HTML streaming | Stable |

---

## Sources

- [AI SDK Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- [json-render.dev](https://json-render.dev/)
- [json-render GitHub](https://github.com/vercel-labs/json-render)
- [AI SDK RSC Streaming React Components](https://ai-sdk.dev/docs/ai-sdk-rsc/streaming-react-components)
- [Reverse-engineering Claude's generative UI](https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/)
- [Introducing AI SDK 3.0 with Generative UI](https://vercel.com/blog/ai-sdk-3-generative-ui)
- [AI SDK 6](https://vercel.com/blog/ai-sdk-6)
- [Hashbrown Framework](https://hashbrown.dev/)
