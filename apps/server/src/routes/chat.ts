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
import type { ChatRequest, StreamEvent, StreamError } from '@claude-tauri/shared';

/**
 * Classify an error thrown during Claude streaming into a StreamError event
 * that the frontend can handle gracefully.
 */
function classifyStreamError(err: unknown): StreamError {
  if (!(err instanceof Error)) {
    return {
      type: 'error',
      errorType: 'unknown',
      message: 'An unknown error occurred',
    };
  }

  const status = (err as any).status;
  const code = (err as any).code;

  // Rate limit
  if (status === 429) {
    return {
      type: 'error',
      errorType: 'rate_limit',
      message: err.message || 'Rate limited. Please try again later.',
    };
  }

  // Auth failure
  if (status === 401 || status === 403) {
    return {
      type: 'error',
      errorType: 'auth',
      message: err.message || 'Authentication failed.',
    };
  }

  // Network timeout
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED') {
    return {
      type: 'error',
      errorType: 'network',
      message: err.message || 'Network error. Connection lost.',
    };
  }

  // Model/API error (catch-all for 4xx/5xx)
  if (typeof status === 'number' && status >= 400) {
    return {
      type: 'error',
      errorType: 'api',
      message: err.message || 'API error occurred.',
    };
  }

  // Generic error
  return {
    type: 'error',
    errorType: 'stream',
    message: err.message || 'Stream error',
  };
}

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

    // Look up an existing session (if provided) so we can resume
    // the Claude conversation. Session creation is deferred until
    // we get the first successful SDK response to avoid orphaned
    // sessions when the SDK call fails (Bug #37).
    const existingSession = sessionId ? getSession(db, sessionId) : null;

    // Capture the caller-supplied sessionId (may be null for new chats)
    const callerSessionId = sessionId;

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let claudeSessionId: string | undefined;
        let startSent = false;
        let fullResponse = '';
        let streamErrored = false;
        // Track active text blocks for proper AI SDK text ID management
        let currentTextId = 0;
        let activeTextBlockIndex: number | null = null;

        // Deferred session state: the session and user message are only
        // persisted once we receive the first successful SDK event.
        let appSessionId: string | undefined;
        let sessionEnsured = false;

        /**
         * Ensure the session and user message exist in the DB.
         * Called lazily on the first successful SDK event so that
         * a failing SDK call never creates an orphaned session.
         */
        function ensureSession() {
          if (sessionEnsured) return;
          sessionEnsured = true;

          if (callerSessionId) {
            appSessionId = callerSessionId;
            if (!existingSession) {
              createSession(db, callerSessionId, 'New Chat');
            }
          } else {
            appSessionId = crypto.randomUUID();
            createSession(db, appSessionId, 'New Chat');
          }

          // Persist the user message now that we have a valid session
          addMessage(db, crypto.randomUUID(), appSessionId, 'user', prompt);
        }

        try {
          for await (const event of streamClaude({
            prompt,
            sessionId: existingSession?.claudeSessionId ?? undefined,
          })) {
            // Lazily create the session on first successful event
            ensureSession();

            // Send every event as data for the custom event handler (rich UI)
            writer.write({ type: 'data', data: [event] });

            // Also map key events to AI SDK protocol for useChat() compatibility
            switch (event.type) {
              case 'session:init':
                claudeSessionId = event.sessionId;
                break;

              case 'text:delta':
                if (!startSent) {
                  writer.write({ type: 'start' });
                  writer.write({
                    type: 'text-start',
                    id: `text-${currentTextId}`,
                  });
                  startSent = true;
                  activeTextBlockIndex = event.blockIndex;
                } else if (event.blockIndex !== activeTextBlockIndex) {
                  // New text block -- close previous and start new
                  currentTextId++;
                  writer.write({
                    type: 'text-start',
                    id: `text-${currentTextId}`,
                  });
                  activeTextBlockIndex = event.blockIndex;
                }
                writer.write({
                  type: 'text-delta',
                  id: `text-${currentTextId}`,
                  delta: event.text,
                });
                fullResponse += event.text;
                break;

              case 'permission:request':
                // Permission requests are on the data channel for the
                // frontend to display the approval dialog. The stream
                // continues -- the SDK is paused internally waiting for
                // the permission decision via the permission endpoint.
                break;

              case 'permission:denied':
                // Denied permissions are on the data channel for the
                // frontend to show a notification.
                break;

              case 'error':
                // Errors are already on the data channel; no additional
                // AI SDK protocol action needed since the stream continues
                break;

              case 'session:result':
                // Result is on the data channel for the frontend reducer
                break;
            }
          }
        } catch (err) {
          streamErrored = true;

          // Classify the error and send it on the data channel so
          // the frontend can display a useful message
          const errorEvent = classifyStreamError(err);
          writer.write({ type: 'data', data: [errorEvent] });

          // Log to stderr for server-side debugging
          console.error('[chat-stream]', err);

          // Re-throw so the AI SDK onError handler can finalize the stream
          throw err instanceof Error ? err : new Error(String(err));
        } finally {
          // Persist the assistant response only if streaming completed without error
          // and a session was actually created
          if (appSessionId && !streamErrored && fullResponse.length > 0) {
            addMessage(
              db,
              crypto.randomUUID(),
              appSessionId,
              'assistant',
              fullResponse
            );
          }

          // Update the claude session ID on the app session
          if (appSessionId && claudeSessionId) {
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
