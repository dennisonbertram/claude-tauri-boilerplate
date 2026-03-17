import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import { mapSdkEvent } from './event-mapper';
import type {
  StreamSessionInit,
  StreamSessionResult,
  StreamTextDelta,
  StreamThinkingDelta,
  StreamToolInputDelta,
  StreamBlockStart,
  StreamBlockStop,
  StreamAssistantMessage,
  StreamToolResult,
  StreamToolProgress,
  StreamError,
  StreamStatus,
  StreamRateLimit,
  StreamCompactBoundary,
  StreamAuthStatus,
  StreamTaskStarted,
  StreamTaskProgress,
  StreamTaskNotification,
  StreamHookStarted,
  StreamHookProgress,
  StreamHookResponse,
  StreamFilesPersisted,
  StreamToolUseSummary,
  StreamPromptSuggestion,
} from '@claude-tauri/shared';

// --- Mock SDK Events ---

const mockInitEvent = {
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
  apiKeySource: 'env',
  slash_commands: ['plugin-cmd', 'my-tool'],
  output_style: 'text',
  skills: [],
  plugins: [],
};

const mockTextAssistantEvent = {
  type: 'assistant',
  uuid: 'uuid-2',
  session_id: 'session-123',
  message: {
    content: [{ type: 'text', text: 'Hello, I will help you with that.' }],
  },
  parent_tool_use_id: null,
};

const mockToolUseAssistantEvent = {
  type: 'assistant',
  uuid: 'uuid-3',
  session_id: 'session-123',
  message: {
    content: [
      { type: 'text', text: 'Let me read that file.' },
      {
        type: 'tool_use',
        id: 'tu-1',
        name: 'Read',
        input: { file_path: '/src/index.ts' },
      },
    ],
  },
  parent_tool_use_id: null,
};

const mockThinkingAssistantEvent = {
  type: 'assistant',
  uuid: 'uuid-4',
  session_id: 'session-123',
  message: {
    content: [
      {
        type: 'thinking',
        thinking: 'I need to analyze the code structure first...',
      },
      { type: 'text', text: 'Here is my analysis.' },
    ],
  },
  parent_tool_use_id: null,
};

const mockAssistantWithErrorEvent = {
  type: 'assistant',
  uuid: 'uuid-err',
  session_id: 'session-123',
  message: {
    content: [],
  },
  parent_tool_use_id: null,
  error: 'rate_limit',
};

const mockToolResultEvent = {
  type: 'user',
  uuid: 'uuid-5',
  session_id: 'session-123',
  message: {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'tu-1',
        content: 'file contents...',
      },
    ],
  },
  parent_tool_use_id: 'tu-1',
  isSynthetic: true,
  tool_use_result: 'file contents here...',
};

const mockRegularUserEvent = {
  type: 'user',
  uuid: 'uuid-user',
  session_id: 'session-123',
  message: { role: 'user', content: 'Hello' },
  parent_tool_use_id: null,
};

const mockSuccessResult = {
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
  usage: {
    input_tokens: 500,
    output_tokens: 200,
    cache_read_tokens: 100,
    cache_creation_tokens: 0,
  },
};

const mockErrorMaxTurnsResult = {
  type: 'result',
  subtype: 'error_max_turns',
  uuid: 'uuid-7',
  session_id: 'session-123',
  duration_ms: 30000,
  duration_api_ms: 28000,
  is_error: true,
  num_turns: 10,
  total_cost_usd: 0.15,
  usage: {
    input_tokens: 5000,
    output_tokens: 2000,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
  },
  errors: ['Maximum turns (10) reached'],
};

const mockErrorDuringExecutionResult = {
  type: 'result',
  subtype: 'error_during_execution',
  uuid: 'uuid-8',
  session_id: 'session-123',
  duration_ms: 2000,
  duration_api_ms: 1500,
  is_error: true,
  num_turns: 1,
  total_cost_usd: 0.01,
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
  },
  errors: ['Tool execution failed', 'Permission denied'],
};

const mockErrorMaxBudgetResult = {
  type: 'result',
  subtype: 'error_max_budget_usd',
  uuid: 'uuid-9',
  session_id: 'session-123',
  duration_ms: 60000,
  duration_api_ms: 55000,
  is_error: true,
  num_turns: 50,
  total_cost_usd: 5.0,
  usage: {
    input_tokens: 100000,
    output_tokens: 50000,
    cache_read_tokens: 10000,
    cache_creation_tokens: 5000,
  },
  errors: ['Budget limit of $5.00 exceeded'],
};

// --- Stream event mocks ---

const mockTextBlockStartStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'content_block_start',
    content_block: { type: 'text', text: '' },
    index: 0,
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s1',
  session_id: 'session-123',
};

const mockToolUseBlockStartStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'content_block_start',
    content_block: { type: 'tool_use', id: 'tu-2', name: 'Edit' },
    index: 1,
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s2',
  session_id: 'session-123',
};

const mockThinkingBlockStartStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'content_block_start',
    content_block: { type: 'thinking', thinking: '' },
    index: 0,
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s3',
  session_id: 'session-123',
};

const mockTextDeltaStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'content_block_delta',
    delta: { type: 'text_delta', text: 'Hello' },
    index: 0,
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s4',
  session_id: 'session-123',
};

const mockThinkingDeltaStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'content_block_delta',
    delta: { type: 'thinking_delta', thinking: 'Let me think...' },
    index: 0,
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s5',
  session_id: 'session-123',
};

const mockInputJsonDeltaStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'content_block_delta',
    delta: { type: 'input_json_delta', partial_json: '{"file_path":' },
    index: 1,
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s6',
  session_id: 'session-123',
};

const mockBlockStopStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'content_block_stop',
    index: 0,
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s7',
  session_id: 'session-123',
};

const mockMessageStartStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'message_start',
    message: { id: 'msg-1', type: 'message', role: 'assistant' },
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s8',
  session_id: 'session-123',
};

const mockMessageDeltaStreamEvent = {
  type: 'stream_event',
  event: {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn' },
    usage: { output_tokens: 100 },
  },
  parent_tool_use_id: null,
  uuid: 'uuid-s9',
  session_id: 'session-123',
};

const mockMessageStopStreamEvent = {
  type: 'stream_event',
  event: { type: 'message_stop' },
  parent_tool_use_id: null,
  uuid: 'uuid-s10',
  session_id: 'session-123',
};

// --- Other event mocks ---

const mockToolProgressEvent = {
  type: 'tool_progress',
  tool_use_id: 'tu-1',
  tool_name: 'Bash',
  parent_tool_use_id: null,
  elapsed_time_seconds: 5.2,
  uuid: 'uuid-tp',
  session_id: 'session-123',
};

const mockAuthStatusEvent = {
  type: 'auth_status',
  isAuthenticating: true,
  output: ['Authenticating...'],
  uuid: 'uuid-auth',
  session_id: 'session-123',
};

const mockAuthStatusWithErrorEvent = {
  type: 'auth_status',
  isAuthenticating: false,
  output: ['Authentication failed'],
  error: 'Invalid API key',
  uuid: 'uuid-auth-err',
  session_id: 'session-123',
};

const mockRateLimitEvent = {
  type: 'system',
  subtype: 'rate_limit',
  retry_after_seconds: 30,
  uuid: 'uuid-rl',
  session_id: 'session-123',
};

const mockCompactBoundaryEvent = {
  type: 'system',
  subtype: 'compact_boundary',
};

const mockStatusEvent = {
  type: 'system',
  subtype: 'status',
  status: 'compacting',
  uuid: 'uuid-st',
  session_id: 'session-123',
};

const mockHookStartedEvent = {
  type: 'system',
  subtype: 'hook_started',
  hook_id: 'hook-1',
  hook_name: 'PreToolUse',
  hook_event: 'Bash',
  uuid: 'uuid-hs',
  session_id: 'session-123',
};

const mockHookProgressEvent = {
  type: 'system',
  subtype: 'hook_progress',
  hook_id: 'hook-1',
  hook_name: 'PreToolUse',
  hook_event: 'Bash',
  stdout: 'checking...',
  stderr: '',
  output: 'checking...',
  uuid: 'uuid-hp',
  session_id: 'session-123',
};

const mockHookResponseEvent = {
  type: 'system',
  subtype: 'hook_response',
  hook_id: 'hook-1',
  hook_name: 'PreToolUse',
  hook_event: 'Bash',
  response: { permissionDecision: 'allow' },
  uuid: 'uuid-hr',
  session_id: 'session-123',
};

const mockTaskStartedEvent = {
  type: 'system',
  subtype: 'task_started',
  task_id: 'task-1',
  tool_use_id: 'tu-1',
  description: 'Researching code structure',
  task_type: 'research',
  uuid: 'uuid-ts',
  session_id: 'session-123',
};

const mockTaskProgressEvent = {
  type: 'system',
  subtype: 'task_progress',
  task_id: 'task-1',
  tool_use_id: 'tu-1',
  progress: { step: 3, total: 5 },
  uuid: 'uuid-tp2',
  session_id: 'session-123',
};

const mockTaskNotificationEvent = {
  type: 'system',
  subtype: 'task_notification',
  task_id: 'task-1',
  tool_use_id: 'tu-1',
  status: 'completed',
  output_file: '/tmp/output.md',
  summary: 'Research completed successfully',
  usage: {
    total_tokens: 5000,
    tool_uses: 10,
    duration_ms: 15000,
  },
  uuid: 'uuid-tn',
  session_id: 'session-123',
};

const mockTaskNotificationNoUsageEvent = {
  type: 'system',
  subtype: 'task_notification',
  task_id: 'task-2',
  status: 'failed',
  output_file: '/tmp/output2.md',
  summary: 'Task failed due to timeout',
  uuid: 'uuid-tn2',
  session_id: 'session-123',
};

const mockFilesPersistedEvent = {
  type: 'system',
  subtype: 'files_persisted',
  files: ['/src/index.ts', '/src/utils.ts'],
  uuid: 'uuid-fp',
  session_id: 'session-123',
};

const mockToolUseSummaryEvent = {
  type: 'system',
  subtype: 'tool_use_summary',
  tool_name: 'Read',
  tool_use_id: 'tu-1',
  summary: 'Read file /src/index.ts (245 lines)',
  uuid: 'uuid-tus',
  session_id: 'session-123',
};

const mockPromptSuggestionEvent = {
  type: 'system',
  subtype: 'prompt_suggestion',
  suggestions: ['Fix the failing test', 'Add error handling', 'Refactor the utils module'],
  uuid: 'uuid-ps',
  session_id: 'session-123',
};

// --- Tests ---

describe('mapSdkEvent', () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleSpy = spyOn(console, 'warn').mockImplementation(() => {});
  });

  // --- System events ---

  describe('system events', () => {
    test('maps init event to session:init', () => {
      const result = mapSdkEvent(mockInitEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamSessionInit;
      expect(event.type).toBe('session:init');
      expect(event.sessionId).toBe('session-123');
      expect(event.model).toBe('claude-opus-4-6');
      expect(event.tools).toEqual(['Read', 'Edit', 'Bash', 'Glob', 'Grep']);
      expect(event.mcpServers).toEqual([
        { name: 'filesystem', status: 'connected' },
      ]);
      expect(event.claudeCodeVersion).toBe('2.1.39');
      expect(event.slashCommands).toEqual(['plugin-cmd', 'my-tool']);
    });

    test('maps compact_boundary to compact-boundary', () => {
      const result = mapSdkEvent(mockCompactBoundaryEvent);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'compact-boundary' });
    });

    test('maps status event to status', () => {
      const result = mapSdkEvent(mockStatusEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamStatus;
      expect(event.type).toBe('status');
      expect(event.status).toBe('compacting');
    });

    test('maps rate_limit to rate-limit', () => {
      const result = mapSdkEvent(mockRateLimitEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamRateLimit;
      expect(event.type).toBe('rate-limit');
      expect(event.retryAfterSeconds).toBe(30);
    });

    test('maps hook_started to hook:started', () => {
      const result = mapSdkEvent(mockHookStartedEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamHookStarted;
      expect(event.type).toBe('hook:started');
      expect(event.hookId).toBe('hook-1');
      expect(event.hookName).toBe('PreToolUse');
      expect(event.hookEvent).toBe('Bash');
    });

    test('maps hook_progress to hook:progress', () => {
      const result = mapSdkEvent(mockHookProgressEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamHookProgress;
      expect(event.type).toBe('hook:progress');
      expect(event.hookId).toBe('hook-1');
      expect(event.hookName).toBe('PreToolUse');
      expect(event.output).toBe('checking...');
    });

    test('maps hook_response to hook:response', () => {
      const result = mapSdkEvent(mockHookResponseEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamHookResponse;
      expect(event.type).toBe('hook:response');
      expect(event.hookId).toBe('hook-1');
      expect(event.hookName).toBe('PreToolUse');
      expect(event.response).toEqual({ permissionDecision: 'allow' });
    });

    test('maps task_started to task:started', () => {
      const result = mapSdkEvent(mockTaskStartedEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamTaskStarted;
      expect(event.type).toBe('task:started');
      expect(event.taskId).toBe('task-1');
      expect(event.description).toBe('Researching code structure');
      expect(event.taskType).toBe('research');
    });

    test('maps task_progress to task:progress', () => {
      const result = mapSdkEvent(mockTaskProgressEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamTaskProgress;
      expect(event.type).toBe('task:progress');
      expect(event.taskId).toBe('task-1');
      expect(event.progress).toEqual({ step: 3, total: 5 });
    });

    test('maps task_notification to task:notification with usage', () => {
      const result = mapSdkEvent(mockTaskNotificationEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamTaskNotification;
      expect(event.type).toBe('task:notification');
      expect(event.taskId).toBe('task-1');
      expect(event.status).toBe('completed');
      expect(event.summary).toBe('Research completed successfully');
      expect(event.usage).toEqual({
        totalTokens: 5000,
        toolUses: 10,
        durationMs: 15000,
      });
    });

    test('maps task_notification without usage', () => {
      const result = mapSdkEvent(mockTaskNotificationNoUsageEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamTaskNotification;
      expect(event.type).toBe('task:notification');
      expect(event.taskId).toBe('task-2');
      expect(event.status).toBe('failed');
      expect(event.usage).toBeUndefined();
    });

    test('maps files_persisted to files:persisted', () => {
      const result = mapSdkEvent(mockFilesPersistedEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamFilesPersisted;
      expect(event.type).toBe('files:persisted');
      expect(event.files).toEqual(['/src/index.ts', '/src/utils.ts']);
    });

    test('maps tool_use_summary to tool:summary', () => {
      const result = mapSdkEvent(mockToolUseSummaryEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamToolUseSummary;
      expect(event.type).toBe('tool:summary');
      expect(event.toolUseId).toBe('tu-1');
      expect(event.toolName).toBe('Read');
      expect(event.summary).toBe('Read file /src/index.ts (245 lines)');
    });

    test('maps prompt_suggestion to prompt:suggestion', () => {
      const result = mapSdkEvent(mockPromptSuggestionEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamPromptSuggestion;
      expect(event.type).toBe('prompt:suggestion');
      expect(event.suggestions).toEqual([
        'Fix the failing test',
        'Add error handling',
        'Refactor the utils module',
      ]);
    });

    test('returns empty array for unknown system subtype', () => {
      const result = mapSdkEvent({
        type: 'system',
        subtype: 'some_future_subtype',
      });
      expect(result).toEqual([]);
    });

    test('logs warning for unknown system subtype', () => {
      mapSdkEvent({ type: 'system', subtype: 'some_future_subtype' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled system subtype: some_future_subtype')
      );
    });
  });

  // --- Assistant events ---

  describe('assistant events', () => {
    test('maps text content block', () => {
      const result = mapSdkEvent(mockTextAssistantEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamAssistantMessage;
      expect(event.type).toBe('assistant:message');
      expect(event.uuid).toBe('uuid-2');
      expect(event.blocks).toHaveLength(1);
      expect(event.blocks[0]).toEqual({
        type: 'text',
        text: 'Hello, I will help you with that.',
      });
      expect(event.parentToolUseId).toBeNull();
    });

    test('maps tool_use content block', () => {
      const result = mapSdkEvent(mockToolUseAssistantEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamAssistantMessage;
      expect(event.blocks).toHaveLength(2);
      expect(event.blocks[0]).toEqual({
        type: 'text',
        text: 'Let me read that file.',
      });
      expect(event.blocks[1]).toEqual({
        type: 'tool_use',
        id: 'tu-1',
        name: 'Read',
        input: { file_path: '/src/index.ts' },
      });
    });

    test('maps thinking content block', () => {
      const result = mapSdkEvent(mockThinkingAssistantEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamAssistantMessage;
      expect(event.blocks).toHaveLength(2);
      expect(event.blocks[0]).toEqual({
        type: 'thinking',
        thinking: 'I need to analyze the code structure first...',
      });
      expect(event.blocks[1]).toEqual({
        type: 'text',
        text: 'Here is my analysis.',
      });
    });

    test('maps multiple content blocks in a single message', () => {
      const multiBlockEvent = {
        type: 'assistant',
        uuid: 'uuid-multi',
        session_id: 'session-123',
        message: {
          content: [
            { type: 'thinking', thinking: 'Analyzing...' },
            { type: 'text', text: 'Result:' },
            {
              type: 'tool_use',
              id: 'tu-3',
              name: 'Bash',
              input: { command: 'ls' },
            },
          ],
        },
        parent_tool_use_id: null,
      };
      const result = mapSdkEvent(multiBlockEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamAssistantMessage;
      expect(event.blocks).toHaveLength(3);
    });

    test('emits error event when assistant has error', () => {
      const result = mapSdkEvent(mockAssistantWithErrorEvent);
      // Should emit both the assistant:message and an error event
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('assistant:message');
      const errorEvent = result[1] as StreamError;
      expect(errorEvent.type).toBe('error');
      expect(errorEvent.errorType).toBe('rate_limit');
      expect(errorEvent.message).toContain('rate_limit');
    });

    test('handles empty content array', () => {
      const emptyContentEvent = {
        type: 'assistant',
        uuid: 'uuid-empty',
        session_id: 'session-123',
        message: { content: [] },
        parent_tool_use_id: null,
      };
      const result = mapSdkEvent(emptyContentEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamAssistantMessage;
      expect(event.blocks).toEqual([]);
    });

    test('handles missing content field', () => {
      const noContentEvent = {
        type: 'assistant',
        uuid: 'uuid-none',
        session_id: 'session-123',
        message: {},
        parent_tool_use_id: null,
      };
      const result = mapSdkEvent(noContentEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamAssistantMessage;
      expect(event.blocks).toEqual([]);
    });

    test('preserves parentToolUseId for subagent messages', () => {
      const subagentEvent = {
        type: 'assistant',
        uuid: 'uuid-sub',
        session_id: 'session-123',
        message: {
          content: [{ type: 'text', text: 'Subagent result' }],
        },
        parent_tool_use_id: 'tu-parent-1',
      };
      const result = mapSdkEvent(subagentEvent);
      const event = result[0] as StreamAssistantMessage;
      expect(event.parentToolUseId).toBe('tu-parent-1');
    });
  });

  // --- User events ---

  describe('user events', () => {
    test('maps synthetic user message to tool:result', () => {
      const result = mapSdkEvent(mockToolResultEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamToolResult;
      expect(event.type).toBe('tool:result');
      expect(event.toolUseId).toBe('tu-1');
      expect(event.result).toBe('file contents here...');
    });

    test('ignores non-synthetic user messages', () => {
      const result = mapSdkEvent(mockRegularUserEvent);
      expect(result).toEqual([]);
    });

    test('ignores synthetic messages without parent_tool_use_id', () => {
      const syntheticNoParent = {
        type: 'user',
        uuid: 'uuid-no-parent',
        session_id: 'session-123',
        message: { role: 'user', content: 'echo' },
        parent_tool_use_id: null,
        isSynthetic: true,
        tool_use_result: 'some result',
      };
      const result = mapSdkEvent(syntheticNoParent);
      expect(result).toEqual([]);
    });

    test('ignores replay messages', () => {
      const replayEvent = {
        type: 'user',
        uuid: 'uuid-replay',
        session_id: 'session-123',
        message: { role: 'user', content: 'previous message' },
        parent_tool_use_id: null,
        isReplay: true,
      };
      const result = mapSdkEvent(replayEvent);
      expect(result).toEqual([]);
    });
  });

  // --- Result events ---

  describe('result events', () => {
    test('maps success result', () => {
      const result = mapSdkEvent(mockSuccessResult);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamSessionResult;
      expect(event.type).toBe('session:result');
      expect(event.success).toBe(true);
      expect(event.subtype).toBe('success');
      expect(event.costUsd).toBe(0.025);
      expect(event.durationMs).toBe(5000);
      expect(event.numTurns).toBe(3);
      expect(event.usage).toEqual({
        inputTokens: 500,
        outputTokens: 200,
        cacheReadTokens: 100,
        cacheCreationTokens: 0,
      });
      expect(event.errors).toBeUndefined();
    });

    test('maps error_max_turns result', () => {
      const result = mapSdkEvent(mockErrorMaxTurnsResult);
      // Should emit both result and error events
      expect(result).toHaveLength(2);
      const sessionResult = result[0] as StreamSessionResult;
      expect(sessionResult.type).toBe('session:result');
      expect(sessionResult.success).toBe(false);
      expect(sessionResult.subtype).toBe('error_max_turns');
      expect(sessionResult.errors).toEqual(['Maximum turns (10) reached']);

      const errorEvent = result[1] as StreamError;
      expect(errorEvent.type).toBe('error');
      expect(errorEvent.errorType).toBe('error_max_turns');
      expect(errorEvent.message).toContain('Maximum turns (10) reached');
    });

    test('maps error_during_execution result with multiple errors', () => {
      const result = mapSdkEvent(mockErrorDuringExecutionResult);
      expect(result).toHaveLength(2);
      const sessionResult = result[0] as StreamSessionResult;
      expect(sessionResult.success).toBe(false);
      expect(sessionResult.subtype).toBe('error_during_execution');
      expect(sessionResult.errors).toEqual([
        'Tool execution failed',
        'Permission denied',
      ]);

      const errorEvent = result[1] as StreamError;
      expect(errorEvent.message).toContain('Tool execution failed');
      expect(errorEvent.message).toContain('Permission denied');
    });

    test('maps error_max_budget_usd result', () => {
      const result = mapSdkEvent(mockErrorMaxBudgetResult);
      expect(result).toHaveLength(2);
      const sessionResult = result[0] as StreamSessionResult;
      expect(sessionResult.success).toBe(false);
      expect(sessionResult.subtype).toBe('error_max_budget_usd');
      expect(sessionResult.costUsd).toBe(5.0);
    });

    test('handles result with missing usage fields', () => {
      const sparseResult = {
        type: 'result',
        subtype: 'success',
        uuid: 'uuid-sparse',
        session_id: 'session-123',
        duration_ms: 1000,
        is_error: false,
        num_turns: 1,
        total_cost_usd: 0.001,
        usage: {},
      };
      const result = mapSdkEvent(sparseResult);
      const event = result[0] as StreamSessionResult;
      expect(event.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      });
    });

    test('does not emit error event for success results', () => {
      const result = mapSdkEvent(mockSuccessResult);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('session:result');
    });
  });

  // --- Stream events ---

  describe('stream events', () => {
    test('maps content_block_start for text block to block:start', () => {
      const result = mapSdkEvent(mockTextBlockStartStreamEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamBlockStart;
      expect(event.type).toBe('block:start');
      expect(event.blockIndex).toBe(0);
      expect(event.blockType).toBe('text');
      expect(event.toolUseId).toBeUndefined();
      expect(event.toolName).toBeUndefined();
    });

    test('maps content_block_start for tool_use with id and name', () => {
      const result = mapSdkEvent(mockToolUseBlockStartStreamEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamBlockStart;
      expect(event.type).toBe('block:start');
      expect(event.blockIndex).toBe(1);
      expect(event.blockType).toBe('tool_use');
      expect(event.toolUseId).toBe('tu-2');
      expect(event.toolName).toBe('Edit');
    });

    test('maps content_block_start for thinking block', () => {
      const result = mapSdkEvent(mockThinkingBlockStartStreamEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamBlockStart;
      expect(event.blockType).toBe('thinking');
    });

    test('maps text_delta to text:delta', () => {
      const result = mapSdkEvent(mockTextDeltaStreamEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamTextDelta;
      expect(event.type).toBe('text:delta');
      expect(event.text).toBe('Hello');
      expect(event.blockIndex).toBe(0);
    });

    test('maps thinking_delta to thinking:delta', () => {
      const result = mapSdkEvent(mockThinkingDeltaStreamEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamThinkingDelta;
      expect(event.type).toBe('thinking:delta');
      expect(event.thinking).toBe('Let me think...');
      expect(event.blockIndex).toBe(0);
    });

    test('maps input_json_delta to tool-input:delta', () => {
      const result = mapSdkEvent(mockInputJsonDeltaStreamEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamToolInputDelta;
      expect(event.type).toBe('tool-input:delta');
      expect(event.partialJson).toBe('{"file_path":');
      expect(event.blockIndex).toBe(1);
    });

    test('maps content_block_stop to block:stop', () => {
      const result = mapSdkEvent(mockBlockStopStreamEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamBlockStop;
      expect(event.type).toBe('block:stop');
      expect(event.blockIndex).toBe(0);
    });

    test('ignores message_start', () => {
      const result = mapSdkEvent(mockMessageStartStreamEvent);
      expect(result).toEqual([]);
    });

    test('ignores message_delta', () => {
      const result = mapSdkEvent(mockMessageDeltaStreamEvent);
      expect(result).toEqual([]);
    });

    test('ignores message_stop', () => {
      const result = mapSdkEvent(mockMessageStopStreamEvent);
      expect(result).toEqual([]);
    });

    test('handles stream_event with null event', () => {
      const nullEventStreamEvent = {
        type: 'stream_event',
        event: null,
        parent_tool_use_id: null,
        uuid: 'uuid-null',
        session_id: 'session-123',
      };
      const result = mapSdkEvent(nullEventStreamEvent);
      expect(result).toEqual([]);
    });

    test('handles stream_event with unknown delta type', () => {
      const unknownDeltaStreamEvent = {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'some_future_delta', data: 'xyz' },
          index: 0,
        },
        parent_tool_use_id: null,
        uuid: 'uuid-unknown-delta',
        session_id: 'session-123',
      };
      const result = mapSdkEvent(unknownDeltaStreamEvent);
      expect(result).toEqual([]);
    });
  });

  // --- Tool progress events ---

  describe('tool_progress events', () => {
    test('maps to tool:progress with elapsed time', () => {
      const result = mapSdkEvent(mockToolProgressEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamToolProgress;
      expect(event.type).toBe('tool:progress');
      expect(event.toolUseId).toBe('tu-1');
      expect(event.toolName).toBe('Bash');
      expect(event.elapsedSeconds).toBe(5.2);
    });
  });

  // --- Auth status events ---

  describe('auth_status events', () => {
    test('maps to auth:status', () => {
      const result = mapSdkEvent(mockAuthStatusEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamAuthStatus;
      expect(event.type).toBe('auth:status');
      expect(event.isAuthenticating).toBe(true);
      expect(event.output).toEqual(['Authenticating...']);
      expect(event.error).toBeUndefined();
    });

    test('includes error when present', () => {
      const result = mapSdkEvent(mockAuthStatusWithErrorEvent);
      expect(result).toHaveLength(1);
      const event = result[0] as StreamAuthStatus;
      expect(event.type).toBe('auth:status');
      expect(event.isAuthenticating).toBe(false);
      expect(event.error).toBe('Invalid API key');
    });
  });

  // --- Unknown events ---

  describe('unknown events', () => {
    test('returns empty array for unrecognized type', () => {
      const result = mapSdkEvent({ type: 'some_future_event_type' });
      expect(result).toEqual([]);
    });

    test('logs warning for unrecognized type', () => {
      mapSdkEvent({ type: 'some_future_event_type' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Unhandled SDK event type: some_future_event_type'
        )
      );
    });

    test('handles completely empty event object gracefully', () => {
      const result = mapSdkEvent({});
      expect(result).toEqual([]);
    });
  });
});
