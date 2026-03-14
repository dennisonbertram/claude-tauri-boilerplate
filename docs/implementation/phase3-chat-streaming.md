# Phase 3: Chat Streaming Route

## Overview

Implements the `/api/chat` endpoint that streams Claude responses to the frontend using the Vercel AI SDK v6 UI message stream protocol. This enables real-time token-by-token streaming of Claude's responses.

## Architecture

```
Frontend (useChat) <--SSE--> POST /api/chat <--> streamClaude() <--> claude-agent-sdk query()
```

### Components

**`apps/server/src/services/claude.ts`** - Claude streaming service
- Wraps `query()` from `@anthropic-ai/claude-agent-sdk`
- Yields typed events: `session` (with sessionId) and `text-delta` (with text content)
- Supports multi-turn via `options.resume` when `sessionId` is provided
- Sets `maxTurns: 1` and `includePartialMessages: true` for streaming

**`apps/server/src/routes/chat.ts`** - Chat HTTP route
- `POST /` accepts `{ messages, sessionId? }` (uses `ChatRequest` from shared types)
- Extracts last user message as prompt
- Streams response via `createUIMessageStream` / `createUIMessageStreamResponse` from AI SDK v6
- Returns claude `sessionId` as `messageMetadata` on the `finish` event
- Returns 400 if no user message is found

## Stream Protocol

Uses AI SDK v6 UI message stream format (SSE):
1. `text-delta` chunks with `{ type: 'text-delta', id, delta }` for each token
2. `finish` event with `{ type: 'finish', finishReason: 'stop', messageMetadata: { sessionId } }`

The frontend can use `useChat()` from the AI SDK to consume this stream natively.

## Multi-turn Support

- First request: no `sessionId` -- creates a new Claude session
- Subsequent requests: include `sessionId` from previous response metadata
- The SDK's `options.resume` loads conversation history for context continuity

## Dependencies Added

- `ai@6.x` - Vercel AI SDK for stream protocol utilities

## Test Coverage

12 tests in `apps/server/src/routes/chat.test.ts`:
- Claude service: session event emission, text-delta streaming, resume option passing, non-text event filtering
- Chat route: valid request streaming, prompt extraction from messages, resume with sessionId, 400 on missing user message, sessionId in metadata, error handling

## Files

| File | Purpose |
|------|---------|
| `apps/server/src/services/claude.ts` | Claude streaming service wrapper |
| `apps/server/src/routes/chat.ts` | POST /api/chat route with SSE streaming |
| `apps/server/src/routes/chat.test.ts` | Tests (12 cases) |
| `apps/server/src/app.ts` | Updated to mount chatRouter at `/api/chat` |
