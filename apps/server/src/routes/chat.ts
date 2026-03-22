import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { Hono } from 'hono';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import {
  findMissingRequiredProviderConfigKeys,
  findUnsupportedProviderConfigKeys,
} from '@claude-tauri/shared';
import type { ChatRequest, AgentProfile } from '@claude-tauri/shared';
import {
  getProject,
  getWorkspace,
  getAgentProfile,
} from '../db';
import {
  chatRequestSchema,
  linearIssueSchema,
  CLIENT_SLASH_COMMANDS,
  logChat,
  logChatDebug,
  countConfiguredProviderValues,
  parseSlashCommand,
  normalizeWorkspaceAdditionalDirectories,
  resolveWorkspaceAttachments,
  buildAdditionalDirectoryPathPolicy,
  buildWorkspaceAttachmentPathPolicy,
  canonicalizeRoots,
} from './chat-helpers';
import { buildStreamExecute } from './chat-streaming';

export function createChatRouter(db: Database) {
  const router = new Hono();

  router.post('/', async (c) => {
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
    const body = parsed.data;
    logChat('info', 'request started', {
      sessionId: body.sessionId ?? null,
      workspaceId: body.workspaceId ?? null,
      profileId: body.profileId ?? null,
      messageCount: body.messages.length,
      provider: body.provider ?? 'anthropic',
      providerConfigCount: countConfiguredProviderValues(body.providerConfig),
      runtimeEnvCount: Object.keys(body.runtimeEnv ?? {}).length,
      additionalDirectoryCount: body.additionalDirectories?.length ?? 0,
      attachmentCount: body.attachments?.length ?? 0,
      hasSystemPrompt: Boolean(body.systemPrompt?.trim()),
      hasLinearIssue: Boolean(body.linearIssue),
    });

    const parsedLinearIssue =
      body.linearIssue === undefined
        ? ({ success: true as const, data: undefined })
        : linearIssueSchema.safeParse(body.linearIssue);
    if (!parsedLinearIssue.success) {
      return c.json(
        {
          error: 'Invalid linear issue payload',
          code: 'VALIDATION_ERROR',
          details: (parsedLinearIssue as any).error.flatten(),
        },
        400
      );
    }

    const messages = body.messages;
    const sessionId = body.sessionId;
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
          details: { provider, unsupportedKeys: unsupportedProviderConfigKeys },
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
          details: { provider, missingKeys: missingRequiredProviderConfigKeys },
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

    // Look up agent profile if profileId is provided
    let agentProfile: AgentProfile | null = null;
    if (body.profileId) {
      agentProfile = getAgentProfile(db, body.profileId) as AgentProfile | null;
      if (!agentProfile) {
        return c.json({ error: 'Agent profile not found', code: 'NOT_FOUND' }, 404);
      }
    }

    // Extract the last user message as the prompt
    const lastUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .pop() as any;
    if (!lastUserMessage) {
      logChat('warn', 'request missing user message', { sessionId, workspaceId });
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
    let workspaceGithubIssuePrompt: string | undefined;

    const slashCommand = parseSlashCommand(prompt);
    logChatDebug('request metadata', {
      providerConfigKeys: Object.entries(body.providerConfig ?? {})
        .filter(([, value]) => Boolean(value?.trim()))
        .map(([key]) => key),
      runtimeEnvKeys: Object.keys(body.runtimeEnv ?? {}),
      slashCommand: slashCommand ?? undefined,
    });
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
      const project = getProject(db, workspace.projectId);
      if (!project) {
        return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
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
      const additionalDirectoryPolicy = buildAdditionalDirectoryPathPolicy(
        project.repoPathCanonical,
        workspace.worktreePathCanonical
      );
      const additionalDirectoryRoots = await canonicalizeRoots(
        additionalDirectoryPolicy.allowedRoots
      );
      const effectiveAdditionalDirectories =
        additionalDirectories.length === 0 && workspace.additionalDirectories.length > 0
          ? workspace.additionalDirectories
          : additionalDirectories;
      if (effectiveAdditionalDirectories.length > 0) {
        try {
          additionalDirectories = await normalizeWorkspaceAdditionalDirectories(
            effectiveAdditionalDirectories,
            workspaceCwd,
            additionalDirectoryRoots,
            additionalDirectoryPolicy.errorMessage
          );
        } catch (error) {
          return c.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : additionalDirectoryPolicy.errorMessage,
              code: 'VALIDATION_ERROR',
            },
            400
          );
        }
      } else {
        additionalDirectories = [];
      }
      if (workspace.linearIssueId && workspace.linearIssueTitle) {
        workspaceLinearIssue = {
          id: workspace.linearIssueId,
          title: workspace.linearIssueTitle,
          summary: workspace.linearIssueSummary ?? undefined,
          url: workspace.linearIssueUrl ?? undefined,
        };
      }
      if (workspace.githubIssueNumber && workspace.githubIssueTitle) {
        workspaceGithubIssuePrompt = [
          '[GitHub Issue Context]',
          '<github-issue>',
          `#${workspace.githubIssueNumber}: ${workspace.githubIssueTitle}`,
          workspace.githubIssueUrl ? workspace.githubIssueUrl : undefined,
          workspace.githubIssueRepo ? `repo: ${workspace.githubIssueRepo}` : undefined,
          '</github-issue>',
        ]
          .filter((line): line is string => line !== undefined)
          .join('\n');
      }
      logChat('info', 'workspace context loaded', {
        workspaceId,
        hasStoredAdditionalDirectories: workspace.additionalDirectories.length > 0,
        hasWorkspaceLinearIssue: Boolean(workspaceLinearIssue),
        hasWorkspaceGithubIssue: Boolean(workspaceGithubIssuePrompt),
      });
      if (attachmentRefs.length > 0) {
        try {
          const attachmentPolicy = buildWorkspaceAttachmentPathPolicy(
            workspace.worktreePathCanonical
          );
          const attachmentRoots = await canonicalizeRoots(attachmentPolicy.allowedRoots);
          resolvedAttachmentRefs = await resolveWorkspaceAttachments(
            attachmentRefs,
            workspaceCwd,
            attachmentRoots,
            attachmentPolicy.errorMessage
          );
        } catch (error) {
          return c.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Invalid attachment reference',
              code: 'INVALID_ATTACHMENT_REFERENCE',
            },
            400
          );
        }
      }
    }

    // Read workspace notes if available
    let workspaceNotesContent: string | undefined;
    if (workspaceCwd) {
      try {
        const notesPath = join(workspaceCwd, '.context', 'notes.md');
        const notesFile = Bun.file(notesPath);
        if (await notesFile.exists()) {
          const notesText = await notesFile.text();
          if (notesText.trim()) {
            workspaceNotesContent = notesText.trim();
          }
        }
      } catch {
        // Best-effort
      }
    }

    const resolvedLinearIssue = requestLinearIssue ?? workspaceLinearIssue;

    const stream = createUIMessageStream({
      execute: buildStreamExecute({
        db,
        body: body as ChatRequest,
        prompt,
        sessionId,
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
      }),
      onError: (error) => {
        return error instanceof Error ? error.message : 'Stream error';
      },
    });

    return createUIMessageStreamResponse({ stream });
  });

  return router;
}
