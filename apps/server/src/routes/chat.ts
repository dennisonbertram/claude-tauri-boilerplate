import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import { Hono } from 'hono';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import {
  PERMISSION_MODES,
  PROVIDER_CONFIG_FIELD_KEYS,
  PROVIDER_TYPES,
  findMissingRequiredProviderConfigKeys,
  findUnsupportedProviderConfigKeys,
} from '@claude-tauri/shared';
import type { ProviderConfigFieldKey } from '@claude-tauri/shared';
import { streamClaude } from '../services/claude';
import { generateRandomName } from '../services/name-generator';
import { z } from 'zod';
import {
  addMessage,
  clearClaudeSessionId,
  createSession,
  getSession,
  getMessages,
  getWorkspace,
  updateClaudeSessionId,
  updateSessionModel,
  updateWorkspaceClaudeSession,
  linkSessionToWorkspace,
  setSessionLinearIssue,
} from '../db';
import type { ChatRequest, StreamEvent, StreamError } from '@claude-tauri/shared';

const providerConfigShape = Object.fromEntries(
  PROVIDER_CONFIG_FIELD_KEYS.map((key) => [key, z.string().optional()])
) as Record<ProviderConfigFieldKey, z.ZodOptional<z.ZodString>>;

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
  provider: z.enum(PROVIDER_TYPES).optional(),
  providerConfig: z.object(providerConfigShape).optional(),
  runtimeEnv: z.record(z.string(), z.string()).optional(),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
  thinkingBudgetTokens: z.number().int().min(1024).max(32000).optional(),
  permissionMode: z.enum(PERMISSION_MODES).optional(),
  workspaceId: z.string().optional(),
  additionalDirectories: z.array(z.string().min(1)).optional(),
  systemPrompt: z.string().optional(),
  linearIssue: z
    .object({
      id: z.string(),
      title: z.string(),
      summary: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
  attachments: z.array(z.string().min(1)).optional(),
});

const CLIENT_SLASH_COMMANDS = new Set([
  'clear',
  'new',
  'restart',
  'sessions',
  'pr',
  'prs',
  'review',
  'branch',
  'browser',
  'help',
  'settings',
  'model',
  'cost',
  'export',
  'compact',
  'add-dir',
]);

function parseSlashCommand(prompt: string): string | null {
  if (!prompt.startsWith('/')) return null;
  const command = prompt.slice(1).trim().split(/\s+/)[0];
  if (!command || !/^[a-z][a-z0-9-]*$/i.test(command)) return null;
  return command.toLowerCase();
}

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

const DEFAULT_GLOBAL_INSTRUCTION_PATH = '/Library/Application Support/ClaudeCode/CLAUDE.md';

function resolveInstructionPath(
  overridePath: string | undefined,
  fallbackPath: string
): string {
  const trimmed = overridePath?.trim();
  return trimmed ? trimmed : fallbackPath;
}

async function readInstructionFile(
  filePath: string
): Promise<{ path: string; exists: boolean; content: string }> {
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      return { path: filePath, exists: false, content: '' };
    }
    return { path: filePath, exists: true, content: await file.text() };
  } catch {
    return { path: filePath, exists: false, content: '' };
  }
}

async function buildStartupPrompt(
  workspaceRoot?: string,
  systemPrompt?: string
): Promise<string> {
  const resolvedWorkspaceRoot = workspaceRoot ?? process.cwd();
  const userHome = homedir();
  const globalPath = resolveInstructionPath(
    process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH,
    DEFAULT_GLOBAL_INSTRUCTION_PATH
  );
  const userPath = resolveInstructionPath(
    process.env.CLAUDE_USER_INSTRUCTION_PATH,
    join(userHome, '.claude', 'CLAUDE.md')
  );
  const workspaceManagedPath = join(resolvedWorkspaceRoot, '.claude', 'CLAUDE.md');
  const workspacePath = join(resolvedWorkspaceRoot, 'CLAUDE.md');

  const [globalFile, userFile, workspaceManagedFile, workspaceFile] = await Promise.all([
    readInstructionFile(globalPath),
    readInstructionFile(userPath),
    readInstructionFile(workspaceManagedPath),
    readInstructionFile(workspacePath),
  ]);

  const preferredWorkspaceFile =
    workspaceFile.exists && workspaceFile.content.trim()
      ? { label: 'Workspace', content: workspaceFile.content.trim() }
      : workspaceManagedFile.exists && workspaceManagedFile.content.trim()
        ? { label: 'Workspace managed', content: workspaceManagedFile.content.trim() }
        : undefined;

  const instructionBlocks = [
    globalFile.exists && globalFile.content.trim()
      ? `[Global Instruction]\n${globalFile.content.trim()}`
      : undefined,
    userFile.exists && userFile.content.trim()
      ? `[User Instruction]\n${userFile.content.trim()}`
      : undefined,
    preferredWorkspaceFile
      ? `[${preferredWorkspaceFile.label} Instruction]\n${preferredWorkspaceFile.content}`
      : undefined,
    systemPrompt?.trim() ? `[System Prompt]\n${systemPrompt.trim()}` : undefined,
  ].filter((item): item is string => item !== undefined);

  return instructionBlocks.join('\n\n');
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
  const linearIssueSchema = z.object({
    id: z.string().min(1, 'issue id is required'),
    title: z.string().min(1, 'issue title is required'),
    summary: z.string().optional(),
    url: z.string().url().optional(),
  });

  router.post('/', async (c) => {
    console.log('[chat] === NEW CHAT REQUEST ===');
    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      return c.json({ error: 'Malformed JSON request body' }, 400);
    }
    const parsed = chatRequestSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid chat request payload', details: parsed.error.issues },
        400
      );
    }
    const body = parsed.data as ChatRequest;

    const parsedLinearIssue =
      body.linearIssue === undefined
        ? { success: true, data: undefined }
        : linearIssueSchema.safeParse(body.linearIssue);
    if (!parsedLinearIssue.success) {
      return c.json(
        {
          error: 'Invalid linear issue payload',
          code: 'VALIDATION_ERROR',
          details: parsedLinearIssue.error.flatten(),
        },
        400
      );
    }

    console.log('[chat] body:', JSON.stringify(body, null, 2));
    const messages = body.messages;
    let sessionId = body.sessionId;
    const model = body.model;
    const effort = body.effort;
    const thinkingBudgetTokens = body.thinkingBudgetTokens;
    const permissionMode = body.permissionMode;
    const provider = body.provider;
    const providerConfig = body.providerConfig;
    const unsupportedProviderConfigKeys = findUnsupportedProviderConfigKeys(
      provider,
      providerConfig
    );
    if (unsupportedProviderConfigKeys.length > 0) {
      return c.json(
        {
          error: `providerConfig contains unsupported keys for provider "${provider ?? 'anthropic'}": ${unsupportedProviderConfigKeys.join(', ')}`,
          code: 'VALIDATION_ERROR',
          details: {
            provider,
            unsupportedKeys: unsupportedProviderConfigKeys,
          },
        },
        400
      );
    }

    const missingRequiredProviderConfigKeys = findMissingRequiredProviderConfigKeys(
      provider,
      providerConfig
    );
    if (missingRequiredProviderConfigKeys.length > 0) {
      return c.json(
        {
          error: `providerConfig is missing required keys for provider "${provider ?? 'anthropic'}": ${missingRequiredProviderConfigKeys.join(', ')}`,
          code: 'VALIDATION_ERROR',
          details: {
            provider,
            missingKeys: missingRequiredProviderConfigKeys,
          },
        },
        400
      );
    }
    const runtimeEnv = body.runtimeEnv;
    const workspaceId = body.workspaceId;
    let additionalDirectories = body.additionalDirectories ?? [];
    const systemPrompt = body.systemPrompt;
    const requestLinearIssue = body.linearIssue;
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
    let workspaceLinearIssue: ChatRequest['linearIssue'] | undefined;
    console.log('[chat] Extracted prompt:', prompt);
    console.log('[chat] sessionId:', sessionId);

    const slashCommand = parseSlashCommand(prompt);
    if (slashCommand) {
      if (CLIENT_SLASH_COMMANDS.has(slashCommand)) {
        return c.json(
          {
            error: `Slash command /${slashCommand} must be executed in the desktop client`,
            code: 'CLIENT_COMMAND',
            command: slashCommand,
          },
          400
        );
      }
    }

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
      if (additionalDirectories.length === 0 && workspace.additionalDirectories.length > 0) {
        additionalDirectories = workspace.additionalDirectories;
      }
      if (workspace.linearIssueId && workspace.linearIssueTitle) {
        workspaceLinearIssue = {
          id: workspace.linearIssueId,
          title: workspace.linearIssueTitle,
          summary: workspace.linearIssueSummary ?? undefined,
          url: workspace.linearIssueUrl ?? undefined,
        };
      }
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

    const startupPrompt = await buildStartupPrompt(workspaceCwd, systemPrompt);

    const resolvedLinearIssue = requestLinearIssue ?? workspaceLinearIssue;
    const linearIssuePrompt = resolvedLinearIssue
      ? [
          '[Linear Issue Context]',
          `- id: ${resolvedLinearIssue.id}`,
          `- title: ${resolvedLinearIssue.title}`,
          resolvedLinearIssue.summary ? `- summary: ${resolvedLinearIssue.summary}` : undefined,
          resolvedLinearIssue.url ? `- url: ${resolvedLinearIssue.url}` : undefined,
        ]
          .filter(Boolean)
          .join('\n')
      : undefined;
    const promptWithContext = [startupPrompt, linearIssuePrompt, prompt]
      .filter((value): value is string => Boolean(value))
      .join('\n\n');

    // Persisted user content should be the raw user prompt (plus attachments),
    // not the injected startup/system instructions or other context blocks.
    const promptForDb = appendAttachmentsToPrompt(prompt, resolvedAttachmentRefs);

    const promptWithContextAndAttachments = appendAttachmentsToPrompt(
      promptWithContext,
      resolvedAttachmentRefs
    );
    console.log('[chat] Extracted prompt with attachments:', promptWithContextAndAttachments);

    // Look up an existing session (if provided) so we can resume
    // the Claude conversation. Session creation is deferred until
    // we get the first successful SDK response to avoid orphaned
    // sessions when the SDK call fails (Bug #37).
    const existingSession = sessionId ? getSession(db, sessionId) : null;

    // If the session has prior DB messages but no claudeSessionId to resume
    // (e.g., a forked session), inject the conversation history into the prompt
    // so Claude has full context. Once the first response completes, the new
    // claudeSessionId is stored and subsequent turns resume normally via the SDK.
    let effectivePrompt = promptWithContextAndAttachments;
    if (existingSession && !existingSession.claudeSessionId) {
      const priorMessages = getMessages(db, existingSession.id);
      if (priorMessages.length > 0) {
        const historyText = priorMessages
          .map((m) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
          .join('\n\n');
        effectivePrompt = `<previous_conversation>\n${historyText}\n</previous_conversation>\n\nHuman: ${promptWithContextAndAttachments}`;
      }
    }

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
              createSession(
                db,
                callerSessionId,
                generateRandomName(),
                resolvedLinearIssue ?? undefined,
                model
              );
            } else if (resolvedLinearIssue) {
              setSessionLinearIssue(db, callerSessionId, resolvedLinearIssue);
            }
            if (existingSession && model && existingSession.model !== model) {
              updateSessionModel(db, callerSessionId, model);
            }
          } else {
            appSessionId = crypto.randomUUID();
            createSession(db, appSessionId, generateRandomName(), resolvedLinearIssue ?? undefined, model);
          }

          // Link the session to the workspace if applicable
          if (workspaceId) {
            linkSessionToWorkspace(db, appSessionId, workspaceId);
          }

          // Persist the user message now that we have a valid session
          addMessage(db, crypto.randomUUID(), appSessionId, 'user', promptForDb);
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
            prompt: effectivePrompt,
            sessionId: currentResumeId,
            model,
            effort,
            thinkingBudgetTokens,
            permissionMode,
            provider,
            providerConfig,
            runtimeEnv,
            cwd: workspaceCwd,
            additionalDirectories,
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
          const isRawSessionIdError =
            currentResumeId !== undefined &&
            err instanceof Error &&
            err.message.trim() === currentResumeId;

          // Auto-recover from stale session ID (e.g., after server restart).
          // If Claude can't find the session, clear the stale ID and retry once
          // without resuming — transparent to the user.
          const isStaleSession =
            !retried &&
            currentResumeId &&
            err instanceof Error &&
            (err.message.includes('No conversation found with session ID') || isRawSessionIdError);

          if (isStaleSession) {
            retried = true;
            currentResumeId = undefined;
            const sessionToClear = appSessionId || callerSessionId;
            if (sessionToClear) {
              clearClaudeSessionId(db, sessionToClear);
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
