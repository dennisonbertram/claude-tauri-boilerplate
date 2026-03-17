# Generative UI + AI SDK: Deep Dive

Deep technical investigation into the AI SDK APIs relevant to generative UI, their integration patterns with the Claude Agent SDK, and what works in this project's Vite/Tauri environment.

---

## Summary

This project already has a functional tool-result-to-component rendering system. The Claude Agent SDK streams events (`block:start`, `tool-input:delta`, `tool:result`) that are processed by `useStreamEvents` and rendered via `ToolCallBlock`. The question is how to extend this into richer generative UI while staying compatible with the existing architecture.

The AI SDK offers three relevant primitives:
1. **Tool parts via `useChat`** — native to AI SDK's own `streamText`, requires adapting the data channel
2. **`experimental_useObject`** — for streaming a complete JSON object for structured rendering
3. **`createUIMessageStream` data parts** — for attaching custom structured data to messages

---

## AI SDK Version in This Project

```
ai: ^6.0.116          # Server + client shared
@ai-sdk/react: ^3.0.118  # React hooks
```

The server uses `createUIMessageStream` and `createUIMessageStreamResponse`. The client uses `useChat` from `@ai-sdk/react`.

---

## 1. Tool Parts via useChat (AI SDK's Native Generative UI)

### How It Works

When a backend uses `streamText` with `tools`, the AI SDK automatically includes tool invocation data in the UI message stream. Each tool call appears as a typed `UIMessagePart` in `message.parts`.

**Part naming convention:** `tool-${toolName}` (e.g., `tool-getWeather`, `tool-displayChart`)

**Tool part states:**
| State | Meaning |
|-------|---------|
| `input-streaming` | Model is generating the tool's input JSON |
| `input-available` | Input complete, tool executing |
| `output-available` | Tool executed, result available |
| `output-error` | Tool execution failed |
| `approval-requested` | Tool requires user approval before executing |

### Server-Side Setup

```typescript
import { streamText, createTool } from 'ai';
import { z } from 'zod';

const displayWeatherTool = createTool({
  description: 'Display a weather card for a location',
  inputSchema: z.object({
    location: z.string(),
    unit: z.enum(['celsius', 'fahrenheit']).default('fahrenheit'),
  }),
  execute: async ({ location, unit }) => {
    // Fetch weather data...
    return {
      location,
      temperature: 72,
      condition: 'Sunny',
      humidity: 45,
      unit,
    };
  },
});

// In your Hono route:
app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    tools: { displayWeather: displayWeatherTool },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
});
```

### Client-Side Rendering

```tsx
import { useChat } from '@ai-sdk/react';

function MessageRenderer({ message }: { message: UIMessage }) {
  return (
    <div>
      {message.parts.map((part, i) => {
        // Text content
        if (part.type === 'text') {
          return <MarkdownRenderer key={i} content={part.text} />;
        }

        // Weather tool
        if (part.type === 'tool-displayWeather') {
          switch (part.state) {
            case 'input-streaming':
              return <WeatherSkeleton key={part.toolCallId} />;
            case 'input-available':
              return <WeatherLoading key={part.toolCallId} location={part.input.location} />;
            case 'output-available':
              return <WeatherCard key={part.toolCallId} {...part.output} />;
            case 'output-error':
              return <ErrorDisplay key={part.toolCallId} message={part.errorText} />;
          }
        }

        return null;
      })}
    </div>
  );
}
```

### Type Safety with InferUITools

```typescript
import { InferUITools, ToolSet } from 'ai';

// Define your tool set
const tools = { displayWeather: displayWeatherTool } satisfies ToolSet;

// Infer typed parts
type AppUIMessage = InferUITools<typeof tools>;

// Now TypeScript knows part.type === 'tool-displayWeather' has typed input/output
```

### Limitation for This Project

**This project does NOT use `streamText` from the AI SDK.** It uses `@anthropic-ai/claude-agent-sdk`'s `query()` function, which manages tool calling internally. The Claude Agent SDK runs Claude Code's built-in tools (Bash, Read, Edit, etc.) and emits custom events. These do not flow through the AI SDK's tool parts mechanism.

The existing architecture routes Claude SDK events through a custom data channel using `(writer as any).write({ type: 'data-stream-event', data: event })`. These appear in `useChat`'s `onData` callback and are consumed by `useStreamEvents`, which maintains a separate `Map<string, ToolCallState>`.

**The tool parts mechanism is only applicable if we add our own `streamText`-backed tools alongside the Claude Agent SDK stream**, or if we adapt the data channel to emit tool-part-compatible data.

---

## 2. experimental_useObject — Streaming Structured JSON

### Overview

`experimental_useObject` is ideal for scenarios where you want Claude to generate a structured JSON payload that drives a UI component — like a dashboard layout, a data visualization config, or a report structure.

It does not modify the main chat flow. It's a separate hook for a dedicated endpoint.

### Server-Side (Hono compatible)

```typescript
import { streamText, Output } from 'ai';
import { z } from 'zod';

const dashboardSchema = z.object({
  title: z.string(),
  widgets: z.array(z.object({
    type: z.enum(['metric', 'chart', 'table', 'text']),
    title: z.string(),
    data: z.unknown(),
  })),
});

// Hono route
app.post('/api/generate-dashboard', async (c) => {
  const { prompt } = await c.req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    output: Output.object({ schema: dashboardSchema }),
    prompt: `Generate a dashboard for: ${prompt}`,
  });

  return result.toTextStreamResponse(); // or toUIMessageStreamResponse()
});
```

### Client-Side

```tsx
import { experimental_useObject as useObject } from '@ai-sdk/react';

function DashboardGenerator() {
  const { object, submit, isLoading } = useObject({
    api: '/api/generate-dashboard',
    schema: dashboardSchema,
  });

  return (
    <div>
      <button onClick={() => submit({ prompt: 'show sales metrics' })}>
        Generate
      </button>

      {isLoading && <Spinner />}

      {object && (
        <Dashboard
          title={object.title ?? 'Loading...'}
          widgets={object.widgets ?? []}
        />
      )}
    </div>
  );
}
```

**Key behaviors:**
- `object` is `DeepPartial<Schema>` — all fields are nullable until streaming completes
- Components must handle undefined/null gracefully during generation
- `onFinish` callback receives the complete, validated object
- `stop()` cancels the request mid-stream
- `clear()` resets state

### When to Use

Use `useObject` for:
- "Generate me a report on X" → render a structured report layout
- "Create a dashboard for Y" → render configurable widget grid
- "Design a form for Z" → render a dynamic form from schema
- Any "generate a complete structure" pattern distinct from chat

### Incompatibility Note

`Output.object()` is a feature of `streamText` from the AI SDK. It cannot be applied to `@anthropic-ai/claude-agent-sdk`'s `query()` directly. For Claude SDK usage, you would need a separate endpoint that calls `streamText` with an Anthropic model via the AI SDK (not the Agent SDK).

---

## 3. createUIMessageStream — Custom Data Parts

### Overview

This is the mechanism already used in `apps/server/src/routes/chat.ts`. The project writes custom `data-stream-event` parts onto the stream, which flow to the client's `useChat` `onData` callback and are consumed by `useStreamEvents`.

### Current Usage (from chat.ts)

```typescript
// Existing: writing custom stream events
(writer as any).write({ type: 'data-stream-event', data: event });
```

The `(writer as any)` cast is needed because `data-stream-event` is a custom type not in the AI SDK's type definitions.

### Native Data Parts (AI SDK v6)

AI SDK v6 supports first-class data parts via `DataUIPart`. These appear in `message.parts` with a `data-${name}` type prefix:

```typescript
// Server: write a data part
writer.write({
  type: 'data-toolResult',  // custom data part name
  data: {
    toolName: 'Bash',
    input: { command: 'ls -la' },
    output: '...',
    durationMs: 234,
  },
});
```

```typescript
// Client: access in message.parts
message.parts.forEach(part => {
  if (part.type === 'data-toolResult') {
    return <RichToolDisplay data={part.data} />;
  }
});
```

**Transient parts** are sent to the client but not persisted to message history. They are only accessible via the `onData` callback:

```typescript
// Server: write transient notification
writer.write({
  type: 'data-progress',
  data: { step: 'reading files', percent: 45 },
  transient: true,  // not added to message history
});
```

### Data Part Reconciliation

Writing two data parts with the same ID merges/updates them:

```typescript
// Initial write
writer.write({ type: 'data-artifact', id: 'art-1', data: { status: 'generating' } });

// Later update
writer.write({ type: 'data-artifact', id: 'art-1', data: { status: 'complete', url: '...' } });
```

This enables progressive UI states without duplicate parts accumulating.

---

## 4. How Claude Agent SDK Tools Map to Generative UI Components

### Current Event Pipeline

```
Claude Agent SDK query()
  → mapSdkEvent() in apps/server/src/services/event-mapper.ts
  → chat.ts: writer.write({ type: 'data-stream-event', data: mappedEvent })
  → useChat onData callback
  → useStreamEvents.onData()
  → streamEventsReducer processes event
  → ToolCallState Map updated
  → ToolCallBlock routes to display component
```

### Event Types That Drive Components

From `packages/shared/src/types.ts`, the relevant events:

| Event | When Fired | Current UI |
|-------|-----------|-----------|
| `block:start` with `blockType: 'tool_use'` | Tool call begins | ToolCallBlock created (status: running) |
| `tool-input:delta` | Tool input JSON streaming | ToolCallBlock shows partial JSON |
| `tool:result` | Tool finished | ToolCallBlock updated (status: complete) |
| `tool:progress` | Long-running tool progress | ToolCallBlock shows elapsed time |
| `tool:summary` | Tool summary string | ToolCallBlock collapsed view |

### Proposed Extension: Tool Name → Component Registry

The `ToolCallBlock` component already has a routing pattern:

```typescript
// Current manual routing in ToolCallBlock.tsx
if (toolCall.name === 'Read') return <FileReadDisplay toolCall={toolCall} />;
if (toolCall.name === 'Edit') return <FileEditDisplay toolCall={toolCall} />;
if (toolCall.name === 'Bash') return <BashDisplay {...} />;
```

This can be made data-driven with a registry:

```typescript
// Proposed: GenUIRegistry
type GenUIRenderer = (toolCall: ToolCallState) => React.ReactNode;

const TOOL_RENDERER_REGISTRY = new Map<string, GenUIRenderer>([
  ['Read', (tc) => <FileReadDisplay toolCall={tc} />],
  ['Edit', (tc) => <FileEditDisplay toolCall={tc} />],
  ['Write', (tc) => <FileWriteDisplay toolCall={tc} />],
  ['Bash', (tc) => <BashDisplay {...parseBashInput(tc)} />],
  ['Grep', (tc) => <GrepDisplay toolCall={tc} />],
  ['Glob', (tc) => <GlobDisplay toolCall={tc} />],
  // New registrations for generative UI:
  ['chart', (tc) => <ChartDisplay toolCall={tc} />],
  ['table', (tc) => <TableDisplay toolCall={tc} />],
  ['weather', (tc) => <WeatherCard toolCall={tc} />],
]);

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const renderer = TOOL_RENDERER_REGISTRY.get(toolCall.name);
  if (renderer) return <>{renderer(toolCall)}</>;
  return <GenericToolBlock toolCall={toolCall} />;
}
```

### Custom MCP Tools as Generative UI

The Claude Agent SDK supports MCP (Model Context Protocol) tools. You can define custom MCP tools that return structured data, then register a renderer for them. This is the most powerful extension point: define a tool that returns, say, a chart specification, then render it with a charting library.

```typescript
// In Claude Agent SDK configuration (hypothetical MCP tool)
// Tool name: "generate_chart"
// Returns: { type: 'bar', data: [...], title: '...' }

// Frontend: register renderer
TOOL_RENDERER_REGISTRY.set('generate_chart', (toolCall) => {
  if (toolCall.status !== 'complete') return <ChartSkeleton />;
  const chartSpec = JSON.parse(toolCall.result as string);
  return <ChartRenderer spec={chartSpec} />;
});
```

---

## 5. streamUI — RSC Approach (Not Applicable)

`streamUI` from `ai/rsc` requires:
- React Server Components (Next.js App Router)
- Server Actions (`'use server'` directive)
- Next.js runtime

**This is incompatible with this project** (Vite, Tauri, Hono). Additionally, AI SDK RSC development is paused and Vercel recommends the tool parts approach instead.

```typescript
// This DOES NOT work in this project:
import { streamUI } from 'ai/rsc';  // RSC-only

// Instead, use this approach with Hono/Bun:
import { createUIMessageStream } from 'ai';  // Works everywhere
```

---

## 6. Limitations by Environment

| Feature | Next.js App Router | Vite + React 19 | This Project (Tauri/Vite/Hono) |
|---------|-------------------|-----------------|-------------------------------|
| `streamUI` (RSC) | Yes | No | No |
| Tool parts via `useChat` | Yes | Yes | Partial (see note) |
| `experimental_useObject` | Yes | Yes | Yes (separate endpoint) |
| `createUIMessageStream` | Yes | Yes | Yes (already in use) |
| Data parts in `message.parts` | Yes | Yes | Partial (custom cast) |
| Client-side tool execution | Yes | Yes | Yes |

**Note on tool parts:** The AI SDK's tool parts mechanism works natively when using `streamText` on the server. This project uses `@anthropic-ai/claude-agent-sdk`'s `query()` function instead. To get tool parts in `message.parts`, you would need to either:
1. Add a separate `streamText`-backed tool layer alongside the Claude SDK
2. Adapt the chat route to write tool parts via `writer.write({ type: 'tool-...' })` manually

---

## 7. Practical Patterns for This Project

### Pattern A: Rich Tool Display (Extend Existing — Recommended)

No architectural change required. Add new tool names to `ToolCallBlock`'s routing. New tool results render as rich components instead of raw JSON.

**Use for:** Visualizing Claude's existing tool results (file trees, code diffs, search results, data summaries).

### Pattern B: Structured Output via useObject (New Endpoint)

Add a `/api/generate` endpoint using `streamText` with `Output.object()`. The frontend calls it separately for structured content generation.

**Use for:** Dashboard generation, report templates, form schemas, content plans.

### Pattern C: Data Parts for UI Hints (Protocol Extension)

Extend the existing event mapper to emit `data-artifact` or `data-chart-spec` parts alongside regular text. These appear in `message.parts` and can render specialized components inline in the conversation.

**Use for:** Inline data visualizations triggered by Claude's output, file operation summaries as collapsible cards.

### Pattern D: MCP-backed Generative Tools (Future)

Define custom MCP tools that Claude can call to "render" content. When Claude wants to show a visualization, it calls `mcp_render_chart` with a data spec. The frontend registers a renderer for that tool name.

**Use for:** True generative UI — let Claude decide when to render rich components, not just when to call system tools.

---

## References

- [AI SDK UI: Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- [AI SDK UI: Chatbot Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
- [AI SDK UI: useObject](https://ai-sdk.dev/docs/ai-sdk-ui/object-generation)
- [AI SDK UI: createUIMessageStream](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream)
- [AI SDK UI: Streaming Custom Data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
- [AI SDK Core: UIMessage](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message)
- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6)
- [Vercel Academy: Multi-Step & Generative UI](https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui)
