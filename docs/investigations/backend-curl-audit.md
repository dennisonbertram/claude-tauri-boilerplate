# Backend Curl Audit: Current State of the Server

**Date:** 2026-03-15
**Purpose:** Comprehensive summary of how the backend works, focusing on the `/api/chat` SSE endpoint, event transformation pipeline, and how the output maps to what the Vercel AI SDK expects on the frontend.

---

## Table of Contents

1. [Server Entry & App Structure](#1-server-entry--app-structure)
2. [Route Overview](#2-route-overview)
3. [Database Layer](#3-database-layer)
4. [Auth Route](#4-auth-route)
5. [Sessions Routes](#5-sessions-routes)
6. [Chat Route — Deep Dive](#6-chat-route--deep-dive)
7. [Claude Service](#7-claude-service)
8. [Event Mapper Pipeline](#8-event-mapper-pipeline)
9. [Shared Types Reference](#9-shared-types-reference)
10. [SSE Wire Format](#10-sse-wire-format)
11. [Vercel AI SDK Compatibility Analysis](#11-vercel-ai-sdk-compatibility-analysis)
12. [Known Issues & Gaps](#12-known-issues--gaps)

---

## 1. Server Entry & App Structure

**Entry point:** `apps/server/src/index.ts`

```ts
import { app } from './app';

const port = parseInt(process.env.PORT || '3131');
export default { port, fetch: app.fetch };
```

Runs as a Bun server on port **3131** (configurable via `PORT` env var).

**App definition:** `apps/server/src/app.ts`

Mounts:
- `GET /api/health` — inline health check
- `GET /api/auth/status` — auth status
- `POST /api/chat` — streaming chat (main endpoint)
- `POST /api/chat/permission` — permission decision endpoint
- `POST /api/chat/plan` — plan decision endpoint
- `GET|POST|PATCH|DELETE /api/sessions` — session CRUD
- `GET /api/git/*` — git status/diff routes

CORS allows: `http://localhost:1420` and `tauri://localhost` with credentials.

Error handling: centralized `errorHandler` middleware (`apps/server/src/middleware/error-handler.ts`) returns consistent `{ error, code, details? }` JSON for all unhandled exceptions.

---

## 2. Route Overview

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/api/health` | inline | Returns `{ status: 'ok' }` |
| GET | `/api/auth/status` | `authRouter` | Reads Claude CLI credentials |
| POST | `/api/chat` | `createChatRouter` | SSE streaming via Vercel AI SDK |
| POST | `/api/chat/permission` | `createPermissionRouter` | Tool permission decisions |
| POST | `/api/chat/plan` | `createPlanRouter` | Plan approval/rejection |
| GET | `/api/sessions` | `createSessionsRouter` | List sessions |
| POST | `/api/sessions` | `createSessionsRouter` | Create session |
| PATCH | `/api/sessions/:id` | `createSessionsRouter` | Rename session |
| POST | `/api/sessions/:id/fork` | `createSessionsRouter` | Fork session |
| GET | `/api/sessions/:id/export` | `createSessionsRouter` | Export as JSON or Markdown |
| GET | `/api/sessions/:id/messages` | `createSessionsRouter` | Get messages |
| DELETE | `/api/sessions/:id` | `createSessionsRouter` | Delete session (cascade) |
| GET | `/api/git/status` | `createGitRouter` | Git status |
| GET | `/api/git/diff` | `createGitRouter` | Git diff |

---

## 3. Database Layer

**Location:** `apps/server/src/db/`

**SQLite file:** `~/.claude-tauri/data.db`

**Schema** (`apps/server/src/db/schema.ts`):

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  claude_session_id TEXT,                    -- maps to Claude Agent SDK session ID for resumption
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

WAL mode + foreign keys enabled. `claude_session_id` is the SDK-level session ID used to resume conversations via `options.resume`.

**Key db functions** (`apps/server/src/db/index.ts`):
- `createDb(path?)` — creates/opens the DB, runs migrations
- `createSession(db, id, title?)` — insert session
- `getSession(db, id)` — fetch by app session ID
- `listSessions(db)` — all sessions, newest first
- `deleteSession(db, id)` — cascades to messages
- `updateSessionTitle(db, id, title)` — rename
- `updateClaudeSessionId(db, sessionId, claudeSessionId)` — persists SDK session ID after first turn
- `addMessage(db, id, sessionId, role, content)` — insert message
- `getMessages(db, sessionId)` — messages in order

---

## 4. Auth Route

**File:** `apps/server/src/routes/auth.ts`

```
GET /api/auth/status
```

Calls `getAuthStatus()` from `apps/server/src/services/auth.ts`. That service reads the Claude CLI credentials from disk and returns an `AuthStatus` object:

```ts
interface AuthStatus {
  authenticated: boolean;
  email?: string;
  plan?: string;
  error?: string;
}
```

No authentication is required to call this endpoint itself — it just reports the state of the local Claude subscription credentials.

---

## 5. Sessions Routes

**File:** `apps/server/src/routes/sessions.ts`

All routes validate input with Zod.

**List sessions:** `GET /api/sessions` — returns `Session[]` ordered by `created_at DESC`.

**Create session:** `POST /api/sessions` — body: `{ title?: string }`. Creates and returns a new `Session`. This is for pre-creating sessions before chat (optional). The chat route also creates sessions lazily.

**Rename session:** `PATCH /api/sessions/:id` — body: `{ title: string }`. Title is trimmed, min 1 char, max 500. Returns updated `Session`.

**Fork session:** `POST /api/sessions/:id/fork` — body: `{ title?: string, messageIndex?: number }`. Creates a new session and copies messages from the original up to `messageIndex` (default: all). Returns new `Session`.

**Export session:** `GET /api/sessions/:id/export?format=json|md` — returns the session and messages as a JSON attachment or Markdown file download.

**Get messages:** `GET /api/sessions/:id/messages` — returns `Message[]` for a session, in `created_at ASC` order.

**Delete session:** `DELETE /api/sessions/:id` — returns `{ ok: true }`. Messages cascade-deleted.

**Shared types:**
```ts
interface Session {
  id: string;
  title: string;
  claudeSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
```

---

## 6. Chat Route — Deep Dive

**File:** `apps/server/src/routes/chat.ts`

This is the most complex route. It handles one `POST /api/chat` per turn.

### Request Shape

```ts
interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  }>;
  sessionId?: string;
}
```

The `parts` array is for Vercel AI SDK v6 compatibility (AI SDK sends `parts` instead of `content` in newer versions). The route extracts the prompt as:

```ts
const prompt: string =
  lastUserMessage.content ??
  lastUserMessage.parts
    ?.filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('') ??
  '';
```

Only the **last user message** is extracted as the prompt. Prior message history is not forwarded to the SDK — resumption of context happens via `options.resume` (Claude session ID stored in the DB).

### Session Lifecycle

Sessions are created **lazily** (deferred until first successful SDK event, Bug #37 fix). This avoids orphaned sessions when the SDK call fails before emitting any event.

Logic:
1. If `sessionId` is provided, look up the existing session to get its `claudeSessionId` (for SDK resumption).
2. On first successful SDK event, call `ensureSession()` which either creates a new session or confirms the existing one, then persists the user message.
3. After streaming completes, persist the full assistant response and update `claudeSessionId` on the app session.

### Streaming Implementation

Uses Vercel AI SDK v5 (`ai` package):

```ts
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
```

The stream uses two parallel channels:

**Channel 1: data channel** — every `StreamEvent` from the Claude service is written verbatim:
```ts
writer.write({ type: 'data', data: [event] });
```
This reaches the frontend via `useChat`'s `onData` callback and the custom `data` array on the message object.

**Channel 2: AI SDK text protocol** — `text:delta` events are also translated into the AI SDK `text-start` / `text-delta` / `text-end` message part protocol, so the message text appears in `message.parts` and `message.content` automatically:
```ts
writer.write({ type: 'start' });
writer.write({ type: 'text-start', id: `text-${currentTextId}` });
writer.write({ type: 'text-delta', id: `text-${currentTextId}`, delta: event.text });
```

Multiple text blocks are handled: when `event.blockIndex` changes to a different block, the current text id is incremented and a new `text-start` is emitted.

**Note:** `text-end` is NOT explicitly written between text blocks — the start of a new text block implicitly ends the previous one in the AI SDK v5 protocol. The `finish` event closes everything.

### Finish Event

```ts
writer.write({
  type: 'finish',
  finishReason: 'stop',
  messageMetadata: {
    sessionId: claudeSessionId,   // Claude Agent SDK session ID
    appSessionId,                  // Our app's session UUID
  },
});
```

The `messageMetadata` is how session IDs are communicated back to the frontend after each turn.

### Error Handling

Errors during streaming are classified by `classifyStreamError()`:

| Condition | `errorType` |
|-----------|-------------|
| HTTP 429 | `rate_limit` |
| HTTP 401/403 | `auth` |
| `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED` | `network` |
| Other 4xx/5xx | `api` |
| Other | `stream` |

Errors are written to the data channel AND re-thrown so the AI SDK `onError` handler fires. The assistant response is NOT persisted if streaming errored.

---

## 7. Claude Service

**File:** `apps/server/src/services/claude.ts`

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { mapSdkEvent } from './event-mapper';

export async function* streamClaude(options: ClaudeStreamOptions): AsyncGenerator<StreamEvent> {
  const queryOptions = {
    includePartialMessages: true,
    maxTurns: 1,
  };

  if (options.sessionId) {
    queryOptions.resume = options.sessionId;
  }

  const stream = query({ prompt: options.prompt, options: queryOptions });

  for await (const event of stream) {
    const mapped = mapSdkEvent(event);
    for (const streamEvent of mapped) {
      yield streamEvent;
    }
  }
}
```

Key points:
- Always uses `includePartialMessages: true` for token-level streaming (without this, you get no `stream_event` / `content_block_delta` events).
- Always uses `maxTurns: 1` — each HTTP request is a single Claude turn. Multi-turn continuity is handled via `options.resume`.
- `options.resume` loads the full conversation history from the Claude CLI's local storage for the given session ID.
- Raw SDK events are passed through `mapSdkEvent()` before yielding, transforming them into the app's `StreamEvent` union type.

---

## 8. Event Mapper Pipeline

**File:** `apps/server/src/services/event-mapper.ts`

Transforms raw Claude Agent SDK events (`any`) into typed `StreamEvent` objects from the shared package.

### SDK Event Types and Their Mappings

| SDK `event.type` | SDK `event.subtype` | Mapped `StreamEvent.type` |
|-----------------|---------------------|--------------------------|
| `system` | `init` | `session:init` |
| `system` | `compact_boundary` | `compact-boundary` |
| `system` | `status` | `status` |
| `system` | `rate_limit` | `rate-limit` |
| `system` | `hook_started` | `hook:started` |
| `system` | `hook_progress` | `hook:progress` |
| `system` | `hook_response` | `hook:response` |
| `system` | `task_started` | `task:started` |
| `system` | `task_progress` | `task:progress` |
| `system` | `task_notification` | `task:notification` |
| `system` | `files_persisted` | `files:persisted` |
| `system` | `tool_use_summary` | `tool:summary` |
| `system` | `prompt_suggestion` | `prompt:suggestion` |
| `system` | `permission_request` | `permission:request` |
| `system` | `permission_denied` | `permission:denied` |
| `system` | `plan_start` | `plan:start` |
| `system` | `plan_content` | `plan:content` |
| `system` | `plan_complete` | `plan:complete` |
| `assistant` | — | `assistant:message` (+ `error` if `.error` is set) |
| `user` | — (synthetic only) | `tool:result` (only if `isSynthetic && parent_tool_use_id`) |
| `result` | — | `session:result` (+ `error` if not `success`) |
| `stream_event` | — | See inner event table below |
| `tool_progress` | — | `tool:progress` |
| `auth_status` | — | `auth:status` |

### Stream Event Inner Mapping (`event.type === 'stream_event'`)

| Inner `event.event.type` | Delta type | Mapped `StreamEvent.type` |
|--------------------------|------------|--------------------------|
| `content_block_start` | — | `block:start` |
| `content_block_delta` | `text_delta` | `text:delta` |
| `content_block_delta` | `thinking_delta` | `thinking:delta` |
| `content_block_delta` | `input_json_delta` | `tool-input:delta` |
| `content_block_stop` | — | `block:stop` |
| `message_start` | — | (dropped) |
| `message_delta` | — | (dropped) |
| `message_stop` | — | (dropped) |

### Notable Mapping Behaviors

- User messages are silently dropped unless they are synthetic tool-result echoes.
- `assistant:message` events are emitted in addition to the streaming `text:delta` events — the frontend receives both the incremental stream AND the complete final message.
- `result` subtypes other than `success` (e.g., `error`, `timeout`, `max_turns`) emit both `session:result` and an `error` event.
- Unknown `system` subtypes log a `console.warn` and return `[]` (no event).
- Unknown top-level event types also log a `console.warn` and return `[]`.

---

## 9. Shared Types Reference

**File:** `packages/shared/src/types.ts`

The `StreamEvent` union covers 27 distinct event types:

```
session:init, session:result,
text:delta, thinking:delta, tool-input:delta,
block:start, block:stop,
assistant:message, tool:result, tool:progress,
error, status, rate-limit, compact-boundary,
auth:status,
task:started, task:progress, task:notification,
hook:started, hook:progress, hook:response,
files:persisted, tool:summary, prompt:suggestion,
permission:request, permission:denied,
plan:start, plan:content, plan:complete, plan:approved, plan:rejected
```

All event types are exported from `@claude-tauri/shared`.

---

## 10. SSE Wire Format

The `/api/chat` endpoint returns a `createUIMessageStreamResponse`, which is the Vercel AI SDK v5 streaming response format. This is NOT plain SSE — it uses the AI SDK's proprietary line-delimited format.

### What the AI SDK Stream Looks Like on the Wire

Each line is a JSON object with a specific format understood by the AI SDK's `useChat` hook:

```
# start event
{"type":"start","messageId":"<uuid>"}

# data channel (custom events)
{"type":"data","data":[{"type":"session:init","sessionId":"...","model":"...","tools":[...],...}]}
{"type":"data","data":[{"type":"block:start","blockIndex":0,"blockType":"text"}]}
{"type":"data","data":[{"type":"text:delta","text":"Hello","blockIndex":0}]}

# text protocol (for message.content / message.parts)
{"type":"text-start","id":"text-0"}
{"type":"text-delta","id":"text-0","delta":"Hello"}
{"type":"text-delta","id":"text-0","delta":" world"}

# more data events
{"type":"data","data":[{"type":"assistant:message","uuid":"...","blocks":[...],"parentToolUseId":null}]}
{"type":"data","data":[{"type":"session:result","success":true,"costUsd":0.029699,...}]}

# finish
{"type":"finish","finishReason":"stop","messageMetadata":{"sessionId":"...","appSessionId":"..."}}
```

### Dual-Channel Design

Every `StreamEvent` is sent on **both** channels simultaneously for `text:delta` events:

1. **Data channel** (`{ type: 'data', data: [event] }`) — consumed by `onData` callback and `message.data` in `useChat`. Carries the full rich event for custom UI (tool calls, thinking blocks, session init, etc.).
2. **Text protocol** (`text-start` / `text-delta`) — consumed natively by the AI SDK and appears in `message.content` and `message.parts[].text`. This is what causes text to appear in the chat UI automatically.

Non-text events (tool calls, session init, thinking, etc.) go **only** to the data channel.

---

## 11. Vercel AI SDK Compatibility Analysis

### What Works

- `useChat` hook receives text via `message.content` and `message.parts` (text-delta protocol).
- `onData` callback fires for every custom `StreamEvent` in the data channel.
- `onFinish` receives `messageMetadata` with `sessionId` and `appSessionId`.
- Error events come through the data channel and can be displayed in the UI.
- The finish event with `finishReason: 'stop'` signals completion properly.

### Potential Issues

1. **`text-end` not explicitly written.** The current code writes `text-start` and `text-delta` but does NOT write `text-end` between text blocks. It only increments the text ID and starts a new block. In AI SDK v5, the stream is finalized by the `finish` event, which implicitly closes open text parts. This should work but is worth verifying.

2. **Single `start` event for entire response.** The code writes `{ type: 'start' }` only once, on the first `text:delta` event. This means if the response begins with a tool call (no text at first), the `start` event is never sent. The AI SDK may not handle this gracefully in all cases.

3. **`text-start` not sent for non-first blocks before their first `text-end`.** When the blockIndex changes, the code does:
   ```ts
   currentTextId++;
   writer.write({ type: 'text-start', id: `text-${currentTextId}` });
   ```
   But the previous text block has no explicit `text-end`. The AI SDK v5 spec says a new `text-start` with a different ID implicitly ends the previous one. This is probably fine but not tested with multi-block responses.

4. **Multi-turn: only last user message extracted.** The chat route takes the last user message as the prompt. It does NOT forward the full message history to the SDK. Multi-turn context is entirely dependent on `options.resume` working correctly with the stored `claudeSessionId`. If `claudeSessionId` is ever lost or mismatched, multi-turn breaks silently.

5. **No `text-end` events.** The AI SDK v5 spec defines `text-start` / `text-delta` / `text-end` as the full protocol for text parts. `text-end` is omitted here. While the AI SDK appears to tolerate this (the `finish` event closes all open parts), any AI SDK middleware or streaming inspector that expects `text-end` will not see it.

6. **`session:init` event: tools field.** The `session:init` event maps `event.tools` directly, but the SDK returns `tools` as an array of tool definition objects or strings (unverified shape). If the shape is unexpected, the frontend may fail silently.

---

## 12. Known Issues & Gaps

### Session Creation Race Condition

The `ensureSession()` lazy-creation approach correctly avoids orphaned sessions on SDK failure. However, if the frontend sends a second request before the first one's `finish` event, and both use the same `sessionId`, both will call `createSession` on the same ID — which will throw a SQLite primary key violation on the second call. The `ensureSession()` guard (`sessionEnsured`) only protects within a single request, not across concurrent requests on the same session.

### Missing `text-end` Events

As noted in §11, `text-end` events are not emitted. This is a deviation from the AI SDK v5 protocol spec that should be resolved for full compliance.

### `start` Event Only on Text

If a Claude response begins with a tool call (no initial text), the AI SDK `start` event is never sent. This could result in `useChat` never updating its loading state for that turn.

### `maxTurns: 1` Hardcoded

The Claude service always uses `maxTurns: 1`. This is correct for the current one-turn-per-request architecture, but means the SDK will not auto-continue if Claude naturally wants to take more than one step. Any agentic behavior that spans multiple tool calls in one "turn" relies on the SDK's internal loop within that single turn.

### No Abort Controller Support

There is no `AbortController` wired up between the HTTP request lifecycle and the `query()` call. If the client disconnects mid-stream, the Claude SDK query continues running to completion on the server (wasted compute and cost).

### Permission Flow Blocks Stream

When Claude emits a `permission:request` event, the SDK is paused waiting for a decision via the `/api/chat/permission` endpoint. The SSE stream from `/api/chat` remains open (Hono/Bun does not timeout it). This is correct behavior but means the frontend must respond to permission events or the stream hangs indefinitely.

---

## Summary

The backend is well-structured and largely correct. The main pipeline is:

```
POST /api/chat
  → extract last user message as prompt
  → look up existing session for claudeSessionId
  → streamClaude({ prompt, sessionId: claudeSessionId? })
    → query() from @anthropic-ai/claude-agent-sdk
      (options: includePartialMessages=true, maxTurns=1, resume=claudeSessionId?)
    → mapSdkEvent() for each raw SDK event
    → yield StreamEvent
  → for each StreamEvent:
    → write to data channel (rich custom events)
    → if text:delta: write to AI SDK text protocol (text-start/text-delta)
  → on finish: write finish event with session metadata
  → persist user message + assistant response to SQLite
  → update claudeSessionId on session
```

The Vercel AI SDK `createUIMessageStreamResponse` wraps all of this in the line-delimited streaming format that `useChat` consumes. Text appears in `message.content` via the text protocol. All other events (tool calls, session data, thinking, permission requests, etc.) arrive via the data channel for custom frontend handling.
