# Frontend Chat Debug: Messages Not Displaying

**Date:** 2026-03-15
**Status:** Root cause identified, fix proposed

## Symptoms

1. User types message, presses Enter, input clears (`handleSubmit` runs)
2. Server receives and processes request (confirmed in server logs)
3. No messages appear in the UI
4. No console errors in the browser
5. Network tracking showed NO `/api/chat` POST for a second attempt

## Architecture Overview

```
ChatPage.tsx
  -> useChat({ id: sessionId ?? undefined, transport })
       -> Chat class (from @ai-sdk/react)
            -> DefaultChatTransport.sendMessages() -> POST /api/chat
  -> useStreamEvents() (NOT wired to useChat -- secondary bug)
```

## Root Cause: `useChat` Recreates Chat Instance on Every Render

### The Bug (PRIMARY -- Critical)

**File:** `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/desktop/src/components/chat/ChatPage.tsx`
**Line 149:**

```typescript
const { messages, sendMessage, status, setMessages, error, clearError } =
  useChat({
    id: sessionId ?? undefined,   // <-- THIS IS THE BUG
    transport,
  });
```

When `sessionId` is `null` (no active session selected), `id` becomes `undefined`.

**Inside `useChat`** (`node_modules/@ai-sdk/react/src/use-chat.ts`, lines 102-109):

```typescript
const shouldRecreateChat =
  ('chat' in options && options.chat !== chatRef.current) ||
  ('id' in options && chatRef.current.id !== options.id);

if (shouldRecreateChat) {
  chatRef.current =
    'chat' in options ? options.chat : new Chat(optionsWithCallbacks);
}
```

The check `'id' in options` evaluates to `true` even when `id` is `undefined` (because the key exists in the object). Then `chatRef.current.id` (an auto-generated UUID like `"abc-123"`) is compared to `undefined`, which is always `true`. So **a brand new `Chat` instance is created on EVERY render**.

### Exact Failure Sequence

1. Component renders with `sessionId=null` -> `id: undefined`
2. First render: `useRef` creates Chat A (id="random-a")
3. `shouldRecreateChat`: `'id' in { id: undefined, transport: ... }` = `true`, `"random-a" !== undefined` = `true` -> **Chat B created**
4. User types "Hello" and presses Enter
5. `handleSubmit` calls `sendMessage({ text: "Hello" })` on Chat B
6. `Chat.sendMessage` calls `this.state.pushMessage(userMessage)` -> triggers React state update -> **re-render**
7. During re-render, `shouldRecreateChat` fires again -> **Chat C created (empty messages)**
8. `useSyncExternalStore` now subscribes to Chat C's messages (which is `[]`)
9. Chat B is orphaned -- its `makeRequest` continues, the POST goes through, the server responds, but the stream data updates Chat B's state, which is no longer observed by React
10. **Result:** User message briefly appears, then vanishes. Server processes the request and responds, but the response goes to the orphaned Chat B

### Why "No POST on Second Attempt"

On the second attempt:
- `sendMessage` is called on a Chat instance
- `pushMessage` triggers re-render -> Chat is replaced
- The new Chat's `sendMessage` was never called (the old one was)
- The old Chat's request completes, but to a now-orphaned Chat
- If the user tries again quickly, the same cycle repeats -- but because the Chat is recreated so rapidly, the `makeRequest` might not even get far enough to fire the fetch before the Chat is abandoned

## Secondary Issues

### Issue 2: `useStreamEvents.onData` Not Wired to `useChat`

**File:** `ChatPage.tsx`

The `useStreamEvents` hook exposes an `onData` callback designed to process custom `data-stream-event` chunks from the server. However, this callback is **never passed** to `useChat`:

```typescript
// useStreamEvents returns onData, but it's never used:
const { toolCalls, thinkingBlocks, ... } = useStreamEvents();

// useChat is called WITHOUT onData:
const { messages, sendMessage, ... } = useChat({
  id: sessionId ?? undefined,
  transport,
  // MISSING: onData: streamEvents.onData  (or similar wiring)
});
```

**Impact:** Even if the primary bug is fixed, custom stream events (tool calls, thinking blocks, permissions, usage data) sent via `data-stream-event` will be received by the client but never processed by `useStreamEvents`. They'll end up as `DataUIPart`s in the message `parts` array instead.

### Issue 3: `data-stream-event` Schema Compatibility

The server sends custom events like:
```json
{ "type": "data-stream-event", "data": { "type": "text:delta", ... } }
```

The AI SDK v6 schema (`uiMessageChunkSchema`) accepts types matching `data-${string}`, so `data-stream-event` passes validation. However, the SDK treats these as `DataUIPart`s and adds them to `message.parts`. Without the `onData` callback wired, these parts accumulate silently in the message state.

This won't crash the stream, but it means:
- Every custom event adds a `data-stream-event` part to the assistant message
- The `onData` callback (which would forward to `useStreamEvents`) is never invoked
- Tool call states, thinking blocks, and usage data are never populated in the UI

## Recommended Fixes

### Fix 1: Stabilize the Chat ID (Critical)

**Option A -- Don't pass `id` when sessionId is null:**
```typescript
const chatOptions = sessionId
  ? { id: sessionId, transport }
  : { transport };

const { messages, sendMessage, ... } = useChat(chatOptions);
```

When `id` is not in the options object at all, `'id' in options` is `false`, so `shouldRecreateChat` won't trigger on that condition. The Chat gets a random stable ID from `generateId()`.

**Option B -- Generate a stable fallback ID:**
```typescript
const stableFallbackId = useMemo(() => crypto.randomUUID(), []);

const { messages, sendMessage, ... } = useChat({
  id: sessionId ?? stableFallbackId,
  transport,
});
```

This ensures `id` is always a stable string, so the Chat is only recreated when `sessionId` actually changes (e.g., user switches sessions).

**Recommended: Option B** -- it's more explicit and handles the case where a session is created mid-conversation (the Chat ID transitions from the fallback to the real sessionId, properly recreating the Chat and picking up persisted messages).

### Fix 2: Wire `onData` to `useStreamEvents`

The `useChat` hook in AI SDK v6 supports an `onData` callback. The `useStreamEvents` hook already has one ready. They need to be connected:

```typescript
const { onData, toolCalls, thinkingBlocks, ... } = useStreamEvents();

const { messages, sendMessage, ... } = useChat({
  id: sessionId ?? stableFallbackId,
  transport,
  onData,  // <-- Wire the data callback
});
```

However, AI SDK v6's `onData` callback signature may differ from what `useStreamEvents.onData` expects. The SDK passes a `DataUIPart` object:
```typescript
// AI SDK v6 onData signature:
onData?: (dataPart: DataUIPart) => void;
// dataPart = { type: 'data-stream-event', data: { ... }, id?: string }
```

The `useStreamEvents.onData` expects `unknown[]`:
```typescript
// useStreamEvents.onData signature:
onData: (data: unknown[]) => void;
```

These signatures don't match. The `onData` handler in `useStreamEvents` needs to be adapted to accept a single `DataUIPart` instead of an array, or a bridge function needs to be created:

```typescript
const { processEvent, ... } = useStreamEvents();

const handleData = useCallback((dataPart: { type: string; data: unknown }) => {
  if (dataPart.type === 'data-stream-event') {
    const event = dataPart.data;
    if (event && typeof event === 'object' && 'type' in event) {
      processEvent(event as StreamEvent);
    }
  }
}, [processEvent]);

// Then pass to useChat:
useChat({ ..., onData: handleData });
```

### Fix 3: Ensure Session Creation Before Chat

Currently, the user can type and send messages with `sessionId=null`. The server handles this by creating a new session. But the frontend Chat doesn't update its transport body (the transport is memoized on `sessionId`). After the server creates a session, subsequent messages still have `sessionId: null` in the transport body, causing the server to create additional orphaned sessions.

Consider auto-creating a session when the user first sends a message:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const text = input.trim();
  if (!text || isLoading) return;

  // Auto-create session if none exists
  let currentSessionId = sessionId;
  if (!currentSessionId && onCreateSession) {
    const session = await onCreateSession();
    currentSessionId = session.id;
    // Session change will recreate the transport and Chat via useMemo/useChat
  }

  setInput('');
  resetStreamEvents();
  await sendMessage({ text });
};
```

## Files Examined

| File | Role |
|------|------|
| `apps/desktop/src/components/chat/ChatPage.tsx` | Main chat component, wires useChat + useStreamEvents |
| `apps/desktop/src/components/chat/ChatInput.tsx` | Input form component, handles Enter key and form submit |
| `apps/desktop/src/hooks/useStreamEvents.ts` | Custom hook for processing SDK stream events |
| `apps/desktop/src/hooks/useSessions.ts` | Session CRUD operations |
| `apps/desktop/src/App.tsx` | App layout, passes `activeSessionId` (null initially) to ChatPage |
| `apps/server/src/routes/chat.ts` | Server chat route, produces UIMessageStream |
| `apps/server/src/app.ts` | Server setup including CORS config |
| `apps/desktop/package.json` | AI SDK versions: `ai@^6.0.116`, `@ai-sdk/react@^3.0.118` |
| `node_modules/ai/src/ui/chat.ts` | AbstractChat class with `shouldRecreateChat` logic |
| `node_modules/@ai-sdk/react/src/use-chat.ts` | useChat hook implementation |
| `node_modules/ai/src/ui/http-chat-transport.ts` | HttpChatTransport.sendMessages -- builds request body |
| `node_modules/ai/src/ui/default-chat-transport.ts` | DefaultChatTransport -- parses response stream |
| `node_modules/ai/src/ui-message-stream/ui-message-chunks.ts` | UIMessageChunk schema with strict validation |
| `node_modules/@ai-sdk/provider-utils/src/parse-json-event-stream.ts` | Client-side SSE stream parser |

## Verification Steps

After applying Fix 1:
1. Start the app with no active session
2. Type a message and press Enter
3. Verify: user message appears and stays visible
4. Verify: assistant response streams in
5. Verify: network tab shows exactly one POST to `/api/chat`

After applying Fix 2:
6. Verify: tool call states populate in the UI
7. Verify: thinking blocks display
8. Verify: context usage indicator updates
