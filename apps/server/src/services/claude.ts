import { query } from '@anthropic-ai/claude-agent-sdk';
import { mapSdkEvent } from './event-mapper';
import type { StreamEvent } from '@claude-tauri/shared';

export interface ClaudeStreamOptions {
  prompt: string;
  sessionId?: string;
  model?: string;
  cwd?: string;
}

export async function* streamClaude(
  options: ClaudeStreamOptions
): AsyncGenerator<StreamEvent> {
  const queryOptions: Record<string, unknown> = {
    includePartialMessages: true,
  };

  if (options.sessionId) {
    queryOptions.resume = options.sessionId;
  }

  if (options.model) {
    queryOptions.model = options.model;
  }

  if (options.cwd) {
    queryOptions.cwd = options.cwd;
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
