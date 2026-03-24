import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from 'bun:sqlite';
import {
  createAgentProfile,
  getAgentProfile,
  listAgentProfiles,
  updateAgentProfile,
  deleteAgentProfile,
  duplicateAgentProfile,
} from '../db/index.js';
import { streamClaude } from '../services/claude';
import {
  AGENT_PROFILE_GENERATION_SYSTEM_PROMPT,
  generateAgentProfileSchema,
  parseGeneratedAgentProfile,
} from './agent-profile-helpers';
import { validateBody } from '../utils/validate-body.js';

const createProfileSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  systemPrompt: z.string().optional(),
  useClaudeCodePrompt: z.boolean().optional(),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  thinkingBudgetTokens: z.number().int().positive().optional(),
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'plan', 'acceptEdits', 'bypassPermissions']).optional(),
  hooksJson: z.string().optional(),
  hooksCanvasJson: z.string().optional(),
  mcpServersJson: z.string().optional(),
  sandboxJson: z.string().optional(),
  cwd: z.string().optional(),
  additionalDirectories: z.array(z.string()).optional(),
  settingSources: z.array(z.string()).optional(),
  maxTurns: z.number().int().positive().optional(),
  maxBudgetUsd: z.number().positive().optional(),
  agentsJson: z.string().optional(),
});

const updateProfileSchema = createProfileSchema.partial();

export function createAgentProfilesRouter(db: Database) {
  const router = new Hono();

  // GET / — List all agent profiles
  router.get('/', async (c) => {
    const profiles = listAgentProfiles(db);
    return c.json(profiles);
  });

  // POST / — Create a new agent profile
  router.post('/', async (c) => {
    const data = await validateBody(c, createProfileSchema);
    if (data instanceof Response) return data;

    const id = crypto.randomUUID();
    const profile = createAgentProfile(db, id, data);
    return c.json(profile, 201);
  });

  // POST /generate — Generate and create a new agent profile from a prompt
  router.post('/generate', async (c) => {
    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON in request body', code: 'VALIDATION_ERROR' }, 400);
    }

    const parsed = generateAgentProfileSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid generate agent profile request',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        },
        400
      );
    }

    const { prompt, model } = parsed.data;
    const fullPrompt = `${AGENT_PROFILE_GENERATION_SYSTEM_PROMPT}\n\nUser request: ${prompt}`;

    let fullResponse = '';
    try {
      for await (const event of streamClaude({
        prompt: fullPrompt,
        model: model ?? 'claude-sonnet-4-20250514',
        effort: 'low',
        permissionMode: 'dontAsk',
      })) {
        if (event.type === 'text:delta') {
          fullResponse += event.text;
        }
        if (event.type === 'error') {
          return c.json({ error: event.message, code: 'GENERATION_ERROR' }, 500);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent profile generation failed';
      return c.json({ error: message, code: 'GENERATION_ERROR' }, 500);
    }

    const { profile } = parseGeneratedAgentProfile(fullResponse, prompt);

    const nextSortOrderRow = db.prepare(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM agent_profiles`
    ).get() as { next: number };

    const created = createAgentProfile(db, crypto.randomUUID(), {
      name: profile.name,
      description: profile.description ?? null,
      icon: profile.icon ?? null,
      color: profile.color ?? null,
      isDefault: false,
      sortOrder: nextSortOrderRow.next,
      systemPrompt: profile.systemPrompt ?? null,
      useClaudeCodePrompt: profile.useClaudeCodePrompt ?? true,
      model: profile.model ?? model ?? null,
      effort: profile.effort ?? null,
      thinkingBudgetTokens: profile.thinkingBudgetTokens ?? null,
      allowedTools: profile.allowedTools ?? [],
      disallowedTools: profile.disallowedTools ?? [],
      permissionMode: profile.permissionMode ?? 'default',
      hooksJson: profile.hooksJson ?? null,
      hooksCanvasJson: profile.hooksCanvasJson ?? null,
      mcpServersJson: profile.mcpServersJson ?? null,
      sandboxJson: profile.sandboxJson ?? null,
      cwd: profile.cwd ?? null,
      additionalDirectories: profile.additionalDirectories ?? [],
      settingSources: profile.settingSources ?? [],
      maxTurns: profile.maxTurns ?? null,
      maxBudgetUsd: profile.maxBudgetUsd ?? null,
      agentsJson: profile.agentsJson ?? null,
    });

    return c.json(created, 201);
  });

  // GET /:id — Get a single agent profile
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const profile = getAgentProfile(db, id);
    if (!profile) {
      return c.json(
        { error: 'Agent profile not found', code: 'NOT_FOUND' },
        404
      );
    }
    return c.json(profile);
  });

  // PUT /:id — Update an agent profile
  router.put('/:id', async (c) => {
    const id = c.req.param('id');

    // Verify the profile exists first
    const existing = getAgentProfile(db, id);
    if (!existing) {
      return c.json(
        { error: 'Agent profile not found', code: 'NOT_FOUND' },
        404
      );
    }

    const data = await validateBody(c, updateProfileSchema);
    if (data instanceof Response) return data;

    updateAgentProfile(db, id, data);

    // Return the updated profile
    const updated = getAgentProfile(db, id);
    return c.json(updated);
  });

  // DELETE /:id — Delete an agent profile
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const profile = getAgentProfile(db, id);
    if (!profile) {
      return c.json(
        { error: 'Agent profile not found', code: 'NOT_FOUND' },
        404
      );
    }

    deleteAgentProfile(db, id);
    return c.json({ success: true });
  });

  // POST /:id/duplicate — Duplicate an agent profile
  router.post('/:id/duplicate', async (c) => {
    const id = c.req.param('id');
    const newId = crypto.randomUUID();
    const duplicated = duplicateAgentProfile(db, id, newId);

    if (!duplicated) {
      return c.json(
        { error: 'Agent profile not found', code: 'NOT_FOUND' },
        404
      );
    }

    return c.json(duplicated, 201);
  });

  return router;
}
