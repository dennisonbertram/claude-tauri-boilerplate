# Issue #5: Complete SDK Event Handling

**Status:** Not Started
**Issue:** [#5 - Complete SDK Event Handling: Process all 17+ SDKMessage event types](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/5)
**Priority:** P0-critical
**Labels:** feature, sdk-integration

---

## 1. Complete List of All SDKMessage Event Types

The `query()` async generator yields a discriminated union of 20 event types. Below is each type with its full TypeScript interface as sourced from the official Claude Agent SDK documentation (context7: `/websites/platform_claude_en_agent-sdk`).

### 1.1 `SDKSystemMessage` (type: `"system"`, subtype: `"init"`)

First event emitted. Contains session metadata.

```typescript
type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  uuid: string;
  session_id: string;
  agents?: string[];
  apiKeySource: string; // ApiKeySource enum
  betas?: string[];
  claude_code_version: string;
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  model: string;
  permissionMode: string; // PermissionMode enum
  slash_commands: string[];
  output_style: string;
  skills: string[];
  plugins: { name: string; path: string }[];
};
```

### 1.2 `SDKAssistantMessage` (type: `"assistant"`)

Full response from Claude. Contains content blocks (text, tool_use, thinking).

```typescript
type SDKAssistantMessage = {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: {
    id: string;
    type: "message";
    role: "assistant";
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      | { type: "thinking"; thinking: string }
    >;
    model: string;
    stop_reason: string | null;
    usage: { input_tokens: number; output_tokens: number };
  };
  parent_tool_use_id: string | null;
  error?: "authentication_failed" | "billing_error" | "rate_limit"
        | "invalid_request" | "server_error" | "unknown";
};
```

### 1.3 `SDKUserMessage` (type: `"user"`)

Echoed user input or synthetic tool results.

```typescript
type SDKUserMessage = {
  type: "user";
  uuid?: string;
  session_id: string;
  message: unknown; // MessageParam from Anthropic SDK
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
};
```

### 1.4 `SDKUserMessageReplay` (type: `"user"`, isReplay: true)

Replayed user messages during session resume.

```typescript
type SDKUserMessageReplay = {
  type: "user";
  uuid: string;
  session_id: string;
  message: unknown; // MessageParam
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
  isReplay: true;
};
```

### 1.5 `SDKResultMessage` (type: `"result"`)

Always the last event. Two variants: success and error.

```typescript
// Success variant
type SDKResultSuccess = {
  type: "result";
  subtype: "success";
  uuid: string;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;
  stop_reason: string | null;
  total_cost_usd: number;
  usage: { input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number };
  modelUsage: Record<string, { input_tokens: number; output_tokens: number }>;
  permission_denials: Array<{ tool: string; reason: string }>;
  structured_output?: unknown;
};

// Error variant
type SDKResultError = {
  type: "result";
  subtype: "error_max_turns" | "error_during_execution"
         | "error_max_budget_usd" | "error_max_structured_output_retries";
  uuid: string;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  stop_reason: string | null;
  total_cost_usd: number;
  usage: { input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number };
  modelUsage: Record<string, { input_tokens: number; output_tokens: number }>;
  permission_denials: Array<{ tool: string; reason: string }>;
  errors: string[];
};

type SDKResultMessage = SDKResultSuccess | SDKResultError;
```

### 1.6 `SDKPartialAssistantMessage` (type: `"stream_event"`)

Token-level streaming. Only emitted when `includePartialMessages: true`.

```typescript
type SDKPartialAssistantMessage = {
  type: "stream_event";
  event: {
    type: "message_start" | "content_block_start" | "content_block_delta"
        | "content_block_stop" | "message_delta" | "message_stop";
    // Fields vary by event.type:
    // message_start: { message: {...} }
    // content_block_start: { content_block: { type: string; ... }; index: number }
    // content_block_delta: { delta: { type: "text_delta"; text: string } | { type: "thinking_delta"; thinking: string } | { type: "input_json_delta"; partial_json: string }; index: number }
    // content_block_stop: { index: number }
    // message_delta: { delta: { stop_reason: string }; usage: { output_tokens: number } }
    // message_stop: {}
    [key: string]: unknown;
  };
  parent_tool_use_id: string | null;
  uuid: string;
  session_id: string;
};
```

### 1.7 `SDKCompactBoundaryMessage` (type: `"system"`, subtype: `"compact_boundary"`)

Emitted when conversation context is compacted.

```typescript
type SDKCompactBoundaryMessage = {
  type: "system";
  subtype: "compact_boundary";
};
```

### 1.8 `SDKStatusMessage` (type: `"system"`, subtype: `"status"`)

System status updates (e.g., compacting).

```typescript
type SDKStatusMessage = {
  type: "system";
  subtype: "status";
  status: "compacting" | null;
  permissionMode?: string;
  uuid: string;
  session_id: string;
};
```

### 1.9 `SDKHookStartedMessage` (type: `"system"`, subtype: `"hook_started"`)

```typescript
type SDKHookStartedMessage = {
  type: "system";
  subtype: "hook_started";
  hook_id: string;
  hook_name: string;
  hook_event: string;
  uuid: string;
  session_id: string;
};
```

### 1.10 `SDKHookProgressMessage` (type: `"system"`, subtype: `"hook_progress"`)

```typescript
type SDKHookProgressMessage = {
  type: "system";
  subtype: "hook_progress";
  hook_id: string;
  hook_name: string;
  hook_event: string;
  stdout: string;
  stderr: string;
  output: string;
  uuid: string;
  session_id: string;
};
```

### 1.11 `SDKHookResponseMessage` (type: `"system"`, subtype: `"hook_response"`)

```typescript
type SDKHookResponseMessage = {
  type: "system";
  subtype: "hook_response";
  hook_id: string;
  hook_name: string;
  hook_event: string;
  response: unknown; // Hook-specific response object
  uuid: string;
  session_id: string;
};
```

### 1.12 `SDKToolProgressMessage` (type: `"tool_progress"`)

```typescript
type SDKToolProgressMessage = {
  type: "tool_progress";
  tool_use_id: string;
  tool_name: string;
  parent_tool_use_id: string | null;
  elapsed_time_seconds: number;
  task_id?: string;
  uuid: string;
  session_id: string;
};
```

### 1.13 `SDKAuthStatusMessage` (type: `"auth_status"`)

```typescript
type SDKAuthStatusMessage = {
  type: "auth_status";
  isAuthenticating: boolean;
  output: string[];
  error?: string;
  uuid: string;
  session_id: string;
};
```

### 1.14 `SDKTaskNotificationMessage` (type: `"system"`, subtype: `"task_notification"`)

```typescript
type SDKTaskNotificationMessage = {
  type: "system";
  subtype: "task_notification";
  task_id: string;
  tool_use_id?: string;
  status: "completed" | "failed" | "stopped";
  output_file: string;
  summary: string;
  usage?: {
    total_tokens: number;
    tool_uses: number;
    duration_ms: number;
  };
  uuid: string;
  session_id: string;
};
```

### 1.15 `SDKTaskStartedMessage` (type: `"system"`, subtype: `"task_started"`)

```typescript
type SDKTaskStartedMessage = {
  type: "system";
  subtype: "task_started";
  task_id: string;
  tool_use_id?: string;
  description: string;
  task_type?: string;
  uuid: string;
  session_id: string;
};
```

### 1.16 `SDKTaskProgressMessage` (type: `"system"`, subtype: `"task_progress"`)

```typescript
type SDKTaskProgressMessage = {
  type: "system";
  subtype: "task_progress";
  task_id: string;
  tool_use_id?: string;
  progress: unknown; // Task-specific progress data
  uuid: string;
  session_id: string;
};
```

### 1.17 `SDKFilesPersistedEvent` (type: `"system"`, subtype: `"files_persisted"`)

```typescript
type SDKFilesPersistedEvent = {
  type: "system";
  subtype: "files_persisted";
  files: string[]; // Paths to persisted files
  uuid: string;
  session_id: string;
};
```

### 1.18 `SDKToolUseSummaryMessage` (type: `"system"`, subtype: `"tool_use_summary"`)

```typescript
type SDKToolUseSummaryMessage = {
  type: "system";
  subtype: "tool_use_summary";
  tool_name: string;
  tool_use_id: string;
  summary: string;
  uuid: string;
  session_id: string;
};
```

### 1.19 `SDKRateLimitEvent` (type: `"system"`, subtype: `"rate_limit"`)

```typescript
type SDKRateLimitEvent = {
  type: "system";
  subtype: "rate_limit";
  retry_after_seconds?: number;
  uuid: string;
  session_id: string;
};
```

### 1.20 `SDKPromptSuggestionMessage` (type: `"system"`, subtype: `"prompt_suggestion"`)

```typescript
type SDKPromptSuggestionMessage = {
  type: "system";
  subtype: "prompt_suggestion";
  suggestions: string[];
  uuid: string;
  session_id: string;
};
```

---

## 2. Current Handling -- What Is Handled Now

### Backend: `apps/server/src/services/claude.ts`

The `streamClaude()` generator currently yields only **2 event types**:

| SDK Event | Current Handling | Yielded As |
|-----------|-----------------|------------|
| `SDKSystemMessage` (init) | Extracts `session_id` | `{ type: 'session', sessionId }` |
| `SDKPartialAssistantMessage` (stream_event with `content_block_delta` + `text_delta`) | Extracts `delta.text` | `{ type: 'text-delta', text }` |

**Everything else is silently dropped.**

The current `ClaudeStreamEvent` type is:
```typescript
export type ClaudeStreamEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'text-delta'; text: string };
```

### Backend: `apps/server/src/routes/chat.ts`

The chat route maps `ClaudeStreamEvent` to AI SDK v6 `UIMessageStream` format:
- `session` -> stores `claudeSessionId` internally
- `text-delta` -> `writer.write({ type: 'text-delta', id: 'text-0', delta })` with start/text-start preamble
- Finishes with `{ type: 'finish', finishReason: 'stop', messageMetadata: { sessionId } }`

### Frontend: `apps/desktop/src/components/chat/MessageList.tsx`

The `MessageBubble` component only renders `text` parts from `UIMessage.parts`. No support for:
- Tool call blocks
- Thinking blocks
- Error display
- Progress indicators
- Metadata display

### Frontend: `apps/desktop/src/components/chat/ChatPage.tsx`

Uses `useChat()` from `@ai-sdk/react` with `DefaultChatTransport`. No custom event handling beyond what the AI SDK provides natively.

---

## 3. Gap Analysis -- What Is NOT Handled

### Critical Gaps (blocks core features)

| Event | Impact | Priority |
|-------|--------|----------|
| `SDKAssistantMessage` (tool_use blocks) | Tool calls invisible; can't show file edits, bash output, searches | P0 |
| `SDKAssistantMessage` (thinking blocks) | Extended thinking hidden from user | P1 |
| `SDKResultMessage` (success) | No cost/usage/duration info displayed | P1 |
| `SDKResultMessage` (error variants) | Errors silently swallowed; user sees nothing | P0 |
| `SDKUserMessage` (synthetic/tool results) | Tool output invisible; can't close the tool call UI loop | P0 |
| `SDKPartialAssistantMessage` (thinking_delta) | Thinking tokens not streamed | P1 |
| `SDKPartialAssistantMessage` (input_json_delta) | Tool call input not incrementally displayed | P2 |
| `SDKPartialAssistantMessage` (content_block_start/stop) | No block lifecycle tracking for UI state | P1 |

### Important Gaps (degrades experience)

| Event | Impact | Priority |
|-------|--------|----------|
| `SDKToolProgressMessage` | No "running for Xs" progress indicator on long tool calls | P1 |
| `SDKRateLimitEvent` | User sees freeze with no explanation during rate limits | P1 |
| `SDKStatusMessage` (compacting) | User doesn't know context is being compacted | P2 |
| `SDKCompactBoundaryMessage` | No visual indicator of context compaction | P2 |
| `SDKAuthStatusMessage` | Auth errors invisible | P1 |
| `SDKAssistantMessage` (error field) | API errors on individual messages not shown | P1 |

### Lower Priority Gaps (nice to have for MVP)

| Event | Impact | Priority |
|-------|--------|----------|
| `SDKHookStartedMessage` | Hook activity invisible | P3 |
| `SDKHookProgressMessage` | Hook progress invisible | P3 |
| `SDKHookResponseMessage` | Hook results invisible | P3 |
| `SDKTaskStartedMessage` | Subagent starts invisible | P2 |
| `SDKTaskProgressMessage` | Subagent progress invisible | P2 |
| `SDKTaskNotificationMessage` | Subagent completion invisible | P2 |
| `SDKFilesPersistedEvent` | File save notifications missing | P2 |
| `SDKToolUseSummaryMessage` | Tool summaries not shown | P2 |
| `SDKPromptSuggestionMessage` | No follow-up prompt suggestions | P2 |
| `SDKUserMessageReplay` | Replayed messages during resume not handled | P3 |

---

## 4. Event-to-UI Mapping

This maps each SDK event type to the frontend component/behavior it should drive.

| SDK Event | UI Component / Behavior | Description |
|-----------|------------------------|-------------|
| `SDKSystemMessage` (init) | `SessionMetadata` (new) | Display model, tools count, MCP servers in session header |
| `SDKAssistantMessage` (text) | `MessageBubble` (existing, enhance) | Render markdown text blocks |
| `SDKAssistantMessage` (tool_use) | `ToolCallBlock` (new) | Collapsible block: tool name, input params, spinner while running |
| `SDKAssistantMessage` (thinking) | `ThinkingBlock` (new) | Collapsible "thinking" section, dimmed/italic styling |
| `SDKAssistantMessage` (error) | `ErrorBanner` (new) | Red banner in message stream with error type |
| `SDKUserMessage` (synthetic) | `ToolResultBlock` (new) | Tool output displayed under its parent `ToolCallBlock` |
| `SDKResultMessage` (success) | `SessionStats` (new) | Cost, duration, turns shown in footer or metadata |
| `SDKResultMessage` (error) | `ErrorBanner` (new) | Prominent error display with error subtype |
| `SDKPartialAssistantMessage` (text_delta) | `MessageBubble` (existing) | Append text tokens in real-time |
| `SDKPartialAssistantMessage` (thinking_delta) | `ThinkingBlock` (new) | Stream thinking tokens in real-time |
| `SDKPartialAssistantMessage` (input_json_delta) | `ToolCallBlock` (new) | Incrementally show tool input |
| `SDKPartialAssistantMessage` (content_block_start) | State management | Open new block in message state |
| `SDKPartialAssistantMessage` (content_block_stop) | State management | Close block, mark complete |
| `SDKToolProgressMessage` | `ToolCallBlock` (new) | Show elapsed time on running tool |
| `SDKRateLimitEvent` | `RateLimitBanner` (new) | Yellow banner: "Rate limited. Retrying in Xs..." |
| `SDKStatusMessage` (compacting) | `StatusIndicator` (new) | Subtle indicator: "Compacting context..." |
| `SDKCompactBoundaryMessage` | `CompactDivider` (new) | Visual divider in message stream |
| `SDKAuthStatusMessage` | `AuthGate` (existing, enhance) | Update auth state, show auth errors |
| `SDKHookStartedMessage` | `HookIndicator` (new, low-pri) | Small indicator showing hook activity |
| `SDKHookProgressMessage` | `HookIndicator` (new, low-pri) | Hook progress in indicator |
| `SDKHookResponseMessage` | `HookIndicator` (new, low-pri) | Hook result |
| `SDKTaskStartedMessage` | `TaskPanel` (new, low-pri) | Subagent task started notification |
| `SDKTaskProgressMessage` | `TaskPanel` (new, low-pri) | Subagent progress |
| `SDKTaskNotificationMessage` | `TaskPanel` (new, low-pri) | Subagent completed/failed |
| `SDKFilesPersistedEvent` | `FilesIndicator` (new) | Toast or indicator: "Files saved" |
| `SDKToolUseSummaryMessage` | `ToolCallBlock` (new) | Summary text in collapsed tool block |
| `SDKPromptSuggestionMessage` | `SuggestionChips` (new) | Clickable suggestion buttons below response |

---

## 5. Shared Types to Add

All new types go in `packages/shared/src/types.ts`. These are the **application-level** event types that flow over the SSE stream from server to frontend. They are NOT the raw SDK types -- they are our own serializable types that both backend and frontend import.

### 5.1 Content Block Types

```typescript
// Content blocks within an assistant message
export type TextBlock = {
  type: 'text';
  text: string;
};

export type ToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ThinkingBlock = {
  type: 'thinking';
  thinking: string;
};

export type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock;
```

### 5.2 Stream Event Types (Server -> Frontend over SSE)

```typescript
// --- Events sent from backend to frontend over the SSE stream ---

export type StreamEvent =
  // Session lifecycle
  | StreamSessionInit
  | StreamSessionResult
  // Content streaming
  | StreamTextDelta
  | StreamThinkingDelta
  | StreamToolInputDelta
  | StreamBlockStart
  | StreamBlockStop
  // Complete messages
  | StreamAssistantMessage
  | StreamToolResult
  // Tool progress
  | StreamToolProgress
  // Errors
  | StreamError
  // Status
  | StreamStatus
  | StreamRateLimit
  | StreamCompactBoundary
  // Auth
  | StreamAuthStatus
  // Tasks (subagents)
  | StreamTaskStarted
  | StreamTaskProgress
  | StreamTaskNotification
  // Hooks
  | StreamHookStarted
  | StreamHookProgress
  | StreamHookResponse
  // Misc
  | StreamFilesPersisted
  | StreamToolUseSummary
  | StreamPromptSuggestion;

// Session initialization
export interface StreamSessionInit {
  type: 'session:init';
  sessionId: string;
  model: string;
  tools: string[];
  mcpServers: Array<{ name: string; status: string }>;
  claudeCodeVersion: string;
}

// Session result (final event)
export interface StreamSessionResult {
  type: 'session:result';
  success: boolean;
  subtype: string;
  costUsd: number;
  durationMs: number;
  numTurns: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  errors?: string[];
}

// Text token delta
export interface StreamTextDelta {
  type: 'text:delta';
  text: string;
  blockIndex: number;
}

// Thinking token delta
export interface StreamThinkingDelta {
  type: 'thinking:delta';
  thinking: string;
  blockIndex: number;
}

// Tool input JSON delta
export interface StreamToolInputDelta {
  type: 'tool-input:delta';
  partialJson: string;
  blockIndex: number;
}

// Content block lifecycle
export interface StreamBlockStart {
  type: 'block:start';
  blockIndex: number;
  blockType: 'text' | 'tool_use' | 'thinking';
  // For tool_use blocks:
  toolUseId?: string;
  toolName?: string;
}

export interface StreamBlockStop {
  type: 'block:stop';
  blockIndex: number;
}

// Complete assistant message (non-streaming fallback)
export interface StreamAssistantMessage {
  type: 'assistant:message';
  uuid: string;
  blocks: ContentBlock[];
  parentToolUseId: string | null;
  error?: string;
}

// Tool result (synthetic user message)
export interface StreamToolResult {
  type: 'tool:result';
  toolUseId: string;
  result: unknown;
}

// Tool execution progress
export interface StreamToolProgress {
  type: 'tool:progress';
  toolUseId: string;
  toolName: string;
  elapsedSeconds: number;
}

// Error events
export interface StreamError {
  type: 'error';
  errorType: string; // 'authentication_failed' | 'rate_limit' | 'server_error' | etc.
  message: string;
}

// Status updates
export interface StreamStatus {
  type: 'status';
  status: 'compacting' | null;
}

// Rate limit
export interface StreamRateLimit {
  type: 'rate-limit';
  retryAfterSeconds?: number;
}

// Compact boundary
export interface StreamCompactBoundary {
  type: 'compact-boundary';
}

// Auth status
export interface StreamAuthStatus {
  type: 'auth:status';
  isAuthenticating: boolean;
  output: string[];
  error?: string;
}

// Task (subagent) events
export interface StreamTaskStarted {
  type: 'task:started';
  taskId: string;
  description: string;
  taskType?: string;
}

export interface StreamTaskProgress {
  type: 'task:progress';
  taskId: string;
  progress: unknown;
}

export interface StreamTaskNotification {
  type: 'task:notification';
  taskId: string;
  status: 'completed' | 'failed' | 'stopped';
  summary: string;
  usage?: { totalTokens: number; toolUses: number; durationMs: number };
}

// Hook events
export interface StreamHookStarted {
  type: 'hook:started';
  hookId: string;
  hookName: string;
  hookEvent: string;
}

export interface StreamHookProgress {
  type: 'hook:progress';
  hookId: string;
  hookName: string;
  output: string;
}

export interface StreamHookResponse {
  type: 'hook:response';
  hookId: string;
  hookName: string;
  response: unknown;
}

// Files persisted
export interface StreamFilesPersisted {
  type: 'files:persisted';
  files: string[];
}

// Tool use summary
export interface StreamToolUseSummary {
  type: 'tool:summary';
  toolUseId: string;
  toolName: string;
  summary: string;
}

// Prompt suggestions
export interface StreamPromptSuggestion {
  type: 'prompt:suggestion';
  suggestions: string[];
}
```

### 5.3 Updated ChatRequest (extend existing)

```typescript
export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  }>;
  sessionId?: string;
}
```

---

## 6. Backend Changes

### 6.1 New file: `apps/server/src/services/event-mapper.ts`

This module maps raw `SDKMessage` events to our application `StreamEvent` types.

**Purpose:** Single responsibility -- takes a raw SDK event, returns zero or more `StreamEvent` objects. Pure function, easily testable.

```typescript
// apps/server/src/services/event-mapper.ts

import type { StreamEvent } from '@claude-tauri/shared';

/**
 * Maps a raw SDK event to zero or more application StreamEvents.
 * Returns an array because some SDK events map to multiple stream events.
 */
export function mapSdkEvent(event: any): StreamEvent[] {
  switch (event.type) {
    case 'system':
      return mapSystemEvent(event);
    case 'assistant':
      return mapAssistantEvent(event);
    case 'user':
      return mapUserEvent(event);
    case 'result':
      return mapResultEvent(event);
    case 'stream_event':
      return mapStreamEvent(event);
    case 'tool_progress':
      return mapToolProgress(event);
    case 'auth_status':
      return mapAuthStatus(event);
    default:
      console.warn(`[event-mapper] Unhandled SDK event type: ${event.type}`);
      return [];
  }
}

function mapSystemEvent(event: any): StreamEvent[] {
  switch (event.subtype) {
    case 'init':
      return [{
        type: 'session:init',
        sessionId: event.session_id,
        model: event.model,
        tools: event.tools,
        mcpServers: event.mcp_servers,
        claudeCodeVersion: event.claude_code_version,
      }];
    case 'compact_boundary':
      return [{ type: 'compact-boundary' }];
    case 'status':
      return [{ type: 'status', status: event.status }];
    case 'rate_limit':
      return [{ type: 'rate-limit', retryAfterSeconds: event.retry_after_seconds }];
    case 'hook_started':
      return [{
        type: 'hook:started',
        hookId: event.hook_id,
        hookName: event.hook_name,
        hookEvent: event.hook_event,
      }];
    case 'hook_progress':
      return [{
        type: 'hook:progress',
        hookId: event.hook_id,
        hookName: event.hook_name,
        output: event.output,
      }];
    case 'hook_response':
      return [{
        type: 'hook:response',
        hookId: event.hook_id,
        hookName: event.hook_name,
        response: event.response,
      }];
    case 'task_started':
      return [{
        type: 'task:started',
        taskId: event.task_id,
        description: event.description,
        taskType: event.task_type,
      }];
    case 'task_progress':
      return [{
        type: 'task:progress',
        taskId: event.task_id,
        progress: event.progress,
      }];
    case 'task_notification':
      return [{
        type: 'task:notification',
        taskId: event.task_id,
        status: event.status,
        summary: event.summary,
        usage: event.usage ? {
          totalTokens: event.usage.total_tokens,
          toolUses: event.usage.tool_uses,
          durationMs: event.usage.duration_ms,
        } : undefined,
      }];
    case 'files_persisted':
      return [{ type: 'files:persisted', files: event.files }];
    case 'tool_use_summary':
      return [{
        type: 'tool:summary',
        toolUseId: event.tool_use_id,
        toolName: event.tool_name,
        summary: event.summary,
      }];
    case 'prompt_suggestion':
      return [{ type: 'prompt:suggestion', suggestions: event.suggestions }];
    default:
      console.warn(`[event-mapper] Unhandled system subtype: ${event.subtype}`);
      return [];
  }
}

function mapAssistantEvent(event: any): StreamEvent[] {
  const events: StreamEvent[] = [];

  // Map content blocks
  const blocks = (event.message?.content || []).map((block: any) => {
    if (block.type === 'text') return { type: 'text' as const, text: block.text };
    if (block.type === 'tool_use') return {
      type: 'tool_use' as const,
      id: block.id,
      name: block.name,
      input: block.input,
    };
    if (block.type === 'thinking') return {
      type: 'thinking' as const,
      thinking: block.thinking,
    };
    return block;
  });

  events.push({
    type: 'assistant:message',
    uuid: event.uuid,
    blocks,
    parentToolUseId: event.parent_tool_use_id,
    error: event.error,
  });

  // If there's an error on the assistant message itself
  if (event.error) {
    events.push({
      type: 'error',
      errorType: event.error,
      message: `Assistant error: ${event.error}`,
    });
  }

  return events;
}

function mapUserEvent(event: any): StreamEvent[] {
  // Only forward synthetic (tool result) messages
  if (event.isSynthetic && event.parent_tool_use_id) {
    return [{
      type: 'tool:result',
      toolUseId: event.parent_tool_use_id,
      result: event.tool_use_result,
    }];
  }
  // Skip replay messages and regular user echoes
  return [];
}

function mapResultEvent(event: any): StreamEvent[] {
  const result: StreamEvent[] = [{
    type: 'session:result',
    success: event.subtype === 'success',
    subtype: event.subtype,
    costUsd: event.total_cost_usd,
    durationMs: event.duration_ms,
    numTurns: event.num_turns,
    usage: {
      inputTokens: event.usage?.input_tokens ?? 0,
      outputTokens: event.usage?.output_tokens ?? 0,
      cacheReadTokens: event.usage?.cache_read_tokens ?? 0,
      cacheCreationTokens: event.usage?.cache_creation_tokens ?? 0,
    },
    errors: event.errors,
  }];

  // Also emit an error event for error results
  if (event.subtype !== 'success' && event.errors?.length) {
    result.push({
      type: 'error',
      errorType: event.subtype,
      message: event.errors.join('; '),
    });
  }

  return result;
}

function mapStreamEvent(event: any): StreamEvent[] {
  const inner = event.event;
  if (!inner) return [];

  switch (inner.type) {
    case 'content_block_start': {
      const block = inner.content_block;
      const streamEvent: StreamEvent = {
        type: 'block:start',
        blockIndex: inner.index,
        blockType: block?.type ?? 'text',
      };
      if (block?.type === 'tool_use') {
        (streamEvent as any).toolUseId = block.id;
        (streamEvent as any).toolName = block.name;
      }
      return [streamEvent];
    }

    case 'content_block_delta': {
      const delta = inner.delta;
      if (delta?.type === 'text_delta') {
        return [{ type: 'text:delta', text: delta.text, blockIndex: inner.index }];
      }
      if (delta?.type === 'thinking_delta') {
        return [{ type: 'thinking:delta', thinking: delta.thinking, blockIndex: inner.index }];
      }
      if (delta?.type === 'input_json_delta') {
        return [{ type: 'tool-input:delta', partialJson: delta.partial_json, blockIndex: inner.index }];
      }
      return [];
    }

    case 'content_block_stop':
      return [{ type: 'block:stop', blockIndex: inner.index }];

    case 'message_start':
    case 'message_delta':
    case 'message_stop':
      // These are informational; we don't need to forward them to the UI
      // The content is captured via content_block events
      return [];

    default:
      return [];
  }
}

function mapToolProgress(event: any): StreamEvent[] {
  return [{
    type: 'tool:progress',
    toolUseId: event.tool_use_id,
    toolName: event.tool_name,
    elapsedSeconds: event.elapsed_time_seconds,
  }];
}

function mapAuthStatus(event: any): StreamEvent[] {
  return [{
    type: 'auth:status',
    isAuthenticating: event.isAuthenticating,
    output: event.output,
    error: event.error,
  }];
}
```

### 6.2 Update: `apps/server/src/services/claude.ts`

Replace the minimal `ClaudeStreamEvent` type with the full `StreamEvent` type and use the event mapper.

```typescript
// apps/server/src/services/claude.ts

import { query } from '@anthropic-ai/claude-agent-sdk';
import { mapSdkEvent } from './event-mapper';
import type { StreamEvent } from '@claude-tauri/shared';

export interface ClaudeStreamOptions {
  prompt: string;
  sessionId?: string;
}

export async function* streamClaude(
  options: ClaudeStreamOptions
): AsyncGenerator<StreamEvent> {
  const queryOptions: Record<string, unknown> = {
    includePartialMessages: true,
    maxTurns: 10, // Allow multi-turn tool use
    permissionMode: 'bypassPermissions', // MVP: auto-approve
  };

  if (options.sessionId) {
    queryOptions.resume = options.sessionId;
  }

  const stream = query({
    prompt: options.prompt,
    options: queryOptions,
  });

  for await (const event of stream) {
    const mapped = mapSdkEvent(event);
    for (const streamEvent of mapped) {
      yield streamEvent;
    }
  }
}
```

### 6.3 Update: `apps/server/src/routes/chat.ts`

Redesign to emit our custom `StreamEvent` types alongside the AI SDK protocol. The key insight: we need to send BOTH the AI SDK v6 protocol events (for `useChat()` compatibility) AND our custom events (for rich UI). We do this by using AI SDK's `data` channel for custom events.

```typescript
// apps/server/src/routes/chat.ts

import { Hono } from 'hono';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { streamClaude } from '../services/claude';
import type { ChatRequest, StreamEvent } from '@claude-tauri/shared';

const chatRouter = new Hono();

chatRouter.post('/', async (c) => {
  const body = (await c.req.json()) as ChatRequest;
  const messages = body.messages || [];
  const sessionId = body.sessionId;

  const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop() as any;
  if (!lastUserMessage) {
    return c.json({ error: 'No user message provided' }, 400);
  }

  const prompt: string = lastUserMessage.content
    ?? lastUserMessage.parts
      ?.filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('')
    ?? '';

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let claudeSessionId: string | undefined;
      let startSent = false;
      // Track active content blocks for proper text ID management
      let currentTextId = 0;
      let activeTextBlockIndex: number | null = null;

      for await (const event of streamClaude({ prompt, sessionId })) {
        // Send every event as data for the custom event handler
        writer.write({ type: 'data', data: [event] });

        // Also map key events to AI SDK protocol for useChat() compatibility
        switch (event.type) {
          case 'session:init':
            claudeSessionId = event.sessionId;
            break;

          case 'text:delta':
            if (!startSent) {
              writer.write({ type: 'start' });
              writer.write({ type: 'text-start', id: `text-${currentTextId}` });
              startSent = true;
              activeTextBlockIndex = event.blockIndex;
            } else if (event.blockIndex !== activeTextBlockIndex) {
              // New text block -- close previous and start new
              writer.write({ type: 'text-end', id: `text-${currentTextId}` });
              currentTextId++;
              writer.write({ type: 'text-start', id: `text-${currentTextId}` });
              activeTextBlockIndex = event.blockIndex;
            }
            writer.write({
              type: 'text-delta',
              id: `text-${currentTextId}`,
              delta: event.text,
            });
            break;

          case 'error':
            writer.write({
              type: 'error',
              errorCode: event.errorType,
              errorText: event.message,
            });
            break;

          case 'session:result':
            // Result comes through on data channel
            break;
        }
      }

      // Finish the AI SDK stream
      writer.write({
        type: 'finish',
        finishReason: 'stop',
        messageMetadata: { sessionId: claudeSessionId },
      });
    },
    onError: (error) => {
      return error instanceof Error ? error.message : 'Stream error';
    },
  });

  return createUIMessageStreamResponse({ stream });
});

export { chatRouter };
```

---

## 7. Frontend Changes

### 7.1 New hook: `apps/desktop/src/hooks/useStreamEvents.ts`

Custom hook that processes the `data` channel from the AI SDK `useChat` and dispatches events to a reducer.

```typescript
// apps/desktop/src/hooks/useStreamEvents.ts

import { useCallback, useReducer } from 'react';
import type {
  StreamEvent,
  StreamSessionInit,
  StreamSessionResult,
  ContentBlock,
} from '@claude-tauri/shared';

// --- State shape ---
export interface StreamState {
  sessionId: string | null;
  model: string | null;
  tools: string[];
  status: 'idle' | 'streaming' | 'compacting' | 'rate-limited' | 'error' | 'done';
  // Active content blocks being streamed
  activeBlocks: Map<number, ActiveBlock>;
  // Completed assistant messages with their content blocks
  completedBlocks: ContentBlock[];
  // Tool call tracking
  activeToolCalls: Map<string, ToolCallState>;
  // Thinking blocks
  thinkingBlocks: string[];
  // Session result
  result: StreamSessionResult | null;
  // Errors
  errors: Array<{ type: string; message: string }>;
  // Rate limit info
  rateLimitRetryAfter: number | null;
  // Suggestions
  suggestions: string[];
  // Tasks (subagents)
  activeTasks: Map<string, TaskState>;
}

export interface ActiveBlock {
  index: number;
  type: 'text' | 'tool_use' | 'thinking';
  content: string;
  toolUseId?: string;
  toolName?: string;
}

export interface ToolCallState {
  id: string;
  name: string;
  input: string; // accumulated JSON
  status: 'running' | 'completed' | 'error';
  result?: unknown;
  elapsedSeconds?: number;
  summary?: string;
}

export interface TaskState {
  id: string;
  description: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  summary?: string;
}

// --- Action type ---
type StreamAction =
  | { type: 'EVENT'; event: StreamEvent }
  | { type: 'RESET' };

// --- Reducer ---
function streamReducer(state: StreamState, action: StreamAction): StreamState {
  if (action.type === 'RESET') return createInitialState();
  const event = action.event;
  // Switch on event.type to update state
  // (Full implementation in the actual code)
  switch (event.type) {
    case 'session:init':
      return { ...state, sessionId: event.sessionId, model: event.model, tools: event.tools, status: 'streaming' };
    case 'text:delta':
    case 'thinking:delta':
    case 'tool-input:delta':
      // Update active block content
      return updateActiveBlock(state, event);
    case 'block:start':
      return startBlock(state, event);
    case 'block:stop':
      return stopBlock(state, event);
    case 'tool:progress':
      return updateToolProgress(state, event);
    case 'tool:result':
      return updateToolResult(state, event);
    case 'tool:summary':
      return updateToolSummary(state, event);
    case 'session:result':
      return { ...state, result: event, status: 'done' };
    case 'error':
      return { ...state, errors: [...state.errors, { type: event.errorType, message: event.message }], status: 'error' };
    case 'rate-limit':
      return { ...state, status: 'rate-limited', rateLimitRetryAfter: event.retryAfterSeconds ?? null };
    case 'status':
      return { ...state, status: event.status === 'compacting' ? 'compacting' : state.status };
    case 'prompt:suggestion':
      return { ...state, suggestions: event.suggestions };
    case 'task:started':
      // Add to activeTasks
      return addTask(state, event);
    case 'task:notification':
      return updateTaskNotification(state, event);
    default:
      return state;
  }
}

function createInitialState(): StreamState {
  return {
    sessionId: null, model: null, tools: [], status: 'idle',
    activeBlocks: new Map(), completedBlocks: [], activeToolCalls: new Map(),
    thinkingBlocks: [], result: null, errors: [], rateLimitRetryAfter: null,
    suggestions: [], activeTasks: new Map(),
  };
}

// Hook export
export function useStreamEvents() {
  const [state, dispatch] = useReducer(streamReducer, createInitialState());

  const processEvent = useCallback((event: StreamEvent) => {
    dispatch({ type: 'EVENT', event });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, processEvent, reset };
}
```

### 7.2 New components to create

| Component | File Path | Description |
|-----------|-----------|-------------|
| `ToolCallBlock` | `apps/desktop/src/components/chat/ToolCallBlock.tsx` | Collapsible block showing tool name, input, status spinner, result |
| `ThinkingBlock` | `apps/desktop/src/components/chat/ThinkingBlock.tsx` | Collapsible thinking section with dimmed styling |
| `ErrorBanner` | `apps/desktop/src/components/chat/ErrorBanner.tsx` | Red error banner in message stream |
| `SessionStats` | `apps/desktop/src/components/chat/SessionStats.tsx` | Cost, duration, turns display |
| `RateLimitBanner` | `apps/desktop/src/components/chat/RateLimitBanner.tsx` | Yellow rate limit warning with countdown |
| `StatusIndicator` | `apps/desktop/src/components/chat/StatusIndicator.tsx` | Subtle status text (compacting, etc.) |
| `SuggestionChips` | `apps/desktop/src/components/chat/SuggestionChips.tsx` | Clickable follow-up suggestion buttons |
| `ToolResultBlock` | `apps/desktop/src/components/chat/ToolResultBlock.tsx` | Tool output display (code, text, errors) |

### 7.3 Update: `MessageList.tsx`

Enhance `MessageBubble` to render different content block types:

```tsx
function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
      }`}>
        {message.parts?.map((part, i) => {
          switch (part.type) {
            case 'text':
              return <div key={i} className="text-sm whitespace-pre-wrap break-words">{part.text}</div>;
            case 'tool-invocation':
              return <ToolCallBlock key={i} toolInvocation={part} />;
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
```

### 7.4 Update: `ChatPage.tsx`

Wire up the `useStreamEvents` hook to process data events from `useChat`:

```tsx
export function ChatPage({ sessionId }: ChatPageProps) {
  const { state, processEvent, reset } = useStreamEvents();

  const transport = new DefaultChatTransport({
    api: `${API_BASE}/api/chat`,
    body: { sessionId },
  });

  const { messages, sendMessage, status, data } = useChat({
    transport,
    onData: (data: unknown[]) => {
      // Process each StreamEvent from the data channel
      for (const event of data) {
        processEvent(event as StreamEvent);
      }
    },
  });

  // ... render with enriched state from useStreamEvents
}
```

---

## 8. SSE Event Protocol

### Data Flow

```
Claude SDK (subprocess)
  |
  | SDKMessage events (typed union)
  v
event-mapper.ts (mapSdkEvent)
  |
  | StreamEvent[] (our typed events)
  v
chat.ts route (createUIMessageStream)
  |
  | AI SDK v6 protocol + data channel
  | SSE format: "data: {json}\n\n"
  v
Frontend (useChat + useStreamEvents)
  |
  | AI SDK messages -> MessageList
  | Data channel events -> useStreamEvents reducer -> UI state
  v
React components render
```

### SSE Wire Format

The AI SDK v6 UIMessageStream sends events as SSE with `data:` lines. Our custom events ride on the `data` channel:

```
data: {"type":"data","data":[{"type":"session:init","sessionId":"abc","model":"opus","tools":["Read","Edit","Bash"],"mcpServers":[],"claudeCodeVersion":"2.1.39"}]}

data: {"type":"start"}

data: {"type":"data","data":[{"type":"block:start","blockIndex":0,"blockType":"text"}]}

data: {"type":"text-start","id":"text-0"}

data: {"type":"data","data":[{"type":"text:delta","text":"Hello","blockIndex":0}]}
data: {"type":"text-delta","id":"text-0","delta":"Hello"}

data: {"type":"data","data":[{"type":"text:delta","text":" world","blockIndex":0}]}
data: {"type":"text-delta","id":"text-0","delta":" world"}

data: {"type":"data","data":[{"type":"block:stop","blockIndex":0}]}

data: {"type":"data","data":[{"type":"session:result","success":true,"subtype":"success","costUsd":0.003,"durationMs":1500,"numTurns":1,"usage":{"inputTokens":50,"outputTokens":10,"cacheReadTokens":0,"cacheCreationTokens":0}}]}

data: {"type":"finish","finishReason":"stop","messageMetadata":{"sessionId":"abc"}}
```

### Dual-Channel Architecture

- **AI SDK Protocol Channel**: `start`, `text-start`, `text-delta`, `text-end`, `finish` -- drives `useChat()` message state
- **Custom Data Channel**: `data` events containing `StreamEvent[]` -- drives `useStreamEvents()` state for rich UI

This means the basic text chat works via `useChat()` out of the box, and our custom reducer adds tool calls, thinking blocks, errors, progress, etc. on top.

---

## 9. Testing Strategy

### 9.1 Unit Tests: Event Mapper (`apps/server/src/services/event-mapper.test.ts`)

Test each mapping function with mock SDK events.

```typescript
// Test structure for event-mapper.test.ts

describe('mapSdkEvent', () => {
  describe('system events', () => {
    test('maps init event to session:init', () => { /* ... */ });
    test('maps compact_boundary to compact-boundary', () => { /* ... */ });
    test('maps status event to status', () => { /* ... */ });
    test('maps rate_limit to rate-limit', () => { /* ... */ });
    test('maps hook_started to hook:started', () => { /* ... */ });
    test('maps hook_progress to hook:progress', () => { /* ... */ });
    test('maps hook_response to hook:response', () => { /* ... */ });
    test('maps task_started to task:started', () => { /* ... */ });
    test('maps task_progress to task:progress', () => { /* ... */ });
    test('maps task_notification to task:notification', () => { /* ... */ });
    test('maps files_persisted to files:persisted', () => { /* ... */ });
    test('maps tool_use_summary to tool:summary', () => { /* ... */ });
    test('maps prompt_suggestion to prompt:suggestion', () => { /* ... */ });
    test('returns empty array for unknown system subtype', () => { /* ... */ });
  });

  describe('assistant events', () => {
    test('maps text content block', () => { /* ... */ });
    test('maps tool_use content block', () => { /* ... */ });
    test('maps thinking content block', () => { /* ... */ });
    test('maps multiple content blocks', () => { /* ... */ });
    test('emits error event when assistant has error', () => { /* ... */ });
    test('handles empty content array', () => { /* ... */ });
  });

  describe('user events', () => {
    test('maps synthetic user message to tool:result', () => { /* ... */ });
    test('ignores non-synthetic user messages', () => { /* ... */ });
    test('ignores replay messages', () => { /* ... */ });
  });

  describe('result events', () => {
    test('maps success result', () => { /* ... */ });
    test('maps error_max_turns result', () => { /* ... */ });
    test('maps error_during_execution result', () => { /* ... */ });
    test('maps error_max_budget_usd result', () => { /* ... */ });
    test('emits both result and error events for error results', () => { /* ... */ });
  });

  describe('stream events', () => {
    test('maps content_block_start to block:start', () => { /* ... */ });
    test('maps text_delta to text:delta', () => { /* ... */ });
    test('maps thinking_delta to thinking:delta', () => { /* ... */ });
    test('maps input_json_delta to tool-input:delta', () => { /* ... */ });
    test('maps content_block_stop to block:stop', () => { /* ... */ });
    test('ignores message_start', () => { /* ... */ });
    test('ignores message_stop', () => { /* ... */ });
    test('handles tool_use content_block_start with id and name', () => { /* ... */ });
  });

  describe('tool_progress events', () => {
    test('maps to tool:progress with elapsed time', () => { /* ... */ });
  });

  describe('auth_status events', () => {
    test('maps to auth:status', () => { /* ... */ });
    test('includes error when present', () => { /* ... */ });
  });

  describe('unknown events', () => {
    test('returns empty array for unrecognized type', () => { /* ... */ });
    test('logs warning for unrecognized type', () => { /* ... */ });
  });
});
```

### 9.2 Mock Event Fixtures (`apps/server/src/test-fixtures/sdk-events.ts`)

Create a set of realistic mock SDK events for use across all tests.

```typescript
// apps/server/src/test-fixtures/sdk-events.ts

export const mockInitEvent = {
  type: 'system',
  subtype: 'init',
  uuid: 'uuid-1',
  session_id: 'session-123',
  model: 'claude-opus-4-6',
  tools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
  mcp_servers: [{ name: 'filesystem', status: 'connected' }],
  claude_code_version: '2.1.39',
  cwd: '/project',
  permissionMode: 'bypassPermissions',
  // ... all fields
};

export const mockTextAssistantEvent = {
  type: 'assistant',
  uuid: 'uuid-2',
  session_id: 'session-123',
  message: {
    content: [{ type: 'text', text: 'Hello, I will help you with that.' }],
  },
  parent_tool_use_id: null,
};

export const mockToolUseAssistantEvent = {
  type: 'assistant',
  uuid: 'uuid-3',
  session_id: 'session-123',
  message: {
    content: [
      { type: 'text', text: 'Let me read that file.' },
      { type: 'tool_use', id: 'tu-1', name: 'Read', input: { file_path: '/src/index.ts' } },
    ],
  },
  parent_tool_use_id: null,
};

export const mockThinkingAssistantEvent = {
  type: 'assistant',
  uuid: 'uuid-4',
  session_id: 'session-123',
  message: {
    content: [
      { type: 'thinking', thinking: 'I need to analyze the code structure first...' },
      { type: 'text', text: 'Here is my analysis.' },
    ],
  },
  parent_tool_use_id: null,
};

export const mockToolResultEvent = {
  type: 'user',
  uuid: 'uuid-5',
  session_id: 'session-123',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'file contents...' }] },
  parent_tool_use_id: 'tu-1',
  isSynthetic: true,
  tool_use_result: 'file contents here...',
};

export const mockSuccessResult = {
  type: 'result',
  subtype: 'success',
  uuid: 'uuid-6',
  session_id: 'session-123',
  duration_ms: 5000,
  duration_api_ms: 4500,
  is_error: false,
  num_turns: 3,
  result: 'Task completed successfully.',
  total_cost_usd: 0.025,
  usage: { input_tokens: 500, output_tokens: 200, cache_read_tokens: 100, cache_creation_tokens: 0 },
};

export const mockErrorResult = {
  type: 'result',
  subtype: 'error_max_turns',
  uuid: 'uuid-7',
  session_id: 'session-123',
  duration_ms: 30000,
  is_error: true,
  num_turns: 10,
  total_cost_usd: 0.15,
  usage: { input_tokens: 5000, output_tokens: 2000 },
  errors: ['Maximum turns (10) reached'],
};

export const mockTextDeltaStreamEvent = {
  type: 'stream_event',
  event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' }, index: 0 },
  parent_tool_use_id: null,
  uuid: 'uuid-8',
  session_id: 'session-123',
};

export const mockToolProgressEvent = {
  type: 'tool_progress',
  tool_use_id: 'tu-1',
  tool_name: 'Bash',
  parent_tool_use_id: null,
  elapsed_time_seconds: 5.2,
  uuid: 'uuid-9',
  session_id: 'session-123',
};

export const mockRateLimitEvent = {
  type: 'system',
  subtype: 'rate_limit',
  retry_after_seconds: 30,
  uuid: 'uuid-10',
  session_id: 'session-123',
};

// ... more fixtures for all event types
```

### 9.3 Integration Tests: Updated Chat Route Tests (`apps/server/src/routes/chat.test.ts`)

Update existing tests and add new tests for all event types flowing through the route.

### 9.4 Frontend Tests (future -- separate issue)

Frontend reducer tests would go in `apps/desktop/src/hooks/useStreamEvents.test.ts` to test state transitions for each event type.

---

## 10. Implementation Order

Work is divided into waves. Each wave can be parallelized across multiple agents.

### Wave 1: Foundation (must be first)

1. **Add shared types** to `packages/shared/src/types.ts` -- all `StreamEvent` types and `ContentBlock` types
2. **Create `event-mapper.ts`** with mapping functions for all 20 event types
3. **Create `event-mapper.test.ts`** with tests for all mappings
4. **Create mock event fixtures** in `apps/server/src/test-fixtures/sdk-events.ts`

### Wave 2: Backend Integration

5. **Update `claude.ts`** to use event mapper and yield `StreamEvent`
6. **Update `chat.ts`** to use dual-channel architecture (AI SDK protocol + data channel)
7. **Update `chat.test.ts`** with tests for new event types flowing through the route

### Wave 3: Frontend Core

8. **Create `useStreamEvents.ts`** hook with reducer
9. **Update `ChatPage.tsx`** to wire up `useStreamEvents` with `useChat`
10. **Update `MessageList.tsx`** to render multiple content block types

### Wave 4: Frontend Components

11. **Create `ToolCallBlock.tsx`** -- tool call display with input, spinner, result
12. **Create `ThinkingBlock.tsx`** -- collapsible thinking section
13. **Create `ErrorBanner.tsx`** -- error display
14. **Create `SessionStats.tsx`** -- cost/duration display
15. **Create `ToolResultBlock.tsx`** -- tool output display

### Wave 5: Polish Components

16. **Create `RateLimitBanner.tsx`** -- rate limit warning with countdown
17. **Create `StatusIndicator.tsx`** -- compacting/status display
18. **Create `SuggestionChips.tsx`** -- follow-up suggestions
19. **Create `CompactDivider.tsx`** -- visual compaction divider

### Wave 6: Low Priority (can be separate issue)

20. Hook lifecycle components (`HookIndicator.tsx`)
21. Subagent task components (`TaskPanel.tsx`)
22. File persistence notifications

---

## 11. Implementation Checklist

### Shared Types (`packages/shared/src/types.ts`)
- [ ] Add `ContentBlock` types (`TextBlock`, `ToolUseBlock`, `ThinkingBlock`)
- [ ] Add all `StreamEvent` types (see Section 5.2 -- 25+ interfaces)
- [ ] Update `ChatRequest` to support `parts` array format
- [ ] Export all new types

### Event Mapper (`apps/server/src/services/event-mapper.ts`)
- [ ] Create `mapSdkEvent()` main dispatcher
- [ ] Implement `mapSystemEvent()` with all 13 subtypes
- [ ] Implement `mapAssistantEvent()` with content block mapping
- [ ] Implement `mapUserEvent()` with synthetic/tool result detection
- [ ] Implement `mapResultEvent()` with success + 4 error subtypes
- [ ] Implement `mapStreamEvent()` with 6 inner event types
- [ ] Implement `mapToolProgress()`
- [ ] Implement `mapAuthStatus()`
- [ ] Add fallback logging for unknown event types

### Event Mapper Tests (`apps/server/src/services/event-mapper.test.ts`)
- [ ] Test all system event subtypes (13 cases)
- [ ] Test assistant event with text blocks
- [ ] Test assistant event with tool_use blocks
- [ ] Test assistant event with thinking blocks
- [ ] Test assistant event with mixed content blocks
- [ ] Test assistant event with error field
- [ ] Test user event (synthetic tool result)
- [ ] Test user event (non-synthetic, ignored)
- [ ] Test result event (success)
- [ ] Test result event (all 4 error subtypes)
- [ ] Test stream event (content_block_start for text)
- [ ] Test stream event (content_block_start for tool_use)
- [ ] Test stream event (content_block_delta text_delta)
- [ ] Test stream event (content_block_delta thinking_delta)
- [ ] Test stream event (content_block_delta input_json_delta)
- [ ] Test stream event (content_block_stop)
- [ ] Test stream event (message_start/stop ignored)
- [ ] Test tool_progress event
- [ ] Test auth_status event
- [ ] Test unknown event returns empty array

### Mock Fixtures (`apps/server/src/test-fixtures/sdk-events.ts`)
- [ ] Create mock events for all 20 SDK event types
- [ ] Include realistic data (model names, tool names, usage numbers)

### Claude Service (`apps/server/src/services/claude.ts`)
- [ ] Import and use `mapSdkEvent`
- [ ] Change yield type from `ClaudeStreamEvent` to `StreamEvent`
- [ ] Remove old `ClaudeStreamEvent` type
- [ ] Update `maxTurns` for multi-turn tool use
- [ ] Add `permissionMode` configuration

### Chat Route (`apps/server/src/routes/chat.ts`)
- [ ] Add data channel writes for all `StreamEvent` types
- [ ] Keep AI SDK protocol for text streaming compatibility
- [ ] Handle block lifecycle (text-start/text-end for multiple text blocks)
- [ ] Forward errors via AI SDK error event

### Chat Route Tests (`apps/server/src/routes/chat.test.ts`)
- [ ] Update existing tests for new event format
- [ ] Test that data channel contains StreamEvent objects
- [ ] Test tool_use assistant events flow through data channel
- [ ] Test thinking events flow through data channel
- [ ] Test error results flow as both data and AI SDK error
- [ ] Test rate limit events flow through data channel
- [ ] Test session:result with cost/usage data

### Frontend Hook (`apps/desktop/src/hooks/useStreamEvents.ts`)
- [ ] Create `StreamState` interface
- [ ] Create `streamReducer` with cases for all StreamEvent types
- [ ] Implement `useStreamEvents()` hook
- [ ] Handle block start/stop lifecycle
- [ ] Handle tool call state machine (running -> completed)
- [ ] Handle text accumulation from deltas
- [ ] Handle thinking accumulation from deltas
- [ ] Handle tool input accumulation from deltas

### Frontend Components
- [ ] Update `MessageList.tsx` to render `ToolCallBlock` and `ThinkingBlock`
- [ ] Update `ChatPage.tsx` to use `useStreamEvents`
- [ ] Create `ToolCallBlock.tsx`
- [ ] Create `ThinkingBlock.tsx`
- [ ] Create `ErrorBanner.tsx`
- [ ] Create `SessionStats.tsx`
- [ ] Create `ToolResultBlock.tsx`
- [ ] Create `RateLimitBanner.tsx`
- [ ] Create `StatusIndicator.tsx`
- [ ] Create `SuggestionChips.tsx`

### Documentation
- [ ] Update `docs/logs/engineering-log.md` with implementation notes
- [ ] Update `docs/logs/systems-log.md` with event flow architecture
- [ ] Close GitHub issue #5 when complete

---

## File Paths Summary

### New Files
| File | Purpose |
|------|---------|
| `apps/server/src/services/event-mapper.ts` | SDK event -> StreamEvent mapping |
| `apps/server/src/services/event-mapper.test.ts` | Event mapper unit tests |
| `apps/server/src/test-fixtures/sdk-events.ts` | Mock SDK events for testing |
| `apps/desktop/src/hooks/useStreamEvents.ts` | Frontend event reducer hook |
| `apps/desktop/src/components/chat/ToolCallBlock.tsx` | Tool call UI |
| `apps/desktop/src/components/chat/ThinkingBlock.tsx` | Thinking block UI |
| `apps/desktop/src/components/chat/ErrorBanner.tsx` | Error display |
| `apps/desktop/src/components/chat/SessionStats.tsx` | Cost/usage display |
| `apps/desktop/src/components/chat/ToolResultBlock.tsx` | Tool output display |
| `apps/desktop/src/components/chat/RateLimitBanner.tsx` | Rate limit warning |
| `apps/desktop/src/components/chat/StatusIndicator.tsx` | Status display |
| `apps/desktop/src/components/chat/SuggestionChips.tsx` | Suggestion buttons |

### Modified Files
| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add 25+ StreamEvent types, ContentBlock types |
| `apps/server/src/services/claude.ts` | Use event mapper, change yield type |
| `apps/server/src/routes/chat.ts` | Dual-channel streaming, handle all event types |
| `apps/server/src/routes/chat.test.ts` | Add tests for new event handling |
| `apps/desktop/src/components/chat/MessageList.tsx` | Render multiple block types |
| `apps/desktop/src/components/chat/ChatPage.tsx` | Wire up useStreamEvents |
