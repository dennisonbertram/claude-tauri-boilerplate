export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  plan?: string;
  error?: string;
}

export interface Session {
  id: string;
  title: string;
  claudeSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  }>;
  sessionId?: string;
}

// --- Content Block Types ---

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock;

// --- Stream Event Types (Server -> Frontend over SSE) ---

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
  errorType: string;
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
