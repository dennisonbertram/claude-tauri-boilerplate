import type { Database } from 'bun:sqlite';
import type { ChatRequest, AgentProfile } from '@claude-tauri/shared';
import { streamClaude } from '../services/claude';
import { generateRandomName } from '../services/name-generator';
import {
  addMessage,
  clearClaudeSessionId,
  createSession,
  getSession,
  getMessages,
  updateClaudeSessionId,
  updateSessionModel,
  updateWorkspaceClaudeSession,
  linkSessionToWorkspace,
  linkSessionToProfile,
  setSessionLinearIssue,
  getSessionForWorkspace,
} from '../db';
import {
  logChat,
  logChatDebug,
  summarizeStreamEvent,
  classifyStreamError,
  appendAttachmentsToPrompt,
  buildStartupPrompt,
} from './chat-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamingContext {
  db: Database;
  body: ChatRequest;
  prompt: string;
  sessionId: string | null | undefined;
  model: string | undefined;
  effort: ChatRequest['effort'];
  thinkingBudgetTokens: number | undefined;
  permissionMode: ChatRequest['permissionMode'];
  provider: ChatRequest['provider'];
  providerConfig: ChatRequest['providerConfig'];
  runtimeEnv: ChatRequest['runtimeEnv'];
  workspaceId: string | undefined;
  workspaceCwd: string | undefined;
  workspaceClaudeSessionId: string | undefined;
  additionalDirectories: string[];
  resolvedLinearIssue: ChatRequest['linearIssue'] | undefined;
  resolvedAttachmentRefs: string[];
  systemPrompt: string | undefined;
  workspaceNotesContent: string | undefined;
  workspaceGithubIssuePrompt: string | undefined;
  agentProfile: AgentProfile | null;
}

// ---------------------------------------------------------------------------
// Stream execution callback
// ---------------------------------------------------------------------------

/**
 * Creates the `execute` callback for `createUIMessageStream`.
 * Encapsulates all streaming logic: session creation, SDK iteration,
 * retry on stale session, and AI SDK protocol event writing.
 */
export function buildStreamExecute(ctx: StreamingContext) {
  return async ({ writer }: { writer: any }) => {
    const {
      db,
      body,
      prompt,
      model,
      effort,
      thinkingBudgetTokens,
      permissionMode,
      provider,
      providerConfig,
      runtimeEnv,
      workspaceId,
      workspaceCwd,
      workspaceClaudeSessionId,
      additionalDirectories,
      resolvedLinearIssue,
      resolvedAttachmentRefs,
      systemPrompt,
      workspaceNotesContent,
      workspaceGithubIssuePrompt,
      agentProfile,
    } = ctx;

    const callerSessionId = ctx.sessionId;
    const existingSession = callerSessionId ? getSession(db, callerSessionId as string) : null;

    // Build the full prompt with context
    const startupPrompt = await buildStartupPrompt(workspaceCwd, systemPrompt);

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

    const notesContext = workspaceNotesContent
      ? `<notes>\n${workspaceNotesContent}\n</notes>`
      : undefined;

    const promptWithContext = [startupPrompt, notesContext, linearIssuePrompt, workspaceGithubIssuePrompt, prompt]
      .filter((value): value is string => Boolean(value))
      .join('\n\n');

    // Persisted user content is the raw user prompt (plus attachments),
    // not the injected startup/system instructions or other context blocks.
    const promptForDb = appendAttachmentsToPrompt(prompt, resolvedAttachmentRefs);

    const promptWithContextAndAttachments = appendAttachmentsToPrompt(
      promptWithContext,
      resolvedAttachmentRefs
    );

    // If the session has prior DB messages but no claudeSessionId to resume
    // (e.g., a forked session), inject the conversation history into the prompt.
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

    let claudeSessionId: string | undefined;
    let startSent = false;
    let fullResponse = '';
    let streamErrored = false;
    let currentTextId = 0;
    let activeTextBlockIndex: number | null = null;

    // Deferred session state
    let appSessionId: string | undefined;
    let sessionEnsured = false;

    function ensureSession() {
      if (sessionEnsured) return;
      sessionEnsured = true;

      if (callerSessionId) {
        appSessionId = callerSessionId as string;
        if (!existingSession) {
          createSession(
            db,
            callerSessionId as string,
            generateRandomName(),
            resolvedLinearIssue ?? undefined,
            model
          );
        } else if (resolvedLinearIssue) {
          setSessionLinearIssue(db, callerSessionId as string, resolvedLinearIssue);
        }
        if (existingSession && model && existingSession.model !== model) {
          updateSessionModel(db, callerSessionId as string, model);
        }
      } else {
        const existingWorkspaceSession = workspaceId ? getSessionForWorkspace(db, workspaceId) : null;
        if (existingWorkspaceSession) {
          appSessionId = existingWorkspaceSession.id;
          if (resolvedLinearIssue) {
            setSessionLinearIssue(db, appSessionId, resolvedLinearIssue);
          }
          if (model && existingWorkspaceSession.model !== model) {
            updateSessionModel(db, appSessionId, model);
          }
        } else {
          appSessionId = crypto.randomUUID();
          createSession(db, appSessionId, generateRandomName(), resolvedLinearIssue ?? undefined, model);
        }
      }

      if (workspaceId) {
        linkSessionToWorkspace(db, appSessionId!, workspaceId);
      }
      if (body.profileId) {
        linkSessionToProfile(db, appSessionId!, body.profileId);
      }

      addMessage(db, crypto.randomUUID(), appSessionId!, 'user', promptForDb);
    }

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
          agentProfile,
        })) {
          ensureSession();

          logChatDebug('sdk event', summarizeStreamEvent(event));

          if (event.type === 'text:delta') {
            if (!startSent) {
              logChatDebug('opened assistant text stream');
              writer.write({ type: 'start' });
              writer.write({
                type: 'text-start',
                id: `text-${currentTextId}`,
              });
              startSent = true;
              activeTextBlockIndex = event.blockIndex;
            } else if (event.blockIndex !== activeTextBlockIndex) {
              activeTextBlockIndex = event.blockIndex;
            }
            writer.write({
              type: 'text-delta',
              id: `text-${currentTextId}`,
              delta: event.text,
            });
            (writer as any).write({ type: 'data-stream-event', data: event, transient: true });
            fullResponse += event.text;
          } else {
            // Handle protocol-relevant events before writing to data channel
            if (event.type === 'session:init') {
              claudeSessionId = event.sessionId;
              // Inject appSessionId so the frontend can use the correct ID
              (event as any).appSessionId = appSessionId ?? callerSessionId ?? undefined;
              logChat('info', 'claude session initialized', {
                claudeSessionId,
                appSessionId: appSessionId ?? callerSessionId ?? null,
                workspaceId: workspaceId ?? null,
              });
            }
            // Non-text events: data channel for the custom event handler
            (writer as any).write({ type: 'data-stream-event', data: event, transient: true });
          }
        }
        break;
      } catch (err) {
        const isRawSessionIdError =
          currentResumeId !== undefined &&
          err instanceof Error &&
          err.message.trim() === currentResumeId;

        const isStaleSession =
          !retried &&
          currentResumeId &&
          err instanceof Error &&
          (err.message.includes('No conversation found with session ID') || isRawSessionIdError);

        if (isStaleSession) {
          retried = true;
          currentResumeId = undefined;
          const sessionToClear = appSessionId || (callerSessionId as string | undefined);
          if (sessionToClear) {
            clearClaudeSessionId(db, sessionToClear);
          }
          logChat('warn', 'stale session ID detected, retrying without resume', {
            sessionId: currentResumeId,
          });
          continue;
        }

        streamErrored = true;

        const errorEvent = classifyStreamError(err);
        (writer as any).write({ type: 'data-stream-event', data: errorEvent, transient: true });

        console.error('[chat-stream]', err);

        throw err instanceof Error ? err : new Error(String(err));
      } finally {
        if (appSessionId && !streamErrored && fullResponse.length > 0) {
          addMessage(
            db,
            crypto.randomUUID(),
            appSessionId,
            'assistant',
            fullResponse
          );
        }

        if (appSessionId && claudeSessionId) {
          updateClaudeSessionId(db, appSessionId, claudeSessionId);
        }

        if (workspaceId && claudeSessionId) {
          updateWorkspaceClaudeSession(db, workspaceId, claudeSessionId);
        }
      }
    } // end while (true) retry loop

    if (!startSent) {
      writer.write({ type: 'start' });
    }

    if (startSent && activeTextBlockIndex !== null) {
      writer.write({
        type: 'text-end',
        id: `text-${currentTextId}`,
      });
    }

    logChatDebug('sending finish event', {
      startSent,
      responseLength: fullResponse.length,
    });
    writer.write({
      type: 'finish',
      finishReason: 'stop',
      messageMetadata: {
        sessionId: claudeSessionId,
        appSessionId,
      },
    });
  };
}
