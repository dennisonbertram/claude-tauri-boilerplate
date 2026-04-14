import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

const execFileAsync = promisify(execFile);

export type JxaRunner = (script: string) => Promise<string>;

export async function runJxa(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
    timeout: 15000,
  });
  return stdout.trim();
}

// ---------------------------------------------------------------------------
// reminders_list_lists
// ---------------------------------------------------------------------------

function createListListsTool(jxa: JxaRunner) {
  return tool(
    'reminders_list_lists',
    'List all reminder lists in Apple Reminders.',
    {},
    async (_args) => {
      try {
        const script = `
          var app = Application("Reminders");
          var lists = app.lists();
          var result = lists.map(function(l) {
            return { name: l.name(), id: l.id() };
          });
          JSON.stringify(result);
        `;
        const output = await jxa(script);
        const lists: Array<{ name: string; id: string }> = JSON.parse(output);

        if (lists.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No reminder lists found.' }] };
        }

        const lines = [`Found ${lists.length} reminder list${lists.length !== 1 ? 's' : ''}:`, ''];
        for (const list of lists) {
          lines.push(`ID: ${list.id}`);
          lines.push(`Name: ${fenceUntrustedContent(list.name, 'Apple Reminders')}`);
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing reminder lists: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Reminder Lists',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// reminders_list_reminders
// ---------------------------------------------------------------------------

function createListRemindersTool(jxa: JxaRunner) {
  return tool(
    'reminders_list_reminders',
    'List reminders in a specific reminder list. Optionally filter by completed or incomplete status.',
    {
      listName: z.string().describe('The name of the reminder list to retrieve reminders from'),
      filter: z
        .enum(['all', 'completed', 'incomplete'])
        .optional()
        .describe('Filter reminders by completion status. Defaults to "all".'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Maximum number of reminders to return (1-200, default 50)'),
    },
    async (args) => {
      try {
        const filter = args.filter ?? 'all';
        const maxResults = args.maxResults ?? 50;
        const script = `
          var app = Application("Reminders");
          var lists = app.lists.whose({ name: ${JSON.stringify(args.listName)} })();
          if (lists.length === 0) {
            JSON.stringify({ error: "List not found: " + ${JSON.stringify(args.listName)} });
          } else {
            var list = lists[0];
            var reminders = list.reminders();
            var filtered = reminders.filter(function(r) {
              var completed = r.completed();
              if (${JSON.stringify(filter)} === 'completed') return completed;
              if (${JSON.stringify(filter)} === 'incomplete') return !completed;
              return true;
            }).slice(0, ${maxResults});
            var result = filtered.map(function(r) {
              var dueDate = null;
              try { dueDate = r.dueDate() ? r.dueDate().toISOString() : null; } catch(e) {}
              return {
                id: r.id(),
                name: r.name(),
                body: r.body(),
                completed: r.completed(),
                dueDate: dueDate,
                priority: r.priority()
              };
            });
            JSON.stringify(result);
          }
        `;
        const output = await jxa(script);
        const parsed = JSON.parse(output);

        if (parsed.error) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${sanitizeError(new Error(parsed.error))}` }],
            isError: true,
          };
        }

        const reminders: Array<{
          id: string;
          name: string;
          body: string;
          completed: boolean;
          dueDate: string | null;
          priority: number;
        }> = parsed;

        if (reminders.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No ${filter !== 'all' ? filter + ' ' : ''}reminders found in list "${fenceUntrustedContent(args.listName, 'Apple Reminders')}".`,
              },
            ],
          };
        }

        const lines = [
          `Found ${reminders.length} ${filter !== 'all' ? filter + ' ' : ''}reminder${reminders.length !== 1 ? 's' : ''} in "${fenceUntrustedContent(args.listName, 'Apple Reminders')}":`,
          '',
        ];
        for (const r of reminders) {
          lines.push(`ID: ${r.id}`);
          lines.push(`Name: ${fenceUntrustedContent(r.name, 'Apple Reminders')}`);
          lines.push(`Completed: ${r.completed}`);
          if (r.body) lines.push(`Notes: ${fenceUntrustedContent(r.body, 'Apple Reminders')}`);
          if (r.dueDate) lines.push(`Due: ${r.dueDate}`);
          lines.push(`Priority: ${r.priority}`);
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing reminders: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Reminders',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// reminders_get_reminder
// ---------------------------------------------------------------------------

function createGetReminderTool(jxa: JxaRunner) {
  return tool(
    'reminders_get_reminder',
    'Get details of a specific reminder by name across all lists, or by ID.',
    {
      name: z
        .string()
        .optional()
        .describe('The name (title) of the reminder to search for'),
      id: z
        .string()
        .optional()
        .describe('The unique ID of the reminder'),
    },
    async (args) => {
      try {
        if (!args.name && !args.id) {
          return {
            content: [{ type: 'text' as const, text: 'Error: Either name or id must be provided.' }],
            isError: true,
          };
        }

        const script = args.id
          ? `
            var app = Application("Reminders");
            var found = null;
            var lists = app.lists();
            for (var i = 0; i < lists.length; i++) {
              var reminders = lists[i].reminders();
              for (var j = 0; j < reminders.length; j++) {
                if (reminders[j].id() === ${JSON.stringify(args.id)}) {
                  found = reminders[j];
                  break;
                }
              }
              if (found) break;
            }
            if (!found) {
              JSON.stringify({ error: "Reminder not found with id: " + ${JSON.stringify(args.id)} });
            } else {
              var dueDate = null;
              try { dueDate = found.dueDate() ? found.dueDate().toISOString() : null; } catch(e) {}
              JSON.stringify({
                id: found.id(),
                name: found.name(),
                body: found.body(),
                completed: found.completed(),
                dueDate: dueDate,
                priority: found.priority()
              });
            }
          `
          : `
            var app = Application("Reminders");
            var found = null;
            var lists = app.lists();
            for (var i = 0; i < lists.length; i++) {
              var reminders = lists[i].reminders.whose({ name: ${JSON.stringify(args.name)} })();
              if (reminders.length > 0) {
                found = reminders[0];
                break;
              }
            }
            if (!found) {
              JSON.stringify({ error: "Reminder not found with name: " + ${JSON.stringify(args.name)} });
            } else {
              var dueDate = null;
              try { dueDate = found.dueDate() ? found.dueDate().toISOString() : null; } catch(e) {}
              JSON.stringify({
                id: found.id(),
                name: found.name(),
                body: found.body(),
                completed: found.completed(),
                dueDate: dueDate,
                priority: found.priority()
              });
            }
          `;

        const output = await jxa(script);
        const parsed = JSON.parse(output);

        if (parsed.error) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${sanitizeError(new Error(parsed.error))}` }],
            isError: true,
          };
        }

        const lines = [
          `ID: ${parsed.id}`,
          `Name: ${fenceUntrustedContent(parsed.name, 'Apple Reminders')}`,
          `Completed: ${parsed.completed}`,
          `Priority: ${parsed.priority}`,
        ];
        if (parsed.body) lines.push(`Notes: ${fenceUntrustedContent(parsed.body, 'Apple Reminders')}`);
        if (parsed.dueDate) lines.push(`Due: ${parsed.dueDate}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error retrieving reminder: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Reminder',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// reminders_create_reminder
// ---------------------------------------------------------------------------

function createCreateReminderTool(jxa: JxaRunner) {
  return tool(
    'reminders_create_reminder',
    'Create a new reminder in Apple Reminders.',
    {
      name: z.string().max(1000).describe('The title/name of the reminder'),
      listName: z
        .string()
        .optional()
        .describe(
          'The name of the reminder list to add the reminder to. Defaults to the default reminders list.'
        ),
      notes: z
        .string()
        .max(10000)
        .optional()
        .describe('Additional notes or body text for the reminder'),
      dueDate: z
        .string()
        .optional()
        .describe('Due date/time in ISO 8601 format (e.g. "2024-12-25T09:00:00")'),
      priority: z
        .number()
        .int()
        .min(0)
        .max(9)
        .optional()
        .describe('Priority level 0 (none), 1 (high), 5 (medium), 9 (low)'),
    },
    async (args) => {
      try {
        const dueDatePart = args.dueDate
          ? `reminder.dueDate = new Date(${JSON.stringify(args.dueDate)});`
          : '';
        const notesPart = args.notes ? `reminder.body = ${JSON.stringify(args.notes)};` : '';
        const priorityPart =
          args.priority !== undefined ? `reminder.priority = ${args.priority};` : '';

        const script = args.listName
          ? `
            var app = Application("Reminders");
            var lists = app.lists.whose({ name: ${JSON.stringify(args.listName)} })();
            if (lists.length === 0) {
              JSON.stringify({ error: "List not found: " + ${JSON.stringify(args.listName)} });
            } else {
              var targetList = lists[0];
              var reminder = app.Reminder({ name: ${JSON.stringify(args.name)} });
              ${notesPart}
              ${dueDatePart}
              ${priorityPart}
              targetList.reminders.push(reminder);
              JSON.stringify({ success: true, id: reminder.id(), name: reminder.name() });
            }
          `
          : `
            var app = Application("Reminders");
            var targetList = app.defaultList;
            var reminder = app.Reminder({ name: ${JSON.stringify(args.name)} });
            ${notesPart}
            ${dueDatePart}
            ${priorityPart}
            targetList.reminders.push(reminder);
            JSON.stringify({ success: true, id: reminder.id(), name: reminder.name() });
          `;

        const output = await jxa(script);
        const parsed = JSON.parse(output);

        if (parsed.error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${sanitizeError(new Error(parsed.error))}`,
              },
            ],
            isError: true,
          };
        }

        const lines = [
          'Reminder created successfully.',
          `ID: ${parsed.id}`,
          `Name: ${fenceUntrustedContent(parsed.name, 'Apple Reminders')}`,
        ];
        if (args.listName)
          lines.push(`List: ${fenceUntrustedContent(args.listName, 'Apple Reminders')}`);
        if (args.dueDate) lines.push(`Due: ${args.dueDate}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error creating reminder: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Create Reminder',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// reminders_complete_reminder
// ---------------------------------------------------------------------------

function createCompleteReminderTool(jxa: JxaRunner) {
  return tool(
    'reminders_complete_reminder',
    'Mark a reminder as completed in Apple Reminders.',
    {
      id: z.string().optional().describe('The unique ID of the reminder to complete'),
      name: z
        .string()
        .optional()
        .describe('The name of the reminder to complete (used if id is not provided)'),
      listName: z
        .string()
        .optional()
        .describe(
          'Optionally specify the list name to narrow the search when using name'
        ),
    },
    async (args) => {
      try {
        if (!args.id && !args.name) {
          return {
            content: [
              { type: 'text' as const, text: 'Error: Either id or name must be provided.' },
            ],
            isError: true,
          };
        }

        let script: string;
        if (args.id) {
          script = `
            var app = Application("Reminders");
            var found = null;
            var lists = app.lists();
            for (var i = 0; i < lists.length; i++) {
              var reminders = lists[i].reminders();
              for (var j = 0; j < reminders.length; j++) {
                if (reminders[j].id() === ${JSON.stringify(args.id)}) {
                  found = reminders[j];
                  break;
                }
              }
              if (found) break;
            }
            if (!found) {
              JSON.stringify({ error: "Reminder not found with id: " + ${JSON.stringify(args.id)} });
            } else {
              found.completed = true;
              JSON.stringify({ success: true, id: found.id(), name: found.name() });
            }
          `;
        } else {
          const listFilter = args.listName
            ? `var lists = app.lists.whose({ name: ${JSON.stringify(args.listName)} })();`
            : `var lists = app.lists();`;
          script = `
            var app = Application("Reminders");
            ${listFilter}
            var found = null;
            for (var i = 0; i < lists.length; i++) {
              var reminders = lists[i].reminders.whose({ name: ${JSON.stringify(args.name)} })();
              if (reminders.length > 0) {
                found = reminders[0];
                break;
              }
            }
            if (!found) {
              JSON.stringify({ error: "Reminder not found with name: " + ${JSON.stringify(args.name)} });
            } else {
              found.completed = true;
              JSON.stringify({ success: true, id: found.id(), name: found.name() });
            }
          `;
        }

        const output = await jxa(script);
        const parsed = JSON.parse(output);

        if (parsed.error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${sanitizeError(new Error(parsed.error))}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Reminder completed successfully.\nID: ${parsed.id}\nName: ${fenceUntrustedContent(parsed.name, 'Apple Reminders')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error completing reminder: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Complete Reminder',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// reminders_search
// ---------------------------------------------------------------------------

function createSearchTool(jxa: JxaRunner) {
  return tool(
    'reminders_search',
    'Search reminders by text across all reminder lists.',
    {
      query: z.string().describe('The text to search for in reminder names and notes'),
      includeCompleted: z
        .boolean()
        .optional()
        .describe('Whether to include completed reminders in results. Defaults to false.'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Maximum number of results to return (1-200, default 25)'),
    },
    async (args) => {
      try {
        const includeCompleted = args.includeCompleted ?? false;
        const maxResults = args.maxResults ?? 25;
        const script = `
          var app = Application("Reminders");
          var queryLower = ${JSON.stringify(args.query.toLowerCase())};
          var results = [];
          var lists = app.lists();
          for (var i = 0; i < lists.length; i++) {
            var list = lists[i];
            var listName = list.name();
            var reminders = list.reminders();
            for (var j = 0; j < reminders.length; j++) {
              var r = reminders[j];
              if (!${includeCompleted} && r.completed()) continue;
              var rName = (r.name() || '').toLowerCase();
              var rBody = (r.body() || '').toLowerCase();
              if (rName.indexOf(queryLower) !== -1 || rBody.indexOf(queryLower) !== -1) {
                var dueDate = null;
                try { dueDate = r.dueDate() ? r.dueDate().toISOString() : null; } catch(e) {}
                results.push({
                  id: r.id(),
                  name: r.name(),
                  body: r.body(),
                  completed: r.completed(),
                  dueDate: dueDate,
                  priority: r.priority(),
                  listName: listName
                });
                if (results.length >= ${maxResults}) break;
              }
            }
            if (results.length >= ${maxResults}) break;
          }
          JSON.stringify(results);
        `;

        const output = await jxa(script);
        const results: Array<{
          id: string;
          name: string;
          body: string;
          completed: boolean;
          dueDate: string | null;
          priority: number;
          listName: string;
        }> = JSON.parse(output);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No reminders found matching "${fenceUntrustedContent(args.query, 'Apple Reminders')}".`,
              },
            ],
          };
        }

        const lines = [
          `Found ${results.length} reminder${results.length !== 1 ? 's' : ''} matching "${fenceUntrustedContent(args.query, 'Apple Reminders')}":`,
          '',
        ];
        for (const r of results) {
          lines.push(`ID: ${r.id}`);
          lines.push(`Name: ${fenceUntrustedContent(r.name, 'Apple Reminders')}`);
          lines.push(`List: ${fenceUntrustedContent(r.listName, 'Apple Reminders')}`);
          lines.push(`Completed: ${r.completed}`);
          if (r.body) lines.push(`Notes: ${fenceUntrustedContent(r.body, 'Apple Reminders')}`);
          if (r.dueDate) lines.push(`Due: ${r.dueDate}`);
          lines.push(`Priority: ${r.priority}`);
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error searching reminders: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Reminders',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createAppleRemindersTools(jxa: JxaRunner = runJxa): ConnectorToolDefinition[] {
  return [
    {
      name: 'reminders_list_lists',
      description: 'List all reminder lists in Apple Reminders',
      sdkTool: createListListsTool(jxa),
    },
    {
      name: 'reminders_list_reminders',
      description: 'List reminders in a specific reminder list',
      sdkTool: createListRemindersTool(jxa),
    },
    {
      name: 'reminders_get_reminder',
      description: 'Get details of a specific reminder by name or ID',
      sdkTool: createGetReminderTool(jxa),
    },
    {
      name: 'reminders_create_reminder',
      description: 'Create a new reminder in Apple Reminders',
      sdkTool: createCreateReminderTool(jxa),
    },
    {
      name: 'reminders_complete_reminder',
      description: 'Mark a reminder as completed',
      sdkTool: createCompleteReminderTool(jxa),
    },
    {
      name: 'reminders_search',
      description: 'Search reminders by text across all lists',
      sdkTool: createSearchTool(jxa),
    },
  ];
}
