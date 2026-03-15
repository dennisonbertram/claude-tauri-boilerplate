import { Hono } from 'hono';
import { join } from 'path';
import type { HookConfig, HookEventMeta, HookHandler } from '@claude-tauri/shared';

// Hook event metadata
const HOOK_EVENTS: HookEventMeta[] = [
  { event: 'PreToolUse', description: 'Before tool execution', canBlock: true, supportsMatcher: true },
  { event: 'PostToolUse', description: 'After tool success', canBlock: true, supportsMatcher: true },
  { event: 'PostToolUseFailure', description: 'After tool failure', canBlock: false, supportsMatcher: true },
  { event: 'Stop', description: 'Claude finishes responding', canBlock: true, supportsMatcher: false },
  { event: 'SubagentStop', description: 'Subagent finishes', canBlock: true, supportsMatcher: false },
  { event: 'UserPromptSubmit', description: 'User submits prompt', canBlock: true, supportsMatcher: false },
  { event: 'SessionStart', description: 'Session starts', canBlock: false, supportsMatcher: false },
  { event: 'SessionEnd', description: 'Session ends', canBlock: false, supportsMatcher: false },
  { event: 'Notification', description: 'Notification sent', canBlock: false, supportsMatcher: false },
  { event: 'SubagentStart', description: 'Subagent spawned', canBlock: false, supportsMatcher: false },
  { event: 'TeammateIdle', description: 'Teammate going idle', canBlock: true, supportsMatcher: false },
  { event: 'TaskCompleted', description: 'Task completed', canBlock: true, supportsMatcher: false },
];

/**
 * settings.json hooks format:
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       {
 *         "matcher": "Bash",
 *         "hooks": [
 *           { "type": "command", "command": "bash ./hooks/scan-secrets.sh" }
 *         ]
 *       }
 *     ],
 *     "Stop": [
 *       {
 *         "hooks": [
 *           { "type": "prompt", "prompt": "Verify all tasks complete" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * We flatten this into individual HookConfig objects with UUIDs for our internal model.
 */

interface SettingsHookEntry {
  type: string;
  command?: string;
  timeout?: number;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  prompt?: string;
}

interface SettingsHookGroup {
  matcher?: string;
  hooks: SettingsHookEntry[];
}

interface SettingsJson {
  hooks?: Record<string, SettingsHookGroup[]>;
  [key: string]: unknown;
}

function getSettingsPath(): string {
  return join(process.cwd(), '.claude', 'settings.json');
}

async function readSettings(): Promise<SettingsJson> {
  try {
    const file = Bun.file(getSettingsPath());
    const exists = await file.exists();
    if (!exists) return {};
    const text = await file.text();
    return JSON.parse(text) as SettingsJson;
  } catch {
    return {};
  }
}

async function writeSettings(data: SettingsJson): Promise<void> {
  const dir = join(process.cwd(), '.claude');
  const { mkdirSync, existsSync } = await import('fs');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  await Bun.write(getSettingsPath(), JSON.stringify(data, null, 2) + '\n');
}

/**
 * Generate a deterministic ID from event + matcher + handler index.
 * We use a simple UUID-like approach based on crypto.
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * We store a mapping of our UUIDs to their location in settings.json
 * using a simple convention: we add an `_id` field to each hook entry
 * in settings.json so we can track them across reads/writes.
 *
 * Actually, to keep settings.json clean, we'll maintain an auxiliary
 * id map in memory that gets rebuilt each read. Instead, we'll use
 * a deterministic approach: store IDs in-memory and regenerate on each read.
 *
 * Simplest approach: assign stable IDs by hashing event+matcher+handlerIndex.
 * But that breaks if user reorders. Let's just assign sequential IDs and
 * rebuild each time. The frontend will re-fetch after each mutation.
 */

function flattenHooks(settings: SettingsJson): HookConfig[] {
  const hooks: HookConfig[] = [];
  const hooksSection = settings.hooks || {};
  let idCounter = 0;

  for (const [event, groups] of Object.entries(hooksSection)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!Array.isArray(group.hooks)) continue;
      for (const entry of group.hooks) {
        idCounter++;
        hooks.push({
          id: `hook-${idCounter}`,
          event,
          matcher: group.matcher,
          enabled: (entry as { _disabled?: boolean })._disabled !== true,
          handler: {
            type: (entry.type || 'command') as HookHandler['type'],
            command: entry.command,
            timeout: entry.timeout,
            url: entry.url,
            method: entry.method,
            headers: entry.headers,
            prompt: entry.prompt,
          },
        });
      }
    }
  }

  return hooks;
}

/**
 * Rebuild the settings hooks section from our flat HookConfig list.
 */
function unflattenHooks(configs: HookConfig[]): Record<string, SettingsHookGroup[]> {
  const result: Record<string, SettingsHookGroup[]> = {};

  for (const config of configs) {
    if (!result[config.event]) {
      result[config.event] = [];
    }

    const groups = result[config.event];
    // Find existing group with same matcher
    let group = groups.find((g) => (g.matcher || undefined) === (config.matcher || undefined));
    if (!group) {
      group = { hooks: [] };
      if (config.matcher) group.matcher = config.matcher;
      groups.push(group);
    }

    const entry: SettingsHookEntry & { _disabled?: boolean } = {
      type: config.handler.type,
    };

    if (config.handler.command !== undefined) entry.command = config.handler.command;
    if (config.handler.timeout !== undefined) entry.timeout = config.handler.timeout;
    if (config.handler.url !== undefined) entry.url = config.handler.url;
    if (config.handler.method !== undefined) entry.method = config.handler.method;
    if (config.handler.headers !== undefined) entry.headers = config.handler.headers;
    if (config.handler.prompt !== undefined) entry.prompt = config.handler.prompt;
    if (!config.enabled) entry._disabled = true;

    group.hooks.push(entry);
  }

  return result;
}

function validateHandler(handler: Partial<HookHandler>): string | null {
  if (!handler.type) return 'handler.type is required';
  if (!['command', 'http', 'prompt'].includes(handler.type)) {
    return 'handler.type must be command, http, or prompt';
  }

  if (handler.type === 'command' && !handler.command) {
    return 'handler.command is required for command type';
  }
  if (handler.type === 'http' && !handler.url) {
    return 'handler.url is required for http type';
  }
  if (handler.type === 'prompt' && !handler.prompt) {
    return 'handler.prompt is required for prompt type';
  }

  return null;
}

function validateEvent(event: string): boolean {
  return HOOK_EVENTS.some((e) => e.event === event);
}

export function createHooksRouter() {
  const hooksRouter = new Hono();

  // GET /api/hooks/events - Return hook event metadata
  hooksRouter.get('/events', (c) => {
    return c.json({ events: HOOK_EVENTS });
  });

  // GET /api/hooks - List all configured hooks
  hooksRouter.get('/', async (c) => {
    const settings = await readSettings();
    const hooks = flattenHooks(settings);
    return c.json({ hooks });
  });

  // POST /api/hooks - Create a new hook
  hooksRouter.post('/', async (c) => {
    const body = await c.req.json<Partial<HookConfig>>();

    // Validate event
    if (!body.event || !validateEvent(body.event)) {
      return c.json({ error: 'Invalid or missing event type' }, 400);
    }

    // Validate handler
    if (!body.handler) {
      return c.json({ error: 'handler is required' }, 400);
    }
    const handlerError = validateHandler(body.handler);
    if (handlerError) {
      return c.json({ error: handlerError }, 400);
    }

    const settings = await readSettings();
    const hooks = flattenHooks(settings);

    const newHook: HookConfig = {
      id: generateId(),
      event: body.event,
      matcher: body.matcher,
      enabled: body.enabled !== false,
      handler: body.handler as HookHandler,
    };

    hooks.push(newHook);
    settings.hooks = unflattenHooks(hooks);
    await writeSettings(settings);

    // Re-read to get stable IDs
    const updated = flattenHooks(await readSettings());
    const created = updated[updated.length - 1];

    return c.json({ success: true, hook: created }, 201);
  });

  // PUT /api/hooks/:id - Update a hook
  hooksRouter.put('/:id', async (c) => {
    const id = c.req.param('id');
    const settings = await readSettings();
    const hooks = flattenHooks(settings);

    const index = hooks.findIndex((h) => h.id === id);
    if (index === -1) {
      return c.json({ error: `Hook "${id}" not found` }, 404);
    }

    const body = await c.req.json<Partial<HookConfig>>();
    const existing = hooks[index];

    // Update fields
    if (body.event !== undefined) {
      if (!validateEvent(body.event)) {
        return c.json({ error: 'Invalid event type' }, 400);
      }
      existing.event = body.event;
    }
    if (body.matcher !== undefined) existing.matcher = body.matcher;
    if (body.enabled !== undefined) existing.enabled = body.enabled;
    if (body.handler !== undefined) {
      const merged = { ...existing.handler, ...body.handler };
      const handlerError = validateHandler(merged);
      if (handlerError) {
        return c.json({ error: handlerError }, 400);
      }
      existing.handler = merged;
    }

    hooks[index] = existing;
    settings.hooks = unflattenHooks(hooks);
    await writeSettings(settings);

    // Re-read to get stable IDs
    const updated = flattenHooks(await readSettings());

    return c.json({ success: true, hook: updated[index] });
  });

  // DELETE /api/hooks/:id - Remove a hook
  hooksRouter.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const settings = await readSettings();
    const hooks = flattenHooks(settings);

    const index = hooks.findIndex((h) => h.id === id);
    if (index === -1) {
      return c.json({ error: `Hook "${id}" not found` }, 404);
    }

    hooks.splice(index, 1);
    settings.hooks = unflattenHooks(hooks);
    await writeSettings(settings);

    return c.json({ success: true });
  });

  // PATCH /api/hooks/:id/toggle - Enable/disable a hook
  hooksRouter.patch('/:id/toggle', async (c) => {
    const id = c.req.param('id');
    const settings = await readSettings();
    const hooks = flattenHooks(settings);

    const index = hooks.findIndex((h) => h.id === id);
    if (index === -1) {
      return c.json({ error: `Hook "${id}" not found` }, 404);
    }

    const body = await c.req.json<{ enabled: boolean }>();
    if (typeof body.enabled !== 'boolean') {
      return c.json({ error: 'enabled must be a boolean' }, 400);
    }

    hooks[index].enabled = body.enabled;
    settings.hooks = unflattenHooks(hooks);
    await writeSettings(settings);

    // Re-read to get stable IDs
    const updated = flattenHooks(await readSettings());

    return c.json({ success: true, hook: updated[index] });
  });

  return hooksRouter;
}
