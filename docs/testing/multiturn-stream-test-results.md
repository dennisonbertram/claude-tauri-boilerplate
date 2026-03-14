# Multi-Turn Streaming Test Results

**Date**: 2026-03-14
**Package**: `@anthropic-ai/claude-agent-sdk` v0.2.76
**Test file**: `test/claude-sdk-test/test-multiturn-stream.mjs`

---

## Test Results Summary

| Test | Result | Detail |
|------|--------|--------|
| 1. Auth via Claude Code subscription | PASS | No API key needed; runs via local `claude` CLI |
| 2. Token-level streaming | PASS | 2 stream_event content_block_delta chars received |
| 3. Multi-turn context retention via `options.resume` | PASS | Turn 2 correctly recalled Turn 1's question |

**Overall: ALL TESTS PASSED**

---

## Actual Test Output

```
=== TURN 1 ===
Prompt: "What is 2 + 2? Answer in exactly one sentence."

Streaming: [Session: 7a25bfd7-17b2-48cb-b483-af20530d8813]
Streaming: 2 + 2 equals 4.
[Done - success, cost: $0.029699]

Streaming chars: 2
Full text: "2 + 2 equals 4."

=== TURN 2 (resume via options.resume) ===
Prompt: "What was the math question I just asked you? Repeat the exact numbers."
Resuming session: 7a25bfd7-17b2-48cb-b483-af20530d8813

Streaming: [Session: 7a25bfd7-17b2-48cb-b483-af20530d8813]
Streaming: You asked "What is 2 + 2?"
[Done - success, cost: $0.018312]

Full text: "You asked "What is 2 + 2?""

==================================================
FINAL TEST RESULTS
==================================================
1. Auth (Claude Code subscription): PASS
2. Token-level streaming:            PASS (2 stream chars)
3. Multi-turn context retention:     PASS

Session ID captured: 7a25bfd7-17b2-48cb-b483-af20530d8813
Turn 1: "2 + 2 equals 4."
Turn 2: "You asked "What is 2 + 2?""

Overall: ALL TESTS PASSED
```

---

## Working Code Pattern

This is the minimal working pattern for all three capabilities:

```js
import { query } from "@anthropic-ai/claude-agent-sdk";

// ─── TURN 1 ──────────────────────────────────────────────────────────────────
let sessionId = null;
let turn1Text = "";

const turn1 = query({
  prompt: "What is 2 + 2? Answer in exactly one sentence.",
  options: {
    includePartialMessages: true,  // REQUIRED for token-level streaming
    maxTurns: 1,
  },
});

process.stdout.write("Streaming: ");
for await (const event of turn1) {
  // Capture session_id from the init event (first event emitted)
  if (event.type === "system" && event.subtype === "init") {
    sessionId = event.session_id;
  }

  // Token-level streaming: listen for stream_event with content_block_delta
  if (event.type === "stream_event") {
    const e = event.event;
    if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
      process.stdout.write(e.delta.text);
      turn1Text += e.delta.text;
    }
  }

  if (event.type === "result") {
    console.log(`\n[cost: $${event.total_cost_usd?.toFixed(6)}]`);
  }
}

// ─── TURN 2 (resume session) ──────────────────────────────────────────────────
const turn2 = query({
  prompt: "What was the math question I just asked you? Repeat the exact numbers.",
  options: {
    resume: sessionId,             // REQUIRED for session continuity
    includePartialMessages: true,
    maxTurns: 1,
  },
});

process.stdout.write("Streaming: ");
for await (const event of turn2) {
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
```

---

## Key Findings

### 1. Authentication

- Authentication uses the local Claude Code installation automatically.
- **No `ANTHROPIC_API_KEY` env var needed** — if it is set (even to a valid key that lacks credits), it will override subscription auth and fail.
- Run with `ANTHROPIC_API_KEY=""` to force subscription auth if the env var is set in your shell profile.
- The underlying mechanism: `query()` spawns the local `claude` CLI binary (found at e.g. `~/.local/bin/claude`), which uses the user's logged-in Claude Code session.

### 2. Token-Level Streaming

- Set `options.includePartialMessages: true` in the query options.
- Listen for events where `event.type === "stream_event"`.
- Within those, check `event.event.type === "content_block_delta"` and `event.event.delta.type === "text_delta"`.
- The token text is at `event.event.delta.text`.
- Note: "streaming chars" counts individual `text_delta` events, not characters. For a short response like "2 + 2 equals 4.", only 2 events fired. Longer responses produce more events.
- If `stream_event` events don't appear, fall back to `event.type === "assistant"` and read `event.message.content[n].text`.

### 3. Multi-Turn Session Resumption

- The first event emitted is always `{ type: "system", subtype: "init", session_id: "<uuid>" }`.
- Capture `event.session_id` from this event.
- Pass it as `options.resume` in subsequent `query()` calls.
- The resumed session uses the **same session ID** (confirmed: same UUID appeared in Turn 2's init event).
- Turn 2 successfully recalled context from Turn 1, proving conversation history is loaded.
- `options.resume` is mutually exclusive with `options.continue` (the `continue` option resumes the most recent session in cwd without specifying an ID).

### 4. Event Sequence

Typical event sequence for a single turn:

```
{ type: "system", subtype: "init", session_id: "..." }
{ type: "stream_event", event: { type: "message_start", ... } }
{ type: "stream_event", event: { type: "content_block_start", ... } }
{ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "..." } } }
  ... (more content_block_delta events per token) ...
{ type: "stream_event", event: { type: "content_block_stop", ... } }
{ type: "stream_event", event: { type: "message_delta", ... } }
{ type: "stream_event", event: { type: "message_stop", ... } }
{ type: "assistant", message: { content: [{ type: "text", text: "..." }] } }
{ type: "result", subtype: "success", total_cost_usd: 0.029699 }
```

### 5. Gotchas

- `ANTHROPIC_API_KEY` in environment silently overrides subscription auth. Always unset or blank it for subscription use.
- `options.resume` and `options.continue` are mutually exclusive. Using both will cause an error.
- `options.sessionId` (pre-specify a UUID) does NOT automatically resume conversation history — it just names the session. To resume history, use `options.resume`.
- The `stream_event` text deltas fire at word/chunk granularity (not character-by-character). Short responses may only emit 1-3 text_delta events.
- Costs are per-turn and cumulative across resumed sessions. Turn 1 cost $0.030, Turn 2 cost $0.018 (cheaper due to shorter response, though history loading adds input tokens).

---

## Other Useful `query()` Options

From `sdk.d.ts`:

```typescript
options: {
  // Session control
  resume?: string;              // UUID to resume (loads conversation history)
  sessionId?: string;           // Pre-set session UUID (does NOT load history)
  continue?: boolean;           // Resume most recent session in cwd
  forkSession?: boolean;        // Fork instead of continue when resuming
  persistSession?: boolean;     // default true; set false for ephemeral

  // Streaming
  includePartialMessages?: boolean;  // Emit stream_event events for token streaming

  // Limits
  maxTurns?: number;
  maxBudgetUsd?: number;

  // Model
  model?: string;               // e.g. 'claude-sonnet-4-6', 'claude-opus-4-6'
  effort?: 'low' | 'medium' | 'high' | 'max';
  thinking?: { type: 'disabled' } | { type: 'adaptive' } | { type: 'enabled', budgetTokens: number };

  // Tools
  tools?: string[];             // e.g. ['Bash', 'Read', 'Edit']
  allowedTools?: string[];
  disallowedTools?: string[];

  // Auth override
  env?: Record<string, string>; // Override env vars passed to claude subprocess
}
```

---

## Session Management Functions

The SDK also exports these for programmatic session management:

```typescript
import { listSessions, getSessionMessages, forkSession, renameSession } from "@anthropic-ai/claude-agent-sdk";

// List all sessions
const sessions = await listSessions();

// Get messages from a session
const messages = await getSessionMessages(sessionId);

// Fork a session (creates a copy at a branch point)
const { sessionId: newSessionId } = await forkSession(sessionId);

// Rename a session for identification
await renameSession(sessionId, "My conversation title");
```

---

## Alternative: Multi-Turn via AsyncIterable Prompt

Instead of two `query()` calls with `options.resume`, you can pass an `AsyncIterable<SDKUserMessage>` as the `prompt` parameter. This keeps a single Claude subprocess alive and streams multiple user messages into it:

```js
async function* multiTurnMessages() {
  yield { role: "user", content: "What is 2 + 2?" };
  // ... wait for assistant response if needed ...
  yield { role: "user", content: "What was the number I asked about?" };
}

const conversation = query({
  prompt: multiTurnMessages(),
  options: { includePartialMessages: true, maxTurns: 2 },
});

for await (const event of conversation) {
  // Handle events for both turns in one loop
}
```

This approach keeps a single Claude process alive vs. spawning two. The `options.resume` approach is simpler for sequential use cases.
