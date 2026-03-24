import { z } from 'zod';

export const AGENT_PROFILE_GENERATION_SYSTEM_PROMPT = `You are an agent profile generator.
Create a concise, practical Claude agent profile from the user's request.

Return valid JSON only, with this shape:
{
  "name": "Short profile name",
  "description": "One-sentence summary",
  "icon": "Emoji or null",
  "color": "#rrggbb or null",
  "systemPrompt": "Assistant instructions or null",
  "useClaudeCodePrompt": true,
  "model": "optional model name or null",
  "effort": "low | medium | high or null",
  "thinkingBudgetTokens": 10000,
  "allowedTools": [],
  "disallowedTools": [],
  "permissionMode": "default | plan | acceptEdits | bypassPermissions or null",
  "hooksJson": null,
  "hooksCanvasJson": null,
  "mcpServersJson": null,
  "sandboxJson": null,
  "cwd": null,
  "additionalDirectories": [],
  "settingSources": [],
  "maxTurns": null,
  "maxBudgetUsd": null,
  "agentsJson": null
}

Keep the profile safe and broadly useful. Prefer short values and omit fields you do not need by setting them to null or an empty array.
Do not wrap the JSON in markdown fences or add any extra commentary.`;

export const generateAgentProfileSchema = z.object({
  prompt: z.string().trim().min(1),
  model: z.string().optional(),
});

export interface GeneratedAgentProfileDraft {
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  systemPrompt: string | null;
  useClaudeCodePrompt: boolean;
  model: string | null;
  effort: 'low' | 'medium' | 'high' | null;
  thinkingBudgetTokens: number | null;
  allowedTools: string[];
  disallowedTools: string[];
  permissionMode: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions';
  hooksJson: string | null;
  hooksCanvasJson: string | null;
  mcpServersJson: string | null;
  sandboxJson: string | null;
  cwd: string | null;
  additionalDirectories: string[];
  settingSources: string[];
  maxTurns: number | null;
  maxBudgetUsd: number | null;
  agentsJson: string | null;
}

const generatedAgentProfileSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  systemPrompt: z.string().nullable().optional(),
  useClaudeCodePrompt: z.boolean().optional(),
  model: z.string().nullable().optional(),
  effort: z.enum(['low', 'medium', 'high']).nullable().optional(),
  thinkingBudgetTokens: z.number().int().positive().nullable().optional(),
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'plan', 'acceptEdits', 'bypassPermissions']).nullable().optional(),
  hooksJson: z.string().nullable().optional(),
  hooksCanvasJson: z.string().nullable().optional(),
  mcpServersJson: z.string().nullable().optional(),
  sandboxJson: z.string().nullable().optional(),
  cwd: z.string().nullable().optional(),
  additionalDirectories: z.array(z.string()).optional(),
  settingSources: z.array(z.string()).optional(),
  maxTurns: z.number().int().positive().nullable().optional(),
  maxBudgetUsd: z.number().positive().nullable().optional(),
  agentsJson: z.string().nullable().optional(),
});

function stripMarkdownFences(text: string): string {
  let json = text.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return json;
}

function fallbackAgentName(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return 'AI Generated Agent';
  const snippet = trimmed.replace(/\s+/g, ' ').slice(0, 48);
  return snippet.endsWith('.') ? snippet.slice(0, -1) : snippet;
}

function buildFallbackDraft(prompt: string): GeneratedAgentProfileDraft {
  return {
    name: fallbackAgentName(prompt),
    description: prompt.trim() || null,
    icon: null,
    color: null,
    systemPrompt: null,
    useClaudeCodePrompt: true,
    model: null,
    effort: null,
    thinkingBudgetTokens: null,
    allowedTools: [],
    disallowedTools: [],
    permissionMode: 'default',
    hooksJson: null,
    hooksCanvasJson: null,
    mcpServersJson: null,
    sandboxJson: null,
    cwd: null,
    additionalDirectories: [],
    settingSources: [],
    maxTurns: null,
    maxBudgetUsd: null,
    agentsJson: null,
  };
}

export function parseGeneratedAgentProfile(rawText: string, prompt: string): {
  profile: GeneratedAgentProfileDraft;
  parseError?: string;
} {
  const json = stripMarkdownFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { profile: buildFallbackDraft(prompt), parseError: 'JSON parse failed' };
  }

  const result = generatedAgentProfileSchema.safeParse(parsed);
  if (!result.success) {
    return {
      profile: buildFallbackDraft(prompt),
      parseError: result.error.message,
    };
  }

  return {
    profile: {
      name: result.data.name ?? fallbackAgentName(prompt),
      description: result.data.description ?? (prompt.trim() || null),
      icon: result.data.icon ?? null,
      color: result.data.color ?? null,
      systemPrompt: result.data.systemPrompt ?? null,
      useClaudeCodePrompt: result.data.useClaudeCodePrompt ?? true,
      model: result.data.model ?? null,
      effort: result.data.effort ?? null,
      thinkingBudgetTokens: result.data.thinkingBudgetTokens ?? null,
      allowedTools: result.data.allowedTools ?? [],
      disallowedTools: result.data.disallowedTools ?? [],
      permissionMode: result.data.permissionMode ?? 'default',
      hooksJson: result.data.hooksJson ?? null,
      hooksCanvasJson: result.data.hooksCanvasJson ?? null,
      mcpServersJson: result.data.mcpServersJson ?? null,
      sandboxJson: result.data.sandboxJson ?? null,
      cwd: result.data.cwd ?? null,
      additionalDirectories: result.data.additionalDirectories ?? [],
      settingSources: result.data.settingSources ?? [],
      maxTurns: result.data.maxTurns ?? null,
      maxBudgetUsd: result.data.maxBudgetUsd ?? null,
      agentsJson: result.data.agentsJson ?? null,
    },
  };
}
