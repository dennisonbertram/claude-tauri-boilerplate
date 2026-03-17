import type {
  StreamEvent,
  StreamBlockStart,
  ContentBlock,
} from '@claude-tauri/shared';

/**
 * Maps a raw SDK event to zero or more application StreamEvents.
 * Returns an array because some SDK events map to multiple stream events
 * (e.g., an error result emits both a session:result and an error event).
 *
 * Unknown event types return an empty array and log a warning.
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
      if (event.type) {
        console.warn(
          `[event-mapper] Unhandled SDK event type: ${event.type}`
        );
      }
      return [];
  }
}

function mapSystemEvent(event: any): StreamEvent[] {
  switch (event.subtype) {
    case 'init':
      return [
        {
          type: 'session:init',
          sessionId: event.session_id,
          model: event.model,
          tools: event.tools,
          mcpServers: event.mcp_servers,
          claudeCodeVersion: event.claude_code_version,
          slashCommands: event.slash_commands,
        },
      ];
    case 'compact_boundary':
      return [{ type: 'compact-boundary' }];
    case 'status':
      return [{ type: 'status', status: event.status }];
    case 'rate_limit':
      return [
        {
          type: 'rate-limit',
          retryAfterSeconds: event.retry_after_seconds,
        },
      ];
    case 'hook_started':
      return [
        {
          type: 'hook:started',
          hookId: event.hook_id,
          hookName: event.hook_name,
          hookEvent: event.hook_event,
        },
      ];
    case 'hook_progress':
      return [
        {
          type: 'hook:progress',
          hookId: event.hook_id,
          hookName: event.hook_name,
          output: event.output,
        },
      ];
    case 'hook_response':
      return [
        {
          type: 'hook:response',
          hookId: event.hook_id,
          hookName: event.hook_name,
          response: event.response,
        },
      ];
    case 'task_started':
      return [
        {
          type: 'task:started',
          taskId: event.task_id,
          description: event.description,
          taskType: event.task_type,
        },
      ];
    case 'task_progress':
      return [
        {
          type: 'task:progress',
          taskId: event.task_id,
          progress: event.progress,
        },
      ];
    case 'task_notification':
      return [
        {
          type: 'task:notification',
          taskId: event.task_id,
          status: event.status,
          summary: event.summary,
          usage: event.usage
            ? {
                totalTokens: event.usage.total_tokens,
                toolUses: event.usage.tool_uses,
                durationMs: event.usage.duration_ms,
              }
            : undefined,
        },
      ];
    case 'files_persisted':
      return [{ type: 'files:persisted', files: event.files }];
    case 'tool_use_summary':
      return [
        {
          type: 'tool:summary',
          toolUseId: event.tool_use_id,
          toolName: event.tool_name,
          summary: event.summary,
        },
      ];
    case 'prompt_suggestion':
      return [
        { type: 'prompt:suggestion', suggestions: event.suggestions },
      ];
    case 'permission_request':
      return [
        {
          type: 'permission:request' as const,
          requestId: event.permission_request_id,
          toolName: event.tool_name,
          toolInput: event.tool_input ?? {},
          riskLevel: event.risk_level ?? 'medium',
        },
      ];
    case 'permission_denied':
      return [
        {
          type: 'permission:denied' as const,
          requestId: event.permission_request_id,
          toolName: event.tool_name,
        },
      ];
    case 'plan_start':
      return [
        {
          type: 'plan:start' as const,
          planId: event.plan_id ?? '',
        },
      ];
    case 'plan_content':
      return [
        {
          type: 'plan:content' as const,
          planId: event.plan_id ?? '',
          text: event.text ?? '',
        },
      ];
    case 'plan_complete':
      return [
        {
          type: 'plan:complete' as const,
          planId: event.plan_id ?? '',
        },
      ];
    default:
      console.warn(
        `[event-mapper] Unhandled system subtype: ${event.subtype}`
      );
      return [];
  }
}

function mapAssistantEvent(event: any): StreamEvent[] {
  const events: StreamEvent[] = [];

  // Map content blocks to our ContentBlock type
  const blocks: ContentBlock[] = (event.message?.content || []).map(
    (block: any) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
      if (block.type === 'thinking') {
        return {
          type: 'thinking' as const,
          thinking: block.thinking,
        };
      }
      // Pass through any unknown block types as-is
      return block;
    }
  );

  events.push({
    type: 'assistant:message',
    uuid: event.uuid,
    blocks,
    parentToolUseId: event.parent_tool_use_id,
    error: event.error,
  });

  // If there's an error on the assistant message itself, also emit an error event
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
  // Only forward synthetic (tool result) messages that have a parent tool use ID
  if (event.isSynthetic && event.parent_tool_use_id) {
    return [
      {
        type: 'tool:result',
        toolUseId: event.parent_tool_use_id,
        result: event.tool_use_result,
      },
    ];
  }
  // Skip replay messages and regular user echoes
  return [];
}

function mapResultEvent(event: any): StreamEvent[] {
  const result: StreamEvent[] = [
    {
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
    },
  ];

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
      const streamEvent: StreamBlockStart = {
        type: 'block:start',
        blockIndex: inner.index,
        blockType: block?.type ?? 'text',
      };
      if (block?.type === 'tool_use') {
        streamEvent.toolUseId = block.id;
        streamEvent.toolName = block.name;
      }
      return [streamEvent];
    }

    case 'content_block_delta': {
      const delta = inner.delta;
      if (delta?.type === 'text_delta') {
        return [
          {
            type: 'text:delta',
            text: delta.text,
            blockIndex: inner.index,
          },
        ];
      }
      if (delta?.type === 'thinking_delta') {
        return [
          {
            type: 'thinking:delta',
            thinking: delta.thinking,
            blockIndex: inner.index,
          },
        ];
      }
      if (delta?.type === 'input_json_delta') {
        return [
          {
            type: 'tool-input:delta',
            partialJson: delta.partial_json,
            blockIndex: inner.index,
          },
        ];
      }
      return [];
    }

    case 'content_block_stop':
      return [{ type: 'block:stop', blockIndex: inner.index }];

    case 'message_start':
    case 'message_delta':
    case 'message_stop':
      // These are informational; content is captured via content_block events
      return [];

    default:
      return [];
  }
}

function mapToolProgress(event: any): StreamEvent[] {
  return [
    {
      type: 'tool:progress',
      toolUseId: event.tool_use_id,
      toolName: event.tool_name,
      elapsedSeconds: event.elapsed_time_seconds,
    },
  ];
}

function mapAuthStatus(event: any): StreamEvent[] {
  return [
    {
      type: 'auth:status',
      isAuthenticating: event.isAuthenticating,
      output: event.output,
      error: event.error,
    },
  ];
}
