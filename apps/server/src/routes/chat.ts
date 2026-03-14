import { Hono } from 'hono';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { streamClaude } from '../services/claude';
import type { ChatRequest } from '@claude-tauri/shared';

const chatRouter = new Hono();

chatRouter.post('/', async (c) => {
  const body = (await c.req.json()) as ChatRequest;
  const messages = body.messages || [];
  const sessionId = body.sessionId;

  // Extract the last user message as the prompt
  const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
  if (!lastUserMessage) {
    return c.json({ error: 'No user message provided' }, 400);
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let claudeSessionId: string | undefined;

      for await (const event of streamClaude({
        prompt: lastUserMessage.content,
        sessionId,
      })) {
        if (event.type === 'session') {
          claudeSessionId = event.sessionId;
        } else if (event.type === 'text-delta') {
          writer.write({
            type: 'text-delta',
            id: 'text-0',
            delta: event.text,
          });
        }
      }

      // Send sessionId as message metadata in the finish event
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
