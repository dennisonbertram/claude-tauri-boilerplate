# Claude Agent SDK + Vercel AI SDK Integration Research

**Date:** 2026-03-14
**Context7 Sources:** `/anthropics/claude-code`, `/vercel/ai`, `/ben-vargas/ai-sdk-provider-claude-code`
**Official Docs:** `platform.claude.com/docs/en/agent-sdk`

---

## Critical Finding: Package Rename

The `@anthropic-ai/claude-code` npm package **has been renamed** to `@anthropic-ai/claude-agent-sdk`. The old package name is the legacy name. There is no `claude()` function — the primary API function is `query()`.

| Aspect | Old (Legacy) | New (Current) |
|:-------|:-------------|:--------------|
| TS Package | `@anthropic-ai/claude-code` | `@anthropic-ai/claude-agent-sdk` |
| Python Package | `claude-code-sdk` | `claude-agent-sdk` |
| TS Options Type | `ClaudeCodeOptions` | (Options is just `Options`) |
| Python Options Type | `ClaudeCodeOptions` | `ClaudeAgentOptions` |
| Primary function | same | `query()` |

The user's integration pattern uses `import { claude } from "@anthropic-ai/claude-code"` — there is no `claude()` export from this package. The correct function is `query()`.

---

## Part 1: `@anthropic-ai/claude-agent-sdk` (fka `@anthropic-ai/claude-code`)

### Installation

```bash
# New (current)
npm install @anthropic-ai/claude-agent-sdk

# Old (legacy, still works but deprecated branding)
npm install @anthropic-ai/claude-code
```

### Primary Function: `query()`

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
// OR (legacy import, still works)
import { query } from "@anthropic-ai/claude-code";

function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;
```

`query()` returns a `Query` object that extends `AsyncGenerator<SDKMessage, void>` — it is an async iterable of `SDKMessage` events.

### Basic Usage Pattern

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message);
}
```

### `Options` Object (Key Fields)

| Property | Type | Default | Description |
|:---------|:-----|:--------|:------------|
| `abortController` | `AbortController` | `new AbortController()` | For cancellation |
| `allowedTools` | `string[]` | `[]` | Tools to auto-approve (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, Agent, etc.) |
| `disallowedTools` | `string[]` | `[]` | Tools to always deny |
| `model` | `string` | Default from CLI | Claude model to use |
| `maxTurns` | `number` | `undefined` | Max agentic tool-use round trips |
| `systemPrompt` | `string \| { type: 'preset', preset: 'claude_code', append?: string }` | `undefined` (minimal) | System prompt. No longer defaults to Claude Code's prompt |
| `permissionMode` | `PermissionMode` | `'default'` | `'default'`, `'acceptEdits'`, `'bypassPermissions'`, `'plan'`, `'dontAsk'` |
| `settingSources` | `SettingSource[]` | `[]` (none) | Which filesystem settings to load. Now empty by default |
| `cwd` | `string` | `process.cwd()` | Working directory |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP server configs |
| `resume` | `string` | `undefined` | Session ID to resume |
| `sessionId` | `string` | Auto-generated | Explicit session UUID |
| `includePartialMessages` | `boolean` | `false` | Include partial streaming events |
| `effort` | `'low' \| 'medium' \| 'high' \| 'max'` | `'high'` | Reasoning depth |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | `{}` | Lifecycle hook callbacks |
| `agents` | `Record<string, AgentDefinition>` | `undefined` | Programmatic subagent definitions |
| `stderr` | `(data: string) => void` | `undefined` | Callback for stderr |
| `maxBudgetUsd` | `number` | `undefined` | Spending cap |

### `Query` Object Methods

The returned `Query` object (an async generator) also has these methods:

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  initializationResult(): Promise<SDKControlInitializeResponse>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  close(): void;
}
```

---

## Part 2: `SDKMessage` Event Types

`SDKMessage` is a union of all possible message types yielded by the async generator:

```typescript
type SDKMessage =
  | SDKAssistantMessage        // type: "assistant"
  | SDKUserMessage             // type: "user"
  | SDKUserMessageReplay       // type: "user", isReplay: true
  | SDKResultMessage           // type: "result"
  | SDKSystemMessage           // type: "system", subtype: "init"
  | SDKPartialAssistantMessage // type: "stream_event" (requires includePartialMessages: true)
  | SDKCompactBoundaryMessage  // type: "system", subtype: "compact_boundary"
  | SDKStatusMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKToolProgressMessage
  | SDKAuthStatusMessage
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKFilesPersistedEvent
  | SDKToolUseSummaryMessage
  | SDKRateLimitEvent
  | SDKPromptSuggestionMessage;
```

### Key Event Types in Detail

#### `SDKSystemMessage` — `type: "system"`, `subtype: "init"`

First message emitted. Use to get the session ID.

```typescript
type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  uuid: UUID;
  session_id: string;
  agents?: string[];
  apiKeySource: ApiKeySource;
  betas?: string[];
  claude_code_version: string;
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
  output_style: string;
  skills: string[];
  plugins: { name: string; path: string }[];
};
```

#### `SDKAssistantMessage` — `type: "assistant"`

The main response message. Contains the full Anthropic API `BetaMessage`.

```typescript
type SDKAssistantMessage = {
  type: "assistant";
  uuid: UUID;
  session_id: string;
  message: BetaMessage; // Full Anthropic API message object
  parent_tool_use_id: string | null; // Non-null when inside a subagent
  error?: SDKAssistantMessageError;
};
```

The `message.content` field is an array of content blocks:
- `{ type: "text", text: string }` — text response
- `{ type: "tool_use", id: string, name: string, input: object }` — tool call

`SDKAssistantMessageError` values: `'authentication_failed'`, `'billing_error'`, `'rate_limit'`, `'invalid_request'`, `'server_error'`, `'unknown'`.

#### `SDKResultMessage` — `type: "result"`

Final message, always the last event. Two subtypes:

```typescript
// Success
type SDKResultMessage = {
  type: "result";
  subtype: "success";
  uuid: UUID;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;        // Final text result
  stop_reason: string | null;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  permission_denials: SDKPermissionDenial[];
  structured_output?: unknown;
};

// Error subtypes
type SDKResultMessage = {
  type: "result";
  subtype:
    | "error_max_turns"
    | "error_during_execution"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  // ... same base fields minus result string
  errors: string[];
};
```

#### `SDKUserMessage` — `type: "user"`

Echoed user input messages. Also used for tool results fed back in the loop.

```typescript
type SDKUserMessage = {
  type: "user";
  uuid?: UUID;
  session_id: string;
  message: MessageParam; // Anthropic SDK MessageParam
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
};
```

#### `SDKPartialAssistantMessage` — `type: "stream_event"`

Only emitted when `includePartialMessages: true` in options. These are raw Anthropic streaming events (`BetaRawMessageStreamEvent`) — token-level deltas.

```typescript
type SDKPartialAssistantMessage = {
  type: "stream_event";
  event: BetaRawMessageStreamEvent;
  parent_tool_use_id: string | null;
  uuid: UUID;
  session_id: string;
};
```

### Typical Event Sequence

```
1. SDKSystemMessage (type: "system", subtype: "init")     ← session info
2. SDKAssistantMessage (type: "assistant")                ← thinking/planning
3. SDKUserMessage (type: "user", isSynthetic: true)       ← tool result echoed
4. SDKAssistantMessage (type: "assistant")                ← next response
5. ... (multiple turns)
6. SDKResultMessage (type: "result", subtype: "success")  ← always last
```

---

## Part 3: Correct Integration Pattern

The user's pattern uses `claude()` from `@anthropic-ai/claude-code`, which **does not exist**. The correct pattern uses `query()`:

```typescript
// INCORRECT (user's current pattern)
import { claude } from "@anthropic-ai/claude-code";
const stream = claude(lastMessage, { abortController: new AbortController() });

// CORRECT (updated)
import { query } from "@anthropic-ai/claude-agent-sdk";
// OR still works with old package name:
import { query } from "@anthropic-ai/claude-code";
const stream = query({
  prompt: lastMessage,
  options: { abortController: new AbortController() }
});
```

---

## Part 4: Vercel AI SDK — Data Stream Protocol

### Version Note

As of AI SDK 5.0, the primary streaming architecture shifted from "data streams" to "UI message streams". The `createDataStreamResponse` and `formatDataStreamPart` APIs are **AI SDK 4.x APIs** that still work but are being superseded.

Current package versions available: `ai@4.3.19` (stable v4), `ai@5.0.0` (stable v5).

### AI SDK 4.x: `createDataStreamResponse`

```typescript
import { createDataStreamResponse } from 'ai';

export async function POST(req: Request) {
  return createDataStreamResponse({
    execute: async (dataStream) => {
      // Write arbitrary data (appears in useChat's onData callback)
      dataStream.writeData('call started');

      // Write message annotations (attached to current message)
      dataStream.writeMessageAnnotation({
        status: 'streaming',
        timestamp: Date.now(),
      });

      // Merge a streamText result into this stream
      const result = streamText({ model, messages });
      result.mergeIntoDataStream(dataStream);

      dataStream.writeData('call completed');
    },
    onError: (error) => {
      // Return sanitized error to send to client
      return 'An error occurred';
    },
    // Optional: headers, status
  });
}
```

#### `dataStream` methods (AI SDK 4.x):

| Method | Description |
|:-------|:------------|
| `dataStream.writeData(value: JSONValue)` | Write arbitrary JSON data. Received in `useChat`'s `data` array or `onData` callback |
| `dataStream.writeMessageAnnotation(annotation: JSONValue)` | Write annotation attached to the current assistant message |
| `dataStream.writeSources(sources)` | Write source references |

### `formatDataStreamPart` (AI SDK 4.x)

Low-level helper to manually format stream parts for writing to a writable stream:

```typescript
import { createDataStream, formatDataStreamPart } from 'ai';

const dataStream = createDataStream({
  execute: writer => {
    writer.writeData('initialized call');
    writer.write(formatDataStreamPart('text', 'Hello'));
    writer.writeSource({
      type: 'source',
      sourceType: 'url',
      id: 'source-1',
      url: 'https://example.com',
      title: 'Example Source',
    });
  },
});
```

`formatDataStreamPart(type, value)` formats values as the proprietary data stream protocol lines (`0:`, `2:`, `8:`, etc.).

### AI SDK 5.x: `createUIMessageStream` (Replacement)

```typescript
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from 'ai';

export async function POST(req: Request) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // Write custom data parts (type must be 'data-<name>')
      writer.write({
        type: 'data-status',
        id: 'status-1',
        data: { status: 'call started' },
      });

      // Write text content (start/delta/end pattern)
      writer.write({ type: 'text-start', id: 'text-1' });
      writer.write({ type: 'text-delta', id: 'text-1', delta: 'Hello' });
      writer.write({ type: 'text-end', id: 'text-1' });

      // Transient data (not persisted to message history)
      writer.write({
        type: 'data-notification',
        data: { message: 'Processing...', level: 'info' },
        transient: true,
      });

      // Merge LLM stream
      const result = streamText({ model, messages });
      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

### Data Stream Protocol (AI SDK 4.x Wire Format)

The data stream uses newline-delimited prefixed JSON lines over SSE:

| Prefix | Part Type | Description |
|:-------|:----------|:------------|
| `0:` | `text` | Text delta chunk |
| `2:` | `data` | Arbitrary JSON data array |
| `3:` | `error` | Error message |
| `8:` | `message_annotations` | Message annotation array |
| `d:` | `finish_message` | Stream finish with usage |
| `e:` | `finish_step` | Step finish |

---

## Part 5: `useChat` Hook (Vercel AI SDK)

### Import

```typescript
import { useChat } from '@ai-sdk/react';
// Also available from 'ai/react' (legacy)
```

### Key API (AI SDK 5.x)

```typescript
const {
  messages,      // UIMessage[] — chat history
  sendMessage,   // (message: { text: string }) => void — send user message
  status,        // 'ready' | 'submitted' | 'streaming' | 'error'
  stop,          // () => void — abort current generation
  // ... other fields
} = useChat({
  // Transport configuration
  transport: new DefaultChatTransport({ api: '/api/chat' }),
  // OR legacy:
  api: '/api/chat',  // deprecated in v5, use transport

  // Initial state
  id: 'chat-id',                    // Optional persistent chat ID
  messages: initialMessages,         // UIMessage[] initial history

  // Callbacks
  onFinish: ({ message, messages, isAbort, isDisconnect, isError }) => {},
  onError: (error) => { console.error(error); },
  onData: (dataPart) => {
    // Called for every data part received (including transient)
    console.log(dataPart.type, dataPart.data);
  },
});
```

**Breaking change in AI SDK 5.x:** `input`, `handleInputChange`, `handleSubmit` removed. Now manage input state manually with `useState` and submit via `sendMessage()`.

### Rendering Messages (AI SDK 5.x)

Messages now use a `parts` array instead of `content` string:

```tsx
{messages.map(message => (
  <div key={message.id}>
    {message.role === 'user' ? 'User: ' : 'AI: '}
    {message.parts.map((part, i) => {
      if (part.type === 'text') return <span key={i}>{part.text}</span>;
      if (part.type === 'data-weather') return <Weather key={i} data={part.data} />;
      return null;
    })}
  </div>
))}
```

### `onData` Callback Behavior

- Called for **every** data part as it arrives
- Includes transient parts (not in message history)
- Can throw to abort processing (triggers `onError`)
- Non-transient custom data parts also appear in `message.parts`

---

## Part 6: Corrected Integration Pattern

The user's intended pattern is fundamentally sound but has two issues:
1. The function name is `query()`, not `claude()`
2. The text content extraction is correct for `SDKAssistantMessage`

### Corrected API Route (AI SDK 4.x with `createDataStreamResponse`)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
// OR for old package: import { query } from "@anthropic-ai/claude-code";
import { createDataStreamResponse } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  return createDataStreamResponse({
    async execute(dataStream) {
      const abortController = new AbortController();

      const stream = query({
        prompt: lastMessage,
        options: {
          abortController,
        },
      });

      for await (const event of stream) {
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text") {
              // writeData sends arbitrary JSON to useChat's data array
              // To send as actual text tokens, use formatDataStreamPart:
              dataStream.writeData(block.text);
              // OR to stream as proper text delta (appears in message.text):
              // use result.mergeIntoDataStream pattern instead
            }
          }
        }
        // Handle completion
        if (event.type === "result") {
          dataStream.writeData({ done: true, cost: event.total_cost_usd });
        }
      }
    },
    onError: (error) => {
      console.error("Stream error:", error);
      return "An error occurred";
    },
  });
}
```

### Important Distinction: `writeData` vs Text Streaming

`dataStream.writeData()` sends data to the `data` array in `useChat`, accessible via `onData` callback. It does **not** appear in `message.content` / `message.parts` as text. To send text that appears in the message text, you would use `formatDataStreamPart('text', block.text)` written to a raw writable, or restructure to use `streamText` + `mergeIntoDataStream`.

### Corrected API Route (AI SDK 5.x with `createUIMessageStream`)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  const stream = createUIMessageStream({
    async execute({ writer }) {
      const abortController = new AbortController();

      const agentStream = query({
        prompt: lastMessage,
        options: { abortController },
      });

      for await (const event of agentStream) {
        if (event.type === "system" && event.subtype === "init") {
          writer.write({
            type: "data-session",
            data: { sessionId: event.session_id },
          });
        }

        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text") {
              // Stream text as proper text deltas
              const id = `text-${event.uuid}`;
              writer.write({ type: "text-start", id });
              writer.write({ type: "text-delta", id, delta: block.text });
              writer.write({ type: "text-end", id });
            }
            if (block.type === "tool_use") {
              // Optionally surface tool calls as data
              writer.write({
                type: "data-tool-call",
                data: { name: block.name, input: block.input },
              });
            }
          }
        }

        if (event.type === "result") {
          writer.write({
            type: "data-result",
            data: {
              costUsd: event.total_cost_usd,
              turns: event.num_turns,
              durationMs: event.duration_ms,
            },
          });
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

### Client-Side `useChat` Usage

```tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onData: (dataPart) => {
      if (dataPart.type === 'data-session') {
        console.log('Session ID:', dataPart.data.sessionId);
      }
      if (dataPart.type === 'data-result') {
        console.log('Cost:', dataPart.data.costUsd);
      }
    },
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}: {m.parts
            .filter(p => p.type === 'text')
            .map(p => p.text)
            .join('')}
        </div>
      ))}
      {(status === 'submitted' || status === 'streaming') && (
        <button onClick={stop}>Stop</button>
      )}
    </div>
  );
}
```

---

## Part 7: Key API Differences Summary

### `@anthropic-ai/claude-code` vs `@anthropic-ai/claude-agent-sdk`

- Both packages export the same API (`query`, `tool`, `createSdkMcpServer`, etc.)
- `@anthropic-ai/claude-code` is the legacy name; `@anthropic-ai/claude-agent-sdk` is current
- No `claude()` function exists in either package
- The primary export is `query()` which returns an `AsyncGenerator<SDKMessage>`

### AI SDK 4.x vs 5.x Streaming

| Feature | AI SDK 4.x | AI SDK 5.x |
|:--------|:-----------|:-----------|
| Response factory | `createDataStreamResponse` | `createUIMessageStreamResponse` |
| Stream factory | `createDataStream` | `createUIMessageStream` |
| Write data | `dataStream.writeData(json)` | `writer.write({ type: 'data-*', data })` |
| Write annotation | `dataStream.writeMessageAnnotation(json)` | `writer.write({ type: 'data-*', ... })` |
| Write text | `formatDataStreamPart('text', str)` | `writer.write({ type: 'text-delta', delta })` |
| Merge LLM stream | `result.mergeIntoDataStream(ds)` | `writer.merge(result.toUIMessageStream())` |
| useChat input | `input`, `handleInputChange`, `handleSubmit` | `useState` + `sendMessage()` |
| useChat transport | `api: '/api/chat'` | `transport: new DefaultChatTransport({ api })` |

---

## Sources

- Official Agent SDK Docs: https://platform.claude.com/docs/en/agent-sdk/overview
- TypeScript API Reference: https://platform.claude.com/docs/en/agent-sdk/typescript
- Migration Guide: https://platform.claude.com/docs/en/agent-sdk/migration-guide
- Context7: `/anthropics/claude-code` (v2.1.39)
- Context7: `/vercel/ai` (v4.3.19, v5.0.0)
- Context7: `/ben-vargas/ai-sdk-provider-claude-code`
