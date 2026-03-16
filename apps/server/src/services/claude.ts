import { query } from '@anthropic-ai/claude-agent-sdk';
import { mapSdkEvent } from './event-mapper';
import type { StreamEvent } from '@claude-tauri/shared';

export interface ClaudeStreamOptions {
  prompt: string;
  sessionId?: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
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

  if (options.effort) {
    queryOptions.effort = options.effort;
  }

  if (options.cwd) {
    queryOptions.cwd = options.cwd;
  }

  // Clear API key so SDK uses subscription auth, not API key billing
  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = '';

  const stream = query({
    prompt: options.prompt,
    options: queryOptions,
  });

  try {
    for await (const event of stream) {
      const mapped = mapSdkEvent(event);
      for (const streamEvent of mapped) {
        yield streamEvent;
      }
    }
  } finally {
    process.env.ANTHROPIC_API_KEY = savedKey ?? '';
  }
}
