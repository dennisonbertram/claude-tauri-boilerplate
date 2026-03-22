import { z } from 'zod';

// ─── Dashboard generation constants ───────────────────────────────────────────

export const DASHBOARD_GENERATION_SYSTEM_PROMPT = `You are a dashboard specification generator.
Generate a JSON dashboard specification based on the user's request.

Output format (valid JSON only, no markdown fences):
{
  "kind": "dashboard",
  "schemaVersion": 1,
  "title": "Dashboard title",
  "layout": { "columns": 12, "rowHeight": 32, "gap": 8 },
  "widgets": [],
  "dataSources": []
}

Output ONLY valid JSON. No explanation outside the JSON object.`;

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const generateArtifactSchema = z.object({
  prompt: z.string().min(1),
  title: z.string().optional(),
  workspaceId: z.string().optional(),
  sessionId: z.string().optional(),
  model: z.string().optional(),
});

export const regenerateArtifactSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
});

export const renameArtifactSchema = z.object({
  title: z.string().min(1),
});

const dashboardSpecSchema = z.object({
  kind: z.literal('dashboard'),
  schemaVersion: z.number(),
  title: z.string(),
  layout: z.object({
    columns: z.number(),
    rowHeight: z.number(),
    gap: z.number(),
  }),
  widgets: z.array(z.unknown()),
  dataSources: z.array(z.unknown()),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripMarkdownFences(text: string): string {
  let json = text.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return json;
}

export function parseDashboardSpec(rawText: string): { spec: unknown; parseError?: string } {
  const json = stripMarkdownFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { spec: { _raw: rawText, _parseError: 'Failed to parse JSON from Claude response' }, parseError: 'JSON parse failed' };
  }

  const result = dashboardSpecSchema.safeParse(parsed);
  if (!result.success) {
    return {
      spec: { ...(parsed as object), _parseError: result.error.message },
      parseError: result.error.message,
    };
  }

  return { spec: result.data };
}
