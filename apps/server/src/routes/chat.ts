import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { isAbsolute, normalize, resolve } from 'node:path';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { streamClaude } from '../services/claude';
import { generateRandomName } from '../services/name-generator';
import { z } from 'zod';
import {
  addMessage,
  clearClaudeSessionId,
  createSession,
  getSession,
  getWorkspace,
  updateClaudeSessionId,
  updateWorkspaceClaudeSession,
  linkSessionToWorkspace,
} from '../db';
import type { ChatRequest, StreamEvent, StreamError } from '@claude-tauri/shared';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  parts: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
      })
    )
    .optional(),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  sessionId: z.string().optional(),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
  workspaceId: z.string().optional(),
  attachments: z.array(z.string().min(1)).optional(),
});

function sanitizeAttachmentReference(reference: string, workspaceCwd: string): string {
  const noPrefix = reference.replace(/^@/, '');
  if (isAbsolute(noPrefix)) {
    throw new Error(`Invalid attachment reference: ${reference}`);
  }
  const normalized = normalize(noPrefix);
  if (normalized === '..' || /(?:^|[\\/])\.\.(?:$|[\\/])/.test(normalized)) {
    throw new Error(`Invalid attachment reference: ${reference}`);
  }
  const absolutePath = resolve(workspaceCwd, normalized);
  const normalizedWorkspaceCwd = resolve(workspaceCwd);
  if (!absolutePath.startsWith(normalizedWorkspaceCwd + '/')) {
    throw new Error(`Invalid attachment reference: ${reference}`);
  }
  return normalized;
}

function resolveWorkspaceAttachments(attachments: string[], workspaceCwd: string): string[] {
  return attachments.map((attachment) => sanitizeAttachmentReference(attachment, workspaceCwd));
}

function appendAttachmentsToPrompt(prompt: string, attachments: string[]): string {
  const normalized = attachments.map((attachment) => attachment.replace(/^@?/, ''));
  const mentioned = new Set(
    prompt
      .match(/@\S+/g)
      ?.map((item) => item.slice(1))
      .map((item) => item.replace(/[)\],.]*$/, '')) ?? []
  );
  const additional = normalized.filter((item) => !mentioned.has(item));
  if (additional.length === 0) {
    return prompt;
  }
  const lines = additional.map((item) => `- @${item}`).join('\n');
  return `${prompt}\n\nAttached files:\n${lines}`;
}

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
    console.log('[chat] === NEW CHAT REQUEST ===');
    const bodyRaw = await c.req.json();
    const parsed = chatRequestSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid chat request payload', details: parsed.error.issues },
        400
      );
    }
    const body = parsed.data as ChatRequest;
    console.log('[chat] body:', JSON.stringify(body, null, 2));
    const messages = body.messages;
    let sessionId = body.sessionId;
    const model = body.model;
    const effort = body.effort;
    const workspaceId = body.workspaceId;
    const attachmentRefs = body.attachments ?? [];
    let resolvedAttachmentRefs: string[] = attachmentRefs;

    // Extract the last user message as the prompt
    const lastUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .pop() as any;
    if (!lastUserMessage) {
      console.log('[chat] ERROR: No user message found');
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
    const promptWithAttachments = appendAttachmentsToPrompt(prompt, resolvedAttachmentRefs);
    console.log('[chat] Extracted prompt:', promptWithAttachments);
    console.log('[chat] sessionId:', sessionId);

    // Workspace validation (when workspaceId is provided)
    let workspaceCwd: string | undefined;
    let workspaceClaudeSessionId: string | undefined;
    if (workspaceId) {
      const workspace = getWorkspace(db, workspaceId);
      if (!workspace) {
        return c.json({ error: 'Workspace not found' }, 404);
      }
      const terminalStatuses = ['error', 'merged', 'archived'];
      if (terminalStatuses.includes(workspace.status)) {
        return c.json(
          { error: `Workspace is in '${workspace.status}' state and cannot be used for chat` },
          400
        );
      }
      workspaceCwd = workspace.worktreePath;
      workspaceClaudeSessionId = workspace.claudeSessionId ?? undefined;
      console.log('[chat] workspace cwd:', workspaceCwd, 'claudeSessionId:', workspaceClaudeSessionId);
      if (attachmentRefs.length > 0) {
        try {
          resolvedAttachmentRefs = resolveWorkspaceAttachments(attachmentRefs, workspaceCwd);
        } catch {
          return c.json(
            {
              error: 'Invalid attachment reference',
              code: 'INVALID_ATTACHMENT_REFERENCE',
            },
            400
          );
        }
      }
    }

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
              createSession(db, callerSessionId, generateRandomName());
            }
          } else {
            appSessionId = crypto.randomUUID();
            createSession(db, appSessionId, generateRandomName());
          }

          // Link the session to the workspace if applicable
          if (workspaceId) {
            linkSessionToWorkspace(db, appSessionId, workspaceId);
          }

          // Persist the user message now that we have a valid session
          addMessage(db, crypto.randomUUID(), appSessionId, 'user', promptWithAttachments);
        }

        // Determine the Claude session ID for resume:
        // 1. Existing app session's claudeSessionId (explicit sessionId provided)
        // 2. Workspace's stored claudeSessionId (workspaceId provided, no explicit sessionId)
        let currentResumeId: string | undefined =
          existingSession?.claudeSessionId ?? workspaceClaudeSessionId ?? undefined;
        let retried = false;

        // eslint-disable-next-line no-constant-condition
        while (true) {
        try {
          for await (const event of streamClaude({
            prompt: promptWithAttachments,
            sessionId: currentResumeId,
            model,
            effort,
            cwd: workspaceCwd,
          })) {
            // Lazily create the session on first successful event
            ensureSession();

            console.log('[chat] SDK event:', JSON.stringify(event).slice(0, 200));

            // text:delta events: send AI SDK protocol events FIRST, then data channel
            // This ensures start/text-start arrive before the data event.
            // We map ALL Claude text blocks into a single AI SDK text stream
            // to avoid creating multiple assistant messages in useChat.
            if (event.type === 'text:delta') {
              if (!startSent) {
                console.log('[chat] Sending start + text-start');
                writer.write({ type: 'start' });
                writer.write({
                  type: 'text-start',
                  id: `text-${currentTextId}`,
                });
                startSent = true;
                activeTextBlockIndex = event.blockIndex;
              } else if (event.blockIndex !== activeTextBlockIndex) {
                // Track the new block index but do NOT create a new text stream.
                // Multiple Claude blockIndex values are an internal detail.
                activeTextBlockIndex = event.blockIndex;
              }
              writer.write({
                type: 'text-delta',
                id: `text-${currentTextId}`,
                delta: event.text,
              });
              // Also send on data channel for rich UI (useStreamEvents)
              (writer as any).write({ type: 'data-stream-event', data: event });
              fullResponse += event.text;
            } else {
              // Non-text events: data channel for the custom event handler
              (writer as any).write({ type: 'data-stream-event', data: event });

              // Handle protocol-relevant events
              if (event.type === 'session:init') {
                claudeSessionId = event.sessionId;
                console.log('[chat] Got session:init, claudeSessionId:', claudeSessionId);
              }
            }
          }
          break; // stream completed successfully
        } catch (err) {
          // Auto-recover from stale session ID (e.g., after server restart).
          // If Claude can't find the session, clear the stale ID and retry once
          // without resuming — transparent to the user.
          const isStaleSession =
            !retried &&
            currentResumeId &&
            err instanceof Error &&
            err.message.includes('No conversation found with session ID');

          if (isStaleSession) {
            retried = true;
            currentResumeId = undefined;
            if (appSessionId) {
              clearClaudeSessionId(db, appSessionId);
            }
            console.warn('[chat] Stale session ID detected, retrying without resume');
            continue;
          }

          streamErrored = true;

          // Classify the error and send it on the data channel so
          // the frontend can display a useful message
          const errorEvent = classifyStreamError(err);
          (writer as any).write({ type: 'data-stream-event', data: errorEvent });

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

          // Persist the claude session ID on the workspace for future resume
          if (workspaceId && claudeSessionId) {
            updateWorkspaceClaudeSession(db, workspaceId, claudeSessionId);
          }
        }
        } // end while (true) retry loop

        // Ensure `start` was sent (AI SDK requires it before `finish`)
        if (!startSent) {
          writer.write({ type: 'start' });
        }

        // Close any open text block before finishing (AI SDK v6 protocol compliance)
        if (startSent && activeTextBlockIndex !== null) {
          writer.write({
            type: 'text-end',
            id: `text-${currentTextId}`,
          });
        }

        // Send sessionId as message metadata in the finish event
        console.log('[chat] Sending finish event. startSent:', startSent, 'fullResponse length:', fullResponse.length);
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
