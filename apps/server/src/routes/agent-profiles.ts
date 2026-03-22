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
