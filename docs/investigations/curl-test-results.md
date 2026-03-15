# Backend API Endpoint Test Results

**Date:** 2026-03-15
**Server:** Hono/Bun on localhost:3131
**AI SDK versions:** `ai@6.0.116`, `@ai-sdk/react@3.0.118`
**Claude Agent SDK:** `@anthropic-ai/claude-agent-sdk@0.2.76`

---

## Summary

All 16 endpoints were tested with curl. The session CRUD, auth, git, permission, and plan endpoints work correctly. The critical `/api/chat` SSE streaming endpoint works but has a **protocol mismatch** between the `data` channel events and the AI SDK v6 `useChat` hook expectations. Additionally, the git status API has a **path truncation bug** for staged files.

---

## Test Results

### 1. GET /api/health

```bash
curl -s http://localhost:3131/api/health
```

**Status:** 200
**Content-Type:** application/json
**Response:**
```json
{"status":"ok"}
```

**Result:** PASS

---

### 2. GET /api/auth/status

```bash
curl -s http://localhost:3131/api/auth/status
```

**Status:** 200
**Content-Type:** application/json
**Response:**
```json
{"authenticated":true,"plan":"pro"}
```

**Result:** PASS
**Note:** No `email` field is returned. The `AuthStatus` type says email is optional so this is fine, but the frontend might want to display it.

---

### 3. POST /api/sessions

```bash
# With title
curl -s -X POST http://localhost:3131/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session"}'
```

**Status:** 201
**Response:**
```json
{
  "id": "9dd1b5b7-e850-400d-b3ca-c4fa46159a7c",
  "title": "Test Session",
  "claudeSessionId": null,
  "createdAt": "2026-03-15 11:45:52",
  "updatedAt": "2026-03-15 11:45:52"
}
```

Also tested: no title (defaults to "New Chat"), empty body (defaults to "New Chat").

**Result:** PASS

---

### 4. GET /api/sessions

```bash
curl -s http://localhost:3131/api/sessions
```

**Status:** 200
**Response:** Array of Session objects, ordered by creation date (newest first).

**Result:** PASS

---

### 5. GET /api/sessions/:id/messages

```bash
curl -s http://localhost:3131/api/sessions/<id>/messages
```

**Status:** 200 (empty array for new session), 404 for invalid ID
**Error response for invalid ID:**
```json
{"error":"Session not found","code":"NOT_FOUND"}
```

**Result:** PASS

---

### 6. PATCH /api/sessions/:id (Rename)

```bash
curl -s -X PATCH http://localhost:3131/api/sessions/<id> \
  -H "Content-Type: application/json" \
  -d '{"title": "Renamed Session"}'
```

**Status:** 200
**Response:** Updated session object with new title.
**Validation tested:**
- Empty title `""` -> 400 with "Title cannot be empty"
- Missing title `{}` -> 400 with "Required"
- Nonexistent ID -> 404

**Result:** PASS

---

### 7. POST /api/sessions/:id/fork

```bash
curl -s -X POST http://localhost:3131/api/sessions/<id>/fork \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Status:** 201
**Response:** New session with title "(original title) (fork)".
**Nonexistent ID:** 404

**Result:** PASS

---

### 8. GET /api/sessions/:id/export?format=json

```bash
curl -s "http://localhost:3131/api/sessions/<id>/export?format=json"
```

**Status:** 200
**Response:**
```json
{
  "session": { "id": "...", "title": "...", "createdAt": "...", "updatedAt": "..." },
  "messages": [],
  "exportedAt": "2026-03-15T11:46:18.130Z"
}
```

**Result:** PASS

---

### 9. GET /api/sessions/:id/export?format=md

```bash
curl -s "http://localhost:3131/api/sessions/<id>/export?format=md"
```

**Status:** 200
**Content-Type:** text/markdown; charset=utf-8
**Response:** Markdown document with session title, export date, and messages.

Also tested: `?format=csv` -> 400 with "Invalid format. Supported: json, md"
No format param -> defaults to JSON export.

**Result:** PASS

---

### 10. DELETE /api/sessions/:id

```bash
curl -s -X DELETE http://localhost:3131/api/sessions/<id>
```

**Status:** 200 `{"ok":true}`
**Double-delete:** 404 `{"error":"Session not found","code":"NOT_FOUND"}`

**Result:** PASS

---

### 11. GET /api/git/status

```bash
curl -s http://localhost:3131/api/git/status
```

**Status:** 200
**Response:**
```json
{
  "branch": "main",
  "isClean": false,
  "modifiedFiles": [
    {"path": "apps/server/src/routes/chat.ts", "status": "modified"},
    {"path": "docs/investigations/INDEX.md", "status": "modified"}
  ],
  "stagedFiles": [
    {"path": "pps/desktop/src/App.tsx", "status": "modified"}
  ]
}
```

**Result:** BUG FOUND (see Bug #3 below)

---

### 12. GET /api/git/diff

```bash
curl -s http://localhost:3131/api/git/diff
```

**Status:** 200
**Response:** `{"diff": "...unified diff output..."}` with actual git diff content.

**Result:** PASS

---

### 13. POST /api/chat (Streaming - No Session ID)

```bash
curl -N -s -X POST http://localhost:3131/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Say hello in one word"}]}'
```

**Status:** 200
**Content-Type:** text/event-stream

#### Full Raw SSE Output:

```
data: {"type":"data","data":[{"type":"session:init","sessionId":"cf4aa989-...","model":"claude-sonnet-4-6","tools":[...],"mcpServers":[...],"claudeCodeVersion":"2.1.76"}]}

data: {"type":"data","data":[{"type":"block:start","blockIndex":0,"blockType":"text"}]}

data: {"type":"data","data":[{"type":"text:delta","text":"Hello!","blockIndex":0}]}

data: {"type":"start","messageId":"HQLtmnie4BTZcm3y"}

data: {"type":"text-start","id":"text-0"}

data: {"type":"text-delta","id":"text-0","delta":"Hello!"}

data: {"type":"data","data":[{"type":"assistant:message","uuid":"c58b9437-...","blocks":[{"type":"text","text":"Hello!"}],"parentToolUseId":null}]}

data: {"type":"data","data":[{"type":"block:stop","blockIndex":0}]}

data: {"type":"data","data":[{"type":"session:result","success":true,"subtype":"success","costUsd":0.02096385,"durationMs":1258,"numTurns":1,"usage":{"inputTokens":3,"outputTokens":5,"cacheReadTokens":0,"cacheCreationTokens":0}}]}

data: {"type":"finish","finishReason":"stop","messageMetadata":{"sessionId":"cf4aa989-...","appSessionId":"4fa6913f-..."}}

data: [DONE]
```

**Result:** WORKS, but has protocol issues (see Bugs #1, #2 below)

#### Error Cases Tested:

- No messages `{"messages": []}` -> 400 `{"error":"No user message provided"}`
- Only assistant messages -> 400 `{"error":"No user message provided"}`
- Invalid JSON -> 500 `{"error":"JSON Parse error: Unexpected identifier \"not\"","code":"INTERNAL_ERROR"}`

**Note:** Invalid JSON returns 500 instead of 400 -- see Bug #5.

---

### 14. POST /api/chat with sessionId (Multi-turn)

```bash
# First create a session
curl -s -X POST http://localhost:3131/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Multi-turn Test"}'
# Then use the sessionId
curl -N -s -X POST http://localhost:3131/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Say hello"}], "sessionId": "<id>"}'
```

**Status:** 200
**Content-Type:** text/event-stream
**Messages persisted:** Verified user + assistant messages stored in DB with correct session ID.
**Session updated:** `claudeSessionId` was updated to the Claude SDK session ID.

**Result:** PASS (functional), same protocol bugs as Test 13.

---

### 15. POST /api/chat/permission

```bash
# Correct format
curl -s -X POST http://localhost:3131/api/chat/permission \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-session", "requestId": "test-req", "decision": "allow_once"}'
```

**Status:** 200
**Response:** `{"ok":true,"requestId":"test-req","decision":"allow_once"}`

**Validation tested:**
- Missing `sessionId` -> 400
- Missing `requestId` -> 400
- Invalid decision `"allow"` -> 400 with valid options listed
- Old format `{"approvalId": "test", "decision": "allow"}` -> 400 (correct, old format not supported)

**Result:** PASS

---

### 16. POST /api/chat/plan

```bash
# Approve
curl -s -X POST http://localhost:3131/api/chat/plan \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-session", "planId": "test-plan", "decision": "approve"}'

# Reject with feedback
curl -s -X POST http://localhost:3131/api/chat/plan \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "s", "planId": "p", "decision": "reject", "feedback": "needs more detail"}'
```

**Status:** 200
**Validation tested:** Missing `sessionId`, `planId`, invalid decision -> all 400

**Result:** PASS

---

## Bugs Found

### Bug #1: Missing `text-end` Event in SSE Stream (CRITICAL)

**Severity:** Critical -- breaks AI SDK `useChat` protocol compliance.

The SSE stream sends `text-start` and `text-delta` events but **never sends `text-end`**. The Vercel AI SDK v6 UIMessageStream protocol requires:

```
text-start -> text-delta (multiple) -> text-end -> finish
```

But the server sends:
```
text-start -> text-delta (multiple) -> finish
```

**Where:** `apps/server/src/routes/chat.ts` -- the `finally` block and post-loop code never emit a `text-end` event for the active text block.

**Impact:** The AI SDK's `useChat` hook may not properly finalize the text part. This could cause the message to appear incomplete or trigger validation warnings.

**Fix:** After the streaming loop completes successfully, emit `text-end` for the active text block:
```typescript
// Before the finish event:
if (startSent && activeTextBlockIndex !== null) {
  writer.write({
    type: 'text-end',
    id: `text-${currentTextId}`,
  });
}
```

---

### Bug #2: `data` Channel Events Not Consumed by Frontend (CRITICAL)

**Severity:** Critical -- the rich UI data (tool calls, thinking, session info, usage) is sent but never received.

The server sends every SDK event on the `data` channel:
```
data: {"type":"data","data":[{"type":"session:init",...}]}
data: {"type":"data","data":[{"type":"text:delta",...}]}
data: {"type":"data","data":[{"type":"session:result",...}]}
```

The frontend's `useStreamEvents` hook exports an `onData` callback that can process these events. However, **`onData` is never wired up to the `useChat` hook or the `DefaultChatTransport`**.

In `ChatPage.tsx`:
```typescript
const { toolCalls, thinkingBlocks, ... } = useStreamEvents();
// ^ onData is destructured but NEVER used

const { messages, sendMessage, ... } = useChat({
  id: sessionId ?? undefined,
  transport,
  // NO onData or data callback here!
});
```

**Impact:** The following features are COMPLETELY BROKEN in the frontend:
- Tool call display (toolCalls map is always empty)
- Thinking blocks display
- Permission requests from Claude SDK
- Session info (model name, etc.)
- Usage/cost tracking
- Context usage indicator
- Compacting status
- Subagent tracking

**Fix:** The `data` channel events need to be consumed. In AI SDK v6, the `useChat` hook with `DefaultChatTransport` does not directly expose a `data` callback. Instead, the transport or a custom `onDataPart` handler should be used to intercept `data` type SSE events and pass them to `useStreamEvents().onData`.

Alternatively, use a custom transport that intercepts the data events and dispatches them to the stream events reducer.

---

### Bug #3: Git Status Path Truncation for Staged Files

**Severity:** Medium

The `/api/git/status` endpoint occasionally returns truncated file paths for staged files. Observed:
- API returns: `pps/desktop/src/App.tsx`
- Expected: `apps/desktop/src/App.tsx`

The first character of the path is stripped. This appears intermittent and may be related to:
1. The server running from a subdirectory (`apps/server/`) where git's porcelain output might have different padding
2. A Bun-specific issue with `Bun.spawn` stdout text encoding
3. Race condition where the git index state differs from expected

The `parseStatusLine` function in `apps/server/src/routes/git.ts` uses `line.slice(3)` which is correct for the `XY PATH` format (`X`=index, `Y`=worktree, space, path). However, the server process may be receiving lines with only 2 prefix characters instead of 3 in some edge cases.

**Where:** `apps/server/src/routes/git.ts`, `parseStatusLine()` function.

**Suggested investigation:** Add logging to print the raw line bytes before parsing:
```typescript
console.log('[git] raw line:', JSON.stringify(line), 'len:', line.length);
```

---

### Bug #4: `data` Channel Event Ordering Issue

**Severity:** Medium

The `data` channel events (rich SDK events) are sent **before** the corresponding AI SDK protocol events. For example:

```
data: {"type":"data","data":[{"type":"text:delta","text":"Hello!","blockIndex":0}]}  ← data first
data: {"type":"start","messageId":"HQLtmnie4BTZcm3y"}                               ← then start
data: {"type":"text-start","id":"text-0"}                                            ← then text-start
data: {"type":"text-delta","id":"text-0","delta":"Hello!"}                           ← then text-delta
```

The `text:delta` data event fires before `start` and `text-start`. This means the rich UI would try to process a text delta before the message has started. The frontend's `useStreamEvents` reducer handles this gracefully (it doesn't depend on start/text-start), but it's still an ordering concern.

The root cause is that `writer.write({ type: 'data', data: [event] })` is called immediately when each SDK event arrives, but the `start` and `text-start` events are only sent inside the `case 'text:delta':` branch, after the data event.

**Impact:** If the frontend tries to correlate data events with AI SDK message events, the ordering mismatch could cause brief inconsistencies.

---

### Bug #5: Invalid JSON Body Returns 500 Instead of 400

**Severity:** Low

```bash
curl -X POST http://localhost:3131/api/chat \
  -H "Content-Type: application/json" \
  -d 'not json'
```

Returns:
```json
{"error":"JSON Parse error: Unexpected identifier \"not\"","code":"INTERNAL_ERROR"}
```

**Status code:** 500 (should be 400 Bad Request)

The error handler in `apps/server/src/middleware/error-handler.ts` catches the JSON parse error but classifies it as INTERNAL_ERROR (500) instead of a client error (400).

---

### Bug #6: `start` Event Has No `messageId` Coordination with Data Channel

**Severity:** Low

The AI SDK protocol `start` event includes a `messageId`:
```json
{"type":"start","messageId":"HQLtmnie4BTZcm3y"}
```

This messageId is auto-generated by the AI SDK's `createUIMessageStream`. The `finish` event includes `messageMetadata` with `sessionId` and `appSessionId`, but the `messageId` in the `start` event is not correlated with anything the server tracks.

If the frontend needs to associate a message with its session/data events, there's no reliable way to connect the AI SDK's auto-generated `messageId` with the server's `appSessionId`.

---

### Bug #7: CORS Allows Response Body for Unauthorized Origins

**Severity:** Low/Informational

When a request comes from an unauthorized origin (e.g., `http://evil.com`), the server still processes the request and returns the response body with a 200 status. The CORS headers don't include `Access-Control-Allow-Origin` for the unauthorized origin, so browsers would block the response. But the request is still fully processed server-side.

This is standard CORS behavior (server-side processing happens regardless), but for security-sensitive endpoints, consider adding server-side origin validation in addition to CORS headers.

---

## SSE Stream Analysis: Data Channel vs AI SDK Protocol

### What the Server Sends

The chat route uses `createUIMessageStream` and writes two parallel streams:

1. **Data channel** (`type: 'data'`): Every SDK event wrapped in `{"type":"data","data":[<StreamEvent>]}`. This contains the rich event data (tool calls, thinking, session info, permissions, usage, etc.).

2. **AI SDK protocol events**: Standard UIMessageStream events (`start`, `text-start`, `text-delta`, `finish`). These are what `useChat` consumes to render text messages.

### What the Frontend Expects

The frontend uses `useChat` with `DefaultChatTransport`, which processes the AI SDK protocol events. The `useStreamEvents` hook has an `onData` callback that can process the data channel events, but **it is never connected to the transport**.

### Protocol Flow (Current)

```
Server                          Frontend (useChat)              Frontend (useStreamEvents)
  |                                   |                                |
  |-- data: {data:[session:init]} -->|  (ignored - unknown type)      |  (never received)
  |-- data: {data:[block:start]} --->|  (ignored)                     |  (never received)
  |-- data: {data:[text:delta]} ---->|  (ignored)                     |  (never received)
  |-- start ----------------------->|  message created               |
  |-- text-start ------------------>|  text part started             |
  |-- text-delta ------------------>|  text rendered                 |
  |-- data: {data:[assistant:msg]}->|  (ignored)                     |  (never received)
  |-- data: {data:[block:stop]} --->|  (ignored)                     |  (never received)
  |-- data: {data:[session:result]}>|  (ignored)                     |  (never received)
  |-- finish ---------------------->|  message finalized             |
  |-- [DONE] ---------------------->|  stream closed                 |
```

### What Should Happen

The data channel events need to reach `useStreamEvents.onData`. Options:

1. **Custom transport** that intercepts `data` events and dispatches them
2. **`onStreamPart` callback** (if available in AI SDK v6) to capture data parts
3. **Remove data channel** entirely and send rich events through a separate mechanism (e.g., a parallel SSE stream or WebSocket)

### Missing `text-end`

The AI SDK v6 UIMessageStream protocol expects:
```
start -> text-start -> text-delta* -> text-end -> finish
```

The server never emits `text-end`. This means the text part is never formally closed before the `finish` event.

---

## Edge Cases Tested

| Endpoint | Test Case | Status | Code |
|----------|-----------|--------|------|
| POST /api/sessions | No title | PASS | 201 |
| POST /api/sessions | Empty body | PASS | 201 |
| PATCH /api/sessions/:id | Empty title | PASS | 400 |
| PATCH /api/sessions/:id | No title field | PASS | 400 |
| PATCH /api/sessions/:id | Nonexistent ID | PASS | 404 |
| POST /api/sessions/:id/fork | Nonexistent ID | PASS | 404 |
| GET /api/sessions/:id/export | format=csv | PASS | 400 |
| GET /api/sessions/:id/export | No format | PASS (JSON) | 200 |
| DELETE /api/sessions/:id | Double delete | PASS | 404 |
| POST /api/chat | No messages | PASS | 400 |
| POST /api/chat | No user message | PASS | 400 |
| POST /api/chat | Invalid JSON | BUG | 500 (should be 400) |
| POST /api/chat/permission | Missing fields | PASS | 400 |
| POST /api/chat/permission | Invalid decision | PASS | 400 |
| POST /api/chat/plan | Missing fields | PASS | 400 |
| POST /api/chat/plan | Invalid decision | PASS | 400 |
| GET /api/nonexistent | 404 route | PASS | 404 |
| GET /api/chat | Wrong method | OK | 404 |
| OPTIONS /api/health | CORS preflight | PASS | 204 |
