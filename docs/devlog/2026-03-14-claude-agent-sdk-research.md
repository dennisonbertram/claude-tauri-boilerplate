# Devlog: Claude Agent SDK Research & Testing

**Date:** 2026-03-14
**Topic:** Integrating Claude Code streaming into a Vercel AI SDK app

---

## What We Set Out To Do

The goal was straightforward: wire up Claude Code's agentic streaming into a Next.js API route using Vercel AI SDK, so the frontend's `useChat` hook can consume real-time Claude output the same way it would a regular `streamText` response. I had a reference snippet from a user example and wanted to validate it before building around it.

---

## The Misleading Example

The example code I started with looked like this:

```typescript
import { claude } from "@anthropic-ai/claude-code";

const stream = claude(lastMessage, { abortController: new AbortController() });
```

Looked plausible. Package name matches what you'd find if you Googled "Claude Code SDK." The function name `claude()` is intuitive. The call signature — prompt first, options second — mirrors a lot of other SDK patterns.

It was completely wrong.

---

## What We Discovered

### 1. The Package Rename

`@anthropic-ai/claude-code` is a CLI-only package. No `main`, no `exports`, no importable API surface. It ships a single `cli.js` binary. Attempting to import it as a module:

```
Error: Cannot find package '.../node_modules/@anthropic-ai/claude-code/index.js'
  code: 'ERR_MODULE_NOT_FOUND'
```

Even if you import `cli.js` directly, you get zero exports. The package has been renamed and split:

| Aspect | Old (CLI only) | New (SDK) |
|--------|---------------|-----------|
| Package | `@anthropic-ai/claude-code` v2.1.76 | `@anthropic-ai/claude-agent-sdk` v0.2.76 |
| Importable | No | Yes |
| Primary export | None | `query()` |

### 2. The Correct Function: `query()`, Not `claude()`

Running an export inspection on `@anthropic-ai/claude-agent-sdk`:

```
Has claude: undefined
Has query:  function
```

No `claude()` exists in either package. The primary API is `query()`, which returns an `AsyncGenerator<SDKMessage>`.

### 3. The Argument Shape

The example code passes a bare string as the first argument. The actual signature wraps everything in an options object:

```typescript
// Wrong
claude(lastMessage, { abortController: ... })

// Correct
query({
  prompt: lastMessage,
  options: { abortController: ... }
})
```

---

## Test Results

We ran three explicit tests against `@anthropic-ai/claude-agent-sdk` v0.2.76:

| Test | Result | Notes |
|------|--------|-------|
| Auth via Claude Code subscription | PASS | No `ANTHROPIC_API_KEY` needed |
| Token-level streaming (`stream_event`) | PASS | 2 `text_delta` events for a short response |
| Multi-turn context via `options.resume` | PASS | Turn 2 correctly recalled Turn 1's question |

Actual output from the multi-turn test:

```
=== TURN 1 ===
Prompt: "What is 2 + 2? Answer in exactly one sentence."
Streaming: 2 + 2 equals 4.
[Done - success, cost: $0.029699]

=== TURN 2 (resume via options.resume) ===
Prompt: "What was the math question I just asked you? Repeat the exact numbers."
Resuming session: 7a25bfd7-17b2-48cb-b483-af20530d8813

Streaming: You asked "What is 2 + 2?"
[Done - success, cost: $0.018312]
```

All three passed. The SDK is functional.

---

## The Confirmed Working Pattern

Here is the minimal code that handles auth, token-level streaming, and multi-turn resumption:

```javascript
import { query } from "@anthropic-ai/claude-agent-sdk";

// --- Turn 1 ---
let sessionId = null;

const turn1 = query({
  prompt: "Your first prompt here",
  options: {
    includePartialMessages: true,  // Required for token-level streaming
    maxTurns: 1,
  },
});

for await (const event of turn1) {
  // Capture session ID from the first event
  if (event.type === "system" && event.subtype === "init") {
    sessionId = event.session_id;
  }

  // Token-level streaming events
  if (event.type === "stream_event") {
    const e = event.event;
    if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
      process.stdout.write(e.delta.text);
    }
  }

  if (event.type === "result") {
    console.log(`\n[cost: $${event.total_cost_usd?.toFixed(6)}]`);
  }
}

// --- Turn 2 (resume same session) ---
const turn2 = query({
  prompt: "Follow-up question here",
  options: {
    resume: sessionId,             // This is the key for continuity
    includePartialMessages: true,
    maxTurns: 1,
  },
});

for await (const event of turn2) {
  // Same event handling as above
}
```

The typical event sequence for a single turn looks like:

```
{ type: "system",       subtype: "init",           session_id: "..." }
{ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "..." } } }
  ... more text_delta events ...
{ type: "assistant",    message: { content: [{ type: "text", text: "..." }] } }
{ type: "result",       subtype: "success",         total_cost_usd: 0.029699 }
```

---

## Gotchas

Three things that will silently burn you:

**1. `ANTHROPIC_API_KEY` in your environment breaks subscription auth.**
`query()` spawns the local `claude` CLI binary, which uses your logged-in Claude Code session. If `ANTHROPIC_API_KEY` is set in your shell profile (even to a valid key without credits), it overrides subscription auth and fails. Run with `ANTHROPIC_API_KEY=""` to force subscription auth:

```bash
ANTHROPIC_API_KEY="" node your-script.mjs
```

**2. `options.resume` and `options.continue` are mutually exclusive.**
`resume` takes a specific session UUID. `continue` resumes the most recent session in cwd. Use one or the other, never both.

**3. `options.sessionId` does not resume conversation history.**
Setting `sessionId` pre-names the new session with a UUID, but does not load prior context. To actually resume a conversation, use `options.resume`.

---

## Next Steps

The SDK is confirmed working. The next integration step is wrapping this in a Next.js API route with Vercel AI SDK 5.x:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  const stream = createUIMessageStream({
    async execute({ writer }) {
      const agentStream = query({
        prompt: lastMessage,
        options: { includePartialMessages: true, maxTurns: 5 },
      });

      for await (const event of agentStream) {
        if (event.type === "system" && event.subtype === "init") {
          writer.write({ type: "data-session", data: { sessionId: event.session_id } });
        }

        if (event.type === "stream_event") {
          const e = event.event;
          if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
            const id = `text-${event.uuid}`;
            writer.write({ type: "text-start", id });
            writer.write({ type: "text-delta", id, delta: e.delta.text });
            writer.write({ type: "text-end", id });
          }
        }

        if (event.type === "result") {
          writer.write({
            type: "data-result",
            data: { costUsd: event.total_cost_usd, turns: event.num_turns },
          });
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

The key distinction to sort out before shipping: `writeData()` (AI SDK 4.x) sends JSON to the `data` array in `useChat` — it does not appear as message text. To get text into `message.parts` as renderable content, the AI SDK 5.x `text-start` / `text-delta` / `text-end` pattern shown above is the right approach.

Session resumption across API route invocations will also need a storage layer — the `session_id` from each response needs to come back in the next request body, and the route needs to pass it as `options.resume`.

---

*Sources: `docs/investigations/claude-code-sdk-vercel-ai.md`, `docs/testing/claude-sdk-api-test-results.md`, `docs/testing/multiturn-stream-test-results.md`*
