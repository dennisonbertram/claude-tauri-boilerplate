import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { streamClaude } from '../services/claude';
import {
  addMessage,
  createSession,
  getSession,
  updateClaudeSessionId,
} from '../db';
import type { ChatRequest } from '@claude-tauri/shared';

export function createChatRouter(db: Database) {
  const router = new Hono();

  router.post('/', async (c) => {
    const body = (await c.req.json()) as ChatRequest;
    const messages = body.messages || [];
    let sessionId = body.sessionId;

    // Extract the last user message as the prompt
    const lastUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .pop() as any;
    if (!lastUserMessage) {
      return c.json({ error: 'No user message provided' }, 400);
    }

    // AI SDK v6 sends parts array instead of content string
    const prompt: string =
      lastUserMessage.content ??
      lastUserMessage.parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('') ??
      '';

    // If no sessionId, auto-create a session
    if (!sessionId) {
      const newSession = createSession(db, crypto.randomUUID(), 'New Chat');
      sessionId = newSession.id;
    }

    // Ensure session exists in DB (it may have been created by the frontend)
    const existingSession = getSession(db, sessionId);
    if (!existingSession) {
      createSession(db, sessionId, 'New Chat');
    }

    // Persist the user message before streaming
    addMessage(db, crypto.randomUUID(), sessionId, 'user', prompt);

    // Capture sessionId in closure for use in the stream
    const appSessionId = sessionId;

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let claudeSessionId: string | undefined;
        let startSent = false;
        let fullResponse = '';
        let streamErrored = false;

        try {
          for await (const event of streamClaude({
            prompt,
            sessionId: existingSession?.claudeSessionId ?? undefined,
          })) {
            if (event.type === 'session') {
              claudeSessionId = event.sessionId;
            } else if (event.type === 'text-delta') {
              // AI SDK v6 requires start + text-start before text-delta
              if (!startSent) {
                writer.write({ type: 'start' });
                writer.write({ type: 'text-start', id: 'text-0' });
                startSent = true;
              }
              writer.write({
                type: 'text-delta',
                id: 'text-0',
                delta: event.text,
              });
              fullResponse += event.text;
            }
          }
        } catch {
          streamErrored = true;
          throw new Error('Stream error');
        } finally {
          // Persist the assistant response only if streaming completed without error
          if (!streamErrored && fullResponse.length > 0) {
            addMessage(
              db,
              crypto.randomUUID(),
              appSessionId,
              'assistant',
              fullResponse
            );
          }

          // Update the claude session ID on the app session
          if (claudeSessionId) {
            updateClaudeSessionId(db, appSessionId, claudeSessionId);
          }
        }

        // Send sessionId as message metadata in the finish event
        writer.write({
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: {
            sessionId: claudeSessionId,
            appSessionId,
          },
        });
      },
      onError: (error) => {
        return error instanceof Error ? error.message : 'Stream error';
      },
    });

    return createUIMessageStreamResponse({ stream });
  });

  return router;
}
