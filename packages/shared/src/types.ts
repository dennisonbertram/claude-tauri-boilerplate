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
  workspaceId?: string;
  linearIssueId?: string | null;
  linearIssueTitle?: string | null;
  linearIssueSummary?: string | null;
  linearIssueUrl?: string | null;
  messageCount?: number;
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
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  workspaceId?: string;
  linearIssue?: {
    id: string;
    title: string;
    summary?: string;
    url?: string;
  };
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

// --- Permission Types ---

export type PermissionDecisionAction = 'allow_once' | 'allow_always' | 'deny';
export type PermissionScope = 'session' | 'permanent';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel: RiskLevel;
  sessionId: string;
}

export interface PermissionResponse {
  sessionId: string;
  requestId: string;
  decision: PermissionDecisionAction;
  scope?: PermissionScope;
}

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
  // Permissions
  | StreamPermissionRequest
  | StreamPermissionDenied
  // Plan mode
  | StreamPlanStart
  | StreamPlanContent
  | StreamPlanComplete
  | StreamPlanApproved
  | StreamPlanRejected
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

// Permission request (tool needs approval)
export interface StreamPermissionRequest {
  type: 'permission:request';
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel: RiskLevel;
}

// Permission denied notification
export interface StreamPermissionDenied {
  type: 'permission:denied';
  requestId: string;
  toolName: string;
}

// --- Plan Mode Types ---

/** Plan mode entered - agent is creating a plan */
export interface StreamPlanStart {
  type: 'plan:start';
  planId: string;
}

/** Plan content streaming delta */
export interface StreamPlanContent {
  type: 'plan:content';
  planId: string;
  text: string;
}

/** Plan is complete and ready for user review */
export interface StreamPlanComplete {
  type: 'plan:complete';
  planId: string;
}

/** User approved the plan */
export interface StreamPlanApproved {
  type: 'plan:approved';
  planId: string;
}

/** User rejected the plan with optional feedback */
export interface StreamPlanRejected {
  type: 'plan:rejected';
  planId: string;
  feedback?: string;
}

/** Request body for plan decision endpoint */
export interface PlanDecisionRequest {
  sessionId: string;
  planId: string;
  decision: 'approve' | 'reject';
  feedback?: string;
}

export type PlanDecisionAction = 'approve' | 'reject';

// --- Instruction / Rules Types ---

export interface InstructionFile {
  path: string;
  level: 'project' | 'user' | 'global' | 'managed';
  content: string;
  exists: boolean;
}

export interface RuleFile {
  path: string;
  name: string;
  content: string;
  pathScope?: string[];
}

// --- Git Types ---

// --- Memory Types ---

export interface MemoryFile {
  name: string;
  path: string;
  content: string;
  isEntrypoint: boolean;
  sizeBytes: number;
  modifiedAt: string;
}

export interface MemorySearchResult {
  file: string;
  line: number;
  text: string;
  context: string;
}

// --- MCP Server Types ---

export interface McpServerConfig {
  name: string;
  type: 'stdio' | 'http' | 'sse';
  enabled: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

// --- Hook Types ---

export interface HookEventMeta {
  event: string;
  description: string;
  canBlock: boolean;
  supportsMatcher: boolean;
}

export interface HookHandler {
  type: 'command' | 'http' | 'prompt';
  command?: string;
  timeout?: number;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  prompt?: string;
}

export interface HookConfig {
  id: string;
  event: string;
  matcher?: string;
  enabled: boolean;
  handler: HookHandler;
}

// --- Git Types ---

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
}

export interface GitStatus {
  branch: string;
  isClean: boolean;
  modifiedFiles: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  error?: string;
}

export interface GitDiff {
  diff: string;
  error?: string;
}

// --- Agent Teams Types ---

export interface AgentDefinition {
  name: string;
  description: string;
  model?: string;
  tools?: string[];
  permissionMode?: 'normal' | 'acceptEdits' | 'dontAsk' | 'plan';
}

export interface TeamConfig {
  id: string;
  name: string;
  agents: AgentDefinition[];
  displayMode: 'auto' | 'in-process' | 'tmux';
  createdAt: string;
}

export interface TeammateStatus {
  name: string;
  status: 'active' | 'idle' | 'stopped';
  currentTask?: string;
  model?: string;
  tools?: string[];
}

export interface TeamMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  type: 'message' | 'broadcast' | 'shutdown_request';
}

export interface TeamTask {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignee?: string;
}

// --- Checkpoint Types ---

export interface Checkpoint {
  id: string;
  userMessageId: string;
  promptPreview: string; // first ~50 chars of the user's prompt
  timestamp: string;
  filesChanged: FileChange[];
  turnIndex: number;
}

export interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  tool: string; // Edit, Write, MultiEdit
}

export interface RewindPreview {
  checkpointId: string;
  filesAffected: string[];
  messagesRemoved: number;
}

// --- Project & Workspace Types ---

export type WorkspaceStatus =
  | 'creating'
  | 'setup_running'
  | 'ready'
  | 'active'
  | 'merging'
  | 'discarding'
  | 'merged'
  | 'archived'
  | 'error';

export type ProjectHealth = 'ok' | 'missing_repo' | 'invalid_repo';

export interface Project {
  id: string;
  name: string;
  repoPath: string;
  repoPathCanonical: string;
  defaultBranch: string;
  setupCommand?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  projectId: string;
  name: string;
  branch: string;
  worktreePath: string;
  worktreePathCanonical: string;
  baseBranch: string;
  status: WorkspaceStatus;
  claudeSessionId?: string;
  setupPid?: number;
  errorMessage?: string;
  linearIssueId?: string;
  linearIssueTitle?: string;
  linearIssueSummary?: string;
  linearIssueUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  repoPath: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  baseBranch?: string;
  linearIssue?: {
    id: string;
    title: string;
    summary?: string;
    url?: string;
  };
}

/** Valid workspace status transitions */
export const VALID_WORKSPACE_TRANSITIONS: Record<WorkspaceStatus, WorkspaceStatus[]> = {
  creating: ['setup_running', 'ready', 'error'],
  setup_running: ['ready', 'error'],
  ready: ['active', 'merging', 'discarding', 'archived', 'error'],
  active: ['ready', 'merging', 'discarding', 'error'],
  merging: ['merged', 'error'],
  discarding: ['archived', 'error'],
  merged: [],
  archived: [],
  error: ['ready', 'creating', 'archived'],
};

/** Check whether a workspace status transition is valid */
export function isValidTransition(from: WorkspaceStatus, to: WorkspaceStatus): boolean {
  return VALID_WORKSPACE_TRANSITIONS[from]?.includes(to) ?? false;
}
