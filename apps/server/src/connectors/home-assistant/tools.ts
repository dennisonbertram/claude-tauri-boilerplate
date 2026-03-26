import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHaConfig(): { baseUrl: string; token: string } {
  const baseUrl = process.env.HA_URL;
  const token = process.env.HA_TOKEN;
  if (!baseUrl) throw new Error('HA_URL environment variable is not set');
  if (!token) throw new Error('HA_TOKEN environment variable is not set');
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

function haHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ---------------------------------------------------------------------------
// ha_list_entities
// ---------------------------------------------------------------------------

function createListEntitiesTool(_db: Database) {
  return tool(
    'ha_list_entities',
    'List all Home Assistant entities with their current state. Returns entity IDs, friendly names, and state values.',
    {},
    async (_args) => {
      try {
        const { baseUrl, token } = getHaConfig();
        const resp = await fetch(`${baseUrl}/api/states`, {
          headers: haHeaders(token),
        });
        if (!resp.ok) {
          throw new Error(`Home Assistant API error: ${resp.status} ${resp.statusText}`);
        }
        const states: Array<{
          entity_id: string;
          state: string;
          attributes?: { friendly_name?: string };
        }> = await resp.json();

        if (!Array.isArray(states) || states.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No entities found.' }] };
        }

        const lines: string[] = [`Found ${states.length} entities:`, ''];
        for (const entity of states) {
          const friendlyName = entity.attributes?.friendly_name ?? '';
          lines.push(
            `Entity ID: ${entity.entity_id}`,
            `State: ${entity.state}`,
            friendlyName
              ? `Friendly Name: ${fenceUntrustedContent(friendlyName, 'home-assistant')}`
              : 'Friendly Name: (none)',
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing entities: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Home Assistant Entities',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ha_get_state
// ---------------------------------------------------------------------------

function createGetStateTool(_db: Database) {
  return tool(
    'ha_get_state',
    'Get the current state and attributes of a specific Home Assistant entity by its entity ID.',
    {
      entity_id: z
        .string()
        .describe('The entity ID to query (e.g. "light.living_room", "switch.kitchen_fan")'),
    },
    async (args) => {
      try {
        const { baseUrl, token } = getHaConfig();
        const resp = await fetch(`${baseUrl}/api/states/${encodeURIComponent(args.entity_id)}`, {
          headers: haHeaders(token),
        });
        if (resp.status === 404) {
          return {
            content: [{ type: 'text' as const, text: `Entity "${args.entity_id}" not found.` }],
            isError: true,
          };
        }
        if (!resp.ok) {
          throw new Error(`Home Assistant API error: ${resp.status} ${resp.statusText}`);
        }
        const entity: {
          entity_id: string;
          state: string;
          attributes?: Record<string, unknown> & { friendly_name?: string };
          last_changed?: string;
          last_updated?: string;
        } = await resp.json();

        const attrs = entity.attributes ?? {};
        const friendlyName = attrs.friendly_name ?? '';
        const otherAttrs = Object.entries(attrs)
          .filter(([k]) => k !== 'friendly_name')
          .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
          .join('\n');

        const lines = [
          `Entity ID: ${entity.entity_id}`,
          `State: ${entity.state}`,
          friendlyName
            ? `Friendly Name: ${fenceUntrustedContent(String(friendlyName), 'home-assistant')}`
            : 'Friendly Name: (none)',
          entity.last_changed ? `Last Changed: ${entity.last_changed}` : '',
          entity.last_updated ? `Last Updated: ${entity.last_updated}` : '',
          '',
          'Attributes:',
          otherAttrs || '  (none)',
        ]
          .filter((l) => l !== '')
          .join('\n');

        return { content: [{ type: 'text' as const, text: lines }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting state: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Home Assistant Entity State',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ha_call_service
// ---------------------------------------------------------------------------

function createCallServiceTool(_db: Database) {
  return tool(
    'ha_call_service',
    'Call a Home Assistant service to control a device or automation. WARNING: This controls real-world physical devices. Confirm with the user before calling services that affect lights, locks, thermostats, or other physical hardware.',
    {
      domain: z
        .string()
        .describe('The service domain (e.g. "light", "switch", "climate", "lock", "script")'),
      service: z
        .string()
        .describe('The service to call (e.g. "turn_on", "turn_off", "set_temperature")'),
      entity_id: z
        .string()
        .optional()
        .describe('The entity ID to target (e.g. "light.living_room"). Omit if not required by the service.'),
      data: z
        .record(z.unknown())
        .optional()
        .describe('Additional service data as a key-value object (e.g. {"brightness": 128, "color_temp": 300})'),
    },
    async (args) => {
      try {
        const { baseUrl, token } = getHaConfig();
        const body: Record<string, unknown> = { ...(args.data ?? {}) };
        if (args.entity_id) {
          body.entity_id = args.entity_id;
        }

        const resp = await fetch(
          `${baseUrl}/api/services/${encodeURIComponent(args.domain)}/${encodeURIComponent(args.service)}`,
          {
            method: 'POST',
            headers: haHeaders(token),
            body: JSON.stringify(body),
          }
        );
        if (!resp.ok) {
          throw new Error(`Home Assistant API error: ${resp.status} ${resp.statusText}`);
        }

        const result: unknown = await resp.json();
        const resultText = Array.isArray(result) && result.length > 0
          ? `Service ${args.domain}.${args.service} called successfully. Affected ${result.length} state(s).`
          : `Service ${args.domain}.${args.service} called successfully.`;

        return { content: [{ type: 'text' as const, text: resultText }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error calling service: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Call Home Assistant Service',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ha_toggle
// ---------------------------------------------------------------------------

function createToggleTool(_db: Database) {
  return tool(
    'ha_toggle',
    'Toggle a Home Assistant entity between its on and off states. WARNING: This controls real-world physical devices. Confirm with the user before toggling lights, switches, locks, or other physical hardware.',
    {
      entity_id: z
        .string()
        .describe('The entity ID to toggle (e.g. "light.living_room", "switch.garden_light")'),
    },
    async (args) => {
      try {
        const { baseUrl, token } = getHaConfig();
        const resp = await fetch(`${baseUrl}/api/services/homeassistant/toggle`, {
          method: 'POST',
          headers: haHeaders(token),
          body: JSON.stringify({ entity_id: args.entity_id }),
        });
        if (!resp.ok) {
          throw new Error(`Home Assistant API error: ${resp.status} ${resp.statusText}`);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Toggled entity "${args.entity_id}" successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error toggling entity: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Toggle Home Assistant Entity',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ha_get_history
// ---------------------------------------------------------------------------

function createGetHistoryTool(_db: Database) {
  return tool(
    'ha_get_history',
    'Get the state history for a Home Assistant entity over a time period.',
    {
      entity_id: z
        .string()
        .describe('The entity ID to retrieve history for (e.g. "sensor.temperature")'),
      start_time: z
        .string()
        .optional()
        .describe('ISO 8601 start timestamp (e.g. "2024-01-15T00:00:00Z"). Defaults to 1 day ago.'),
      end_time: z
        .string()
        .optional()
        .describe('ISO 8601 end timestamp. Omit for history up to now.'),
    },
    async (args) => {
      try {
        const { baseUrl, token } = getHaConfig();
        const startTime = args.start_time ?? new Date(Date.now() - 86_400_000).toISOString();
        let url = `${baseUrl}/api/history/period/${encodeURIComponent(startTime)}?filter_entity_id=${encodeURIComponent(args.entity_id)}`;
        if (args.end_time) {
          url += `&end_time=${encodeURIComponent(args.end_time)}`;
        }

        const resp = await fetch(url, { headers: haHeaders(token) });
        if (!resp.ok) {
          throw new Error(`Home Assistant API error: ${resp.status} ${resp.statusText}`);
        }

        const history: Array<
          Array<{ state: string; last_changed: string; attributes?: Record<string, unknown> }>
        > = await resp.json();

        const entityHistory = history[0] ?? [];
        if (entityHistory.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No history found for "${args.entity_id}" in the requested time range.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `History for "${args.entity_id}" (${entityHistory.length} entries):`,
          '',
        ];
        for (const entry of entityHistory) {
          lines.push(`  ${entry.last_changed}: ${entry.state}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting history: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Home Assistant Entity History',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createHomeAssistantTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'ha_list_entities',
      description: 'List all Home Assistant entities with their current state',
      sdkTool: createListEntitiesTool(db),
    },
    {
      name: 'ha_get_state',
      description: 'Get the current state and attributes of a specific Home Assistant entity',
      sdkTool: createGetStateTool(db),
    },
    {
      name: 'ha_call_service',
      description: 'Call a Home Assistant service to control a physical device',
      sdkTool: createCallServiceTool(db),
    },
    {
      name: 'ha_toggle',
      description: 'Toggle a Home Assistant entity between on and off states',
      sdkTool: createToggleTool(db),
    },
    {
      name: 'ha_get_history',
      description: 'Get the state history for a Home Assistant entity',
      sdkTool: createGetHistoryTool(db),
    },
  ];
}
