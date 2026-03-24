import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve } from 'node:path';
import { z } from 'zod';
import {
  PERMISSION_MODES,
  PROVIDER_CONFIG_FIELD_KEYS,
  PROVIDER_TYPES,
} from '@claude-tauri/shared';
import type { ProviderConfigFieldKey } from '@claude-tauri/shared';
import type { ChatRequest, StreamEvent, StreamError } from '@claude-tauri/shared';
import {
  buildAdditionalDirectoryPathPolicy,
  buildWorkspaceAttachmentPathPolicy,
  canonicalizePath,
  canonicalizeRoots,
  isPathWithinAnyRoot,
} from '../utils/paths';

const providerConfigShape = Object.fromEntries(
  PROVIDER_CONFIG_FIELD_KEYS.map((key) => [key, z.string().optional()])
) as Record<ProviderConfigFieldKey, z.ZodOptional<z.ZodString>>;

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().optional(),
  parts: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  sessionId: z.string().nullish(),
  profileId: z.string().uuid().optional(),
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
  linearIssue: z.object({ id: z.string(), title: z.string(), summary: z.string().optional(), url: z.string().optional() }).optional(),
  attachments: z.array(z.string().min(1)).optional(),
});

export const linearIssueSchema = z.object({
  id: z.string().min(1, 'issue id is required'),
  title: z.string().min(1, 'issue title is required'),
  summary: z.string().optional(),
  url: z.string().url().optional(),
});

export const CLIENT_SLASH_COMMANDS = new Set(['clear','new','restart','sessions','pr','prs','review','branch','browser','help','settings','model','cost','export','compact','add-dir']);

const CHAT_DEBUG_LOGS_ENABLED = process.env.CLAUDE_TAURI_DEBUG_LOGS === '1';

export function logChat(level: 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>) {
  const prefix = `[chat] ${message}`;
  if (level === 'warn') { if (fields) { console.warn(prefix, fields); return; } console.warn(prefix); return; }
  if (level === 'error') { if (fields) { console.error(prefix, fields); return; } console.error(prefix); return; }
  if (fields) { console.log(prefix, fields); return; }
  console.log(prefix);
}

export function logChatDebug(message: string, fields?: Record<string, unknown>) {
  if (!CHAT_DEBUG_LOGS_ENABLED) return;
  logChat('info', message, fields);
}

export function countConfiguredProviderValues(config: ChatRequest['providerConfig']): number {
  return Object.values(config ?? {}).filter((value) => Boolean(value?.trim())).length;
}

export function summarizeStreamEvent(event: StreamEvent): Record<string, unknown> {
  if (event.type === 'text:delta') return { type: event.type, blockIndex: event.blockIndex, textLength: event.text.length };
  if (event.type === 'session:init') return { type: event.type, sessionId: event.sessionId, model: event.model };
  if (event.type === 'error') return { type: event.type, errorType: event.errorType };
  return { type: event.type };
}

export function parseSlashCommand(prompt: string): string | null {
  if (!prompt.startsWith('/')) return null;
  const command = prompt.slice(1).trim().split(/\s+/)[0];
  if (!command || !/^[a-z][a-z0-9-]*$/i.test(command)) return null;
  return command.toLowerCase();
}

async function sanitizeAttachmentReference(reference: string, workspaceCwd: string, allowedRoots: string[], errorMessage: string): Promise<string> {
  const noPrefix = reference.replace(/^@/, '');
  if (isAbsolute(noPrefix)) throw new Error(errorMessage);
  const normalized = normalize(noPrefix);
  if (normalized === '..' || /(?:^|[\\/])\.\.(?:$|[\\/])/.test(normalized)) throw new Error(errorMessage);
  const absolutePath = resolve(workspaceCwd, normalized);
  const canonicalPath = await canonicalizePath(absolutePath);
  if (!isPathWithinAnyRoot(canonicalPath, allowedRoots)) throw new Error(errorMessage);
  return normalized;
}

export async function resolveWorkspaceAttachments(attachments: string[], workspaceCwd: string, allowedRoots: string[], errorMessage: string): Promise<string[]> {
  return Promise.all(attachments.map((a) => sanitizeAttachmentReference(a, workspaceCwd, allowedRoots, errorMessage)));
}

export async function normalizeWorkspaceAdditionalDirectories(input: string[], workspaceRoot: string, allowedRoots: string[], errorMessage: string): Promise<string[]> {
  const normalized = new Set<string>();
  for (const rawEntry of input) {
    const trimmed = rawEntry.trim();
    if (!trimmed) continue;
    const resolved = isAbsolute(trimmed) ? trimmed : resolve(workspaceRoot, trimmed);
    const canonical = await canonicalizePath(resolved);
    if (!isPathWithinAnyRoot(canonical, allowedRoots)) throw new Error(errorMessage);
    normalized.add(canonical);
  }
  return [...normalized];
}

export function appendAttachmentsToPrompt(prompt: string, attachments: string[]): string {
  const normalized = attachments.map((a) => a.replace(/^@?/, ''));
  const mentioned = new Set(prompt.match(/@\S+/g)?.map((i) => i.slice(1)).map((i) => i.replace(/[)\],.]*$/, '')) ?? []);
  const additional = normalized.filter((i) => !mentioned.has(i));
  if (additional.length === 0) return prompt;
  return `${prompt}\n\nAttached files:\n${additional.map((i) => `- @${i}`).join('\n')}`;
}

const DEFAULT_GLOBAL_INSTRUCTION_PATH = '/Library/Application Support/ClaudeCode/CLAUDE.md';

function resolveInstructionPath(overridePath: string | undefined, fallbackPath: string): string {
  const trimmed = overridePath?.trim();
  return trimmed ? trimmed : fallbackPath;
}

async function readInstructionFile(filePath: string): Promise<{ path: string; exists: boolean; content: string }> {
  try { const file = Bun.file(filePath); const exists = await file.exists(); if (!exists) return { path: filePath, exists: false, content: '' }; return { path: filePath, exists: true, content: await file.text() }; } catch { return { path: filePath, exists: false, content: '' }; }
}

export async function buildStartupPrompt(workspaceRoot?: string, systemPrompt?: string): Promise<string> {
  const resolvedWorkspaceRoot = workspaceRoot ?? process.cwd();
  const userHome = homedir();
  const globalPath = resolveInstructionPath(process.env.CLAUDE_GLOBAL_INSTRUCTION_PATH, DEFAULT_GLOBAL_INSTRUCTION_PATH);
  const userPath = resolveInstructionPath(process.env.CLAUDE_USER_INSTRUCTION_PATH, join(userHome, '.claude', 'CLAUDE.md'));
  const workspaceManagedPath = join(resolvedWorkspaceRoot, '.claude', 'CLAUDE.md');
  const workspacePath = join(resolvedWorkspaceRoot, 'CLAUDE.md');
  const [globalFile, userFile, workspaceManagedFile, workspaceFile] = await Promise.all([readInstructionFile(globalPath), readInstructionFile(userPath), readInstructionFile(workspaceManagedPath), readInstructionFile(workspacePath)]);
  const preferredWorkspaceFile = workspaceFile.exists && workspaceFile.content.trim() ? { label: 'Workspace', content: workspaceFile.content.trim() } : workspaceManagedFile.exists && workspaceManagedFile.content.trim() ? { label: 'Workspace managed', content: workspaceManagedFile.content.trim() } : undefined;
  const instructionBlocks = [
    globalFile.exists && globalFile.content.trim() ? `[Global Instruction]\n${globalFile.content.trim()}` : undefined,
    userFile.exists && userFile.content.trim() ? `[User Instruction]\n${userFile.content.trim()}` : undefined,
    preferredWorkspaceFile ? `[${preferredWorkspaceFile.label} Instruction]\n${preferredWorkspaceFile.content}` : undefined,
    systemPrompt?.trim() ? `[System Prompt]\n${systemPrompt.trim()}` : undefined,
  ].filter((item): item is string => item !== undefined);
  return instructionBlocks.join('\n\n');
}

export function classifyStreamError(err: unknown): StreamError {
  if (!(err instanceof Error)) return { type: 'error', errorType: 'unknown', message: 'An unknown error occurred' };
  const status = (err as any).status;
  const code = (err as any).code;
  if (status === 429) return { type: 'error', errorType: 'rate_limit', message: err.message || 'Rate limited. Please try again later.' };
  if (status === 401 || status === 403) return { type: 'error', errorType: 'auth', message: err.message || 'Authentication failed.' };
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED') return { type: 'error', errorType: 'network', message: err.message || 'Network error. Connection lost.' };
  if (typeof status === 'number' && status >= 400) return { type: 'error', errorType: 'api', message: err.message || 'API error occurred.' };
  return { type: 'error', errorType: 'stream', message: err.message || 'Stream error' };
}

export { buildAdditionalDirectoryPathPolicy, buildWorkspaceAttachmentPathPolicy, canonicalizeRoots };
