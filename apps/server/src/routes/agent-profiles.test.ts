import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb } from '../db';
import { createAgentProfilesRouter } from './agent-profiles';
import { createSessionsRouter } from './sessions';
import { errorHandler } from '../middleware/error-handler';

describe('Agent Profile Routes', () => {
  let db: Database;
  let app: Hono;

  beforeEach(() => {
    db = createDb(':memory:');
    const profileRouter = createAgentProfilesRouter(db);
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/agent-profiles', profileRouter);
  });

  afterEach(() => {
    db.close();
  });

  /** Helper to create a profile and return the response + parsed body. */
  async function createProfile(overrides: Record<string, unknown> = {}) {
    const res = await app.request('/api/agent-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Profile', ...overrides }),
    });
    return { res, body: await res.json() };
  }

  // ────────────────────────────────────────────────
  // POST /api/agent-profiles (Create)
  // ────────────────────────────────────────────────

  describe('POST /api/agent-profiles', () => {
    test('creates profile with minimal fields (just name)', async () => {
      const { res, body } = await createProfile();

      expect(res.status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.name).toBe('Test Profile');
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
      // Defaults
      expect(body.description).toBeNull();
      expect(body.icon).toBeNull();
      expect(body.color).toBeNull();
      expect(body.isDefault).toBe(false);
      expect(body.sortOrder).toBe(0);
      expect(body.useClaudeCodePrompt).toBe(true);
    });

    test('creates profile with all fields', async () => {
      const fullData = {
        name: 'Full Profile',
        description: 'A description',
        icon: 'brain',
        color: '#ff0000',
        isDefault: true,
        sortOrder: 5,
        systemPrompt: 'You are helpful.',
        useClaudeCodePrompt: false,
        model: 'claude-sonnet-4-20250514',
        effort: 'high',
        thinkingBudgetTokens: 4096,
        allowedTools: ['Read', 'Write', 'Bash'],
        disallowedTools: ['WebFetch'],
        permissionMode: 'plan',
        hooksJson: '{}',
        hooksCanvasJson: '{}',
        mcpServersJson: '{}',
        sandboxJson: '{}',
        cwd: '/home/user',
        additionalDirectories: ['/tmp'],
        settingSources: ['local', 'global'],
        maxTurns: 10,
        maxBudgetUsd: 5.0,
        agentsJson: '[]',
      };

      const { res, body } = await createProfile(fullData);

      expect(res.status).toBe(201);
      expect(body.name).toBe('Full Profile');
      expect(body.description).toBe('A description');
      expect(body.icon).toBe('brain');
      expect(body.color).toBe('#ff0000');
      expect(body.isDefault).toBe(true);
      expect(body.sortOrder).toBe(5);
      expect(body.systemPrompt).toBe('You are helpful.');
      expect(body.useClaudeCodePrompt).toBe(false);
      expect(body.model).toBe('claude-sonnet-4-20250514');
      expect(body.effort).toBe('high');
      expect(body.thinkingBudgetTokens).toBe(4096);
      expect(body.allowedTools).toEqual(['Read', 'Write', 'Bash']);
      expect(body.disallowedTools).toEqual(['WebFetch']);
      expect(body.permissionMode).toBe('plan');
      expect(body.hooksJson).toBe('{}');
      expect(body.mcpServersJson).toBe('{}');
      expect(body.cwd).toBe('/home/user');
      expect(body.additionalDirectories).toEqual(['/tmp']);
      expect(body.settingSources).toEqual(['local', 'global']);
      expect(body.maxTurns).toBe(10);
      expect(body.maxBudgetUsd).toBe(5.0);
      expect(body.agentsJson).toBe('[]');
    });

    test('rejects empty body', async () => {
      const res = await app.request('/api/agent-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects missing name', async () => {
      const res = await app.request('/api/agent-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'no name here' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('validates effort enum (rejects invalid value)', async () => {
      const res = await app.request('/api/agent-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bad Effort', effort: 'ultra' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ────────────────────────────────────────────────
  // GET /api/agent-profiles (List)
  // ────────────────────────────────────────────────

  describe('GET /api/agent-profiles', () => {
    test('returns empty array when no profiles exist', async () => {
      const res = await app.request('/api/agent-profiles');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    test('returns profiles sorted by sort_order then name', async () => {
      await createProfile({ name: 'Charlie', sortOrder: 2 });
      await createProfile({ name: 'Alpha', sortOrder: 1 });
      await createProfile({ name: 'Beta', sortOrder: 1 });

      const res = await app.request('/api/agent-profiles');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(3);
      // sort_order ASC, then name ASC
      expect(body[0].name).toBe('Alpha');
      expect(body[1].name).toBe('Beta');
      expect(body[2].name).toBe('Charlie');
    });

    test('returns all created profiles', async () => {
      await createProfile({ name: 'Profile 1' });
      await createProfile({ name: 'Profile 2' });
      await createProfile({ name: 'Profile 3' });

      const res = await app.request('/api/agent-profiles');
      const body = await res.json();
      expect(body).toHaveLength(3);
    });
  });

  // ────────────────────────────────────────────────
  // GET /api/agent-profiles/:id (Get)
  // ────────────────────────────────────────────────

  describe('GET /api/agent-profiles/:id', () => {
    test('returns existing profile with correct fields', async () => {
      const { body: created } = await createProfile({ name: 'Fetch Me', description: 'test desc' });

      const res = await app.request(`/api/agent-profiles/${created.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBe(created.id);
      expect(body.name).toBe('Fetch Me');
      expect(body.description).toBe('test desc');
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    test('returns 404 for non-existent id', async () => {
      const res = await app.request('/api/agent-profiles/no-such-id');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  // ────────────────────────────────────────────────
  // PUT /api/agent-profiles/:id (Update)
  // ────────────────────────────────────────────────

  describe('PUT /api/agent-profiles/:id', () => {
    test('partial update (just name) changes name, leaves other fields unchanged', async () => {
      const { body: created } = await createProfile({
        name: 'Original',
        description: 'keep me',
      });

      const res = await app.request(`/api/agent-profiles/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' }),
      });

      expect(res.status).toBe(200);

      // Verify via GET
      const getRes = await app.request(`/api/agent-profiles/${created.id}`);
      const body = await getRes.json();
      expect(body.name).toBe('Renamed');
      expect(body.description).toBe('keep me');
    });

    test('full update with all fields', async () => {
      const { body: created } = await createProfile({ name: 'Original' });

      const updates = {
        name: 'Updated Profile',
        description: 'new desc',
        icon: 'star',
        color: '#00ff00',
        isDefault: true,
        sortOrder: 99,
        systemPrompt: 'Be brief.',
        useClaudeCodePrompt: false,
        model: 'claude-opus-4-20250514',
        effort: 'low',
        thinkingBudgetTokens: 1024,
        allowedTools: ['Grep'],
        disallowedTools: ['Bash'],
        permissionMode: 'acceptEdits',
        maxTurns: 20,
        maxBudgetUsd: 10.0,
      };

      const res = await app.request(`/api/agent-profiles/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      expect(res.status).toBe(200);

      // Verify via GET
      const getRes = await app.request(`/api/agent-profiles/${created.id}`);
      const body = await getRes.json();
      expect(body.name).toBe('Updated Profile');
      expect(body.description).toBe('new desc');
      expect(body.icon).toBe('star');
      expect(body.color).toBe('#00ff00');
      expect(body.isDefault).toBe(true);
      expect(body.sortOrder).toBe(99);
      expect(body.systemPrompt).toBe('Be brief.');
      expect(body.useClaudeCodePrompt).toBe(false);
      expect(body.model).toBe('claude-opus-4-20250514');
      expect(body.effort).toBe('low');
      expect(body.thinkingBudgetTokens).toBe(1024);
      expect(body.allowedTools).toEqual(['Grep']);
      expect(body.disallowedTools).toEqual(['Bash']);
      expect(body.permissionMode).toBe('acceptEdits');
      expect(body.maxTurns).toBe(20);
      expect(body.maxBudgetUsd).toBe(10.0);
    });

    test('returns 404 for non-existent id', async () => {
      const res = await app.request('/api/agent-profiles/no-such-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ghost' }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('updates JSON array fields (allowedTools) and roundtrips correctly', async () => {
      const { body: created } = await createProfile({ name: 'Tools Profile' });

      await app.request(`/api/agent-profiles/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedTools: ['Read', 'Write', 'Bash'] }),
      });

      const getRes = await app.request(`/api/agent-profiles/${created.id}`);
      const body = await getRes.json();
      expect(body.allowedTools).toEqual(['Read', 'Write', 'Bash']);
    });
  });

  // ────────────────────────────────────────────────
  // DELETE /api/agent-profiles/:id
  // ────────────────────────────────────────────────

  describe('DELETE /api/agent-profiles/:id', () => {
    test('deletes existing profile and returns success', async () => {
      const { body: created } = await createProfile({ name: 'Delete Me' });

      const res = await app.request(`/api/agent-profiles/${created.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('returns 404 for non-existent id', async () => {
      const res = await app.request('/api/agent-profiles/no-such-id', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('profile is gone after delete (GET returns 404)', async () => {
      const { body: created } = await createProfile({ name: 'Temporary' });

      // Delete it
      await app.request(`/api/agent-profiles/${created.id}`, {
        method: 'DELETE',
      });

      // Verify it's gone
      const getRes = await app.request(`/api/agent-profiles/${created.id}`);
      expect(getRes.status).toBe(404);
      const body = await getRes.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  // ────────────────────────────────────────────────
  // POST /api/agent-profiles/:id/duplicate
  // ────────────────────────────────────────────────

  describe('POST /api/agent-profiles/:id/duplicate', () => {
    test('duplicates existing profile with new id and copy suffix', async () => {
      const { body: original } = await createProfile({
        name: 'Original Profile',
        description: 'some desc',
        icon: 'brain',
        color: '#123456',
        model: 'claude-sonnet-4-20250514',
        effort: 'medium',
      });

      const res = await app.request(`/api/agent-profiles/${original.id}/duplicate`, {
        method: 'POST',
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      // New id, different from original
      expect(body.id).toBeDefined();
      expect(body.id).not.toBe(original.id);

      // Name has " (copy)" suffix
      expect(body.name).toBe('Original Profile (copy)');

      // Other fields copied
      expect(body.description).toBe('some desc');
      expect(body.icon).toBe('brain');
      expect(body.color).toBe('#123456');
      expect(body.model).toBe('claude-sonnet-4-20250514');
      expect(body.effort).toBe('medium');
    });

    test('returns 404 for non-existent source id', async () => {
      const res = await app.request('/api/agent-profiles/no-such-id/duplicate', {
        method: 'POST',
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('duplicate is not marked as default even if original was', async () => {
      const { body: original } = await createProfile({
        name: 'Default Profile',
        isDefault: true,
      });

      expect(original.isDefault).toBe(true);

      const res = await app.request(`/api/agent-profiles/${original.id}/duplicate`, {
        method: 'POST',
      });

      const body = await res.json();
      expect(body.isDefault).toBe(false);
    });
  });

  // ────────────────────────────────────────────────
  // Session-Profile Linking
  // ────────────────────────────────────────────────

  describe('Session-Profile Linking', () => {
    test('creating a session with profileId links it to the profile', async () => {
      // Mount the sessions router too
      const sessionsRouter = createSessionsRouter(db);
      app.route('/api/sessions', sessionsRouter);

      // Create a profile first
      const { body: profile } = await createProfile({ name: 'Linked Profile', icon: 'link', color: '#abcdef' });

      // Create a session linked to this profile
      const sessionRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Linked Session', profileId: profile.id }),
      });

      expect(sessionRes.status).toBe(201);

      // List sessions and verify the profile shows up
      const listRes = await app.request('/api/sessions');
      expect(listRes.status).toBe(200);

      const sessions = await listRes.json();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].profile).toBeDefined();
      expect(sessions[0].profile.id).toBe(profile.id);
      expect(sessions[0].profile.name).toBe('Linked Profile');
      expect(sessions[0].profile.icon).toBe('link');
      expect(sessions[0].profile.color).toBe('#abcdef');
    });
  });
});
