import { query } from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeStreamOptions {
  prompt: string;
  sessionId?: string;
}

export type ClaudeStreamEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'text-delta'; text: string };

export async function* streamClaude(
  options: ClaudeStreamOptions
): AsyncGenerator<ClaudeStreamEvent> {
  const queryOptions: Record<string, unknown> = {
    includePartialMessages: true,
    maxTurns: 1,
  };

  if (options.sessionId) {
    queryOptions.resume = options.sessionId;
  }

  const stream = query({
    prompt: options.prompt,
    options: queryOptions,
  });

  for await (const event of stream) {
    if (event.type === 'system' && event.subtype === 'init') {
      yield { type: 'session', sessionId: (event as any).session_id };
    }

    if (
      event.type === 'stream_event' &&
      (event as any).event?.type === 'content_block_delta'
    ) {
      const delta = (event as any).event.delta?.text;
      if (delta) {
        yield { type: 'text-delta', text: delta };
      }
    }
  }
}
