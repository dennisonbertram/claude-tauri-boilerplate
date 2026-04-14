import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Todoist REST API v2 base URL
// ---------------------------------------------------------------------------

const TODOIST_API_BASE = 'https://api.todoist.com/rest/v2';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Resolve the Todoist API token.
 *
 * Resolution order:
 * 1. `TODOIST_API_TOKEN` environment variable (dev / CI override)
 * 2. `connector_settings` table in the app database (key = 'todoist_api_token')
 *
 * The db lookup is best-effort — if the table does not exist yet (e.g. before
 * the migration runs) it silently falls through to the env var result.
 */
function getTodoistToken(db: Database): string | null {
  // 1. Environment variable
  const envToken = process.env.TODOIST_API_TOKEN;
  if (envToken) return envToken;

  // 2. Database lookup (graceful — table may not exist yet)
  try {
    const row = db
      .prepare(
        `SELECT value FROM connector_settings WHERE key = 'todoist_api_token' LIMIT 1`
      )
      .get() as { value: string } | null | undefined;
    return row?.value ?? null;
  } catch {
    // Table doesn't exist or query failed — treat as unconfigured
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function todoistFetch(
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${TODOIST_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Todoist API error ${response.status}: ${text.substring(0, 200)}`);
  }

  // 204 No Content (e.g. close task) — return empty object
  if (response.status === 204) return {};

  return response.json();
}

// ---------------------------------------------------------------------------
// todoist_list_tasks
// ---------------------------------------------------------------------------

function createListTasksTool(db: Database) {
  return tool(
    'todoist_list_tasks',
    'List tasks from Todoist with optional filters. Returns active (incomplete) tasks matching the criteria.',
    {
      project_id: z
        .string()
        .optional()
        .describe('Filter tasks by project ID. Omit to list tasks across all projects.'),
      label: z
        .string()
        .optional()
        .describe('Filter tasks that have this label.'),
      priority: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe('Filter by priority level: 1=normal, 2=medium, 3=high, 4=urgent.'),
      filter: z
        .string()
        .optional()
        .describe(
          'Todoist filter string (e.g. "today", "overdue", "p1", "assigned to: me"). Uses Todoist filter syntax.'
        ),
    },
    async (args) => {
      const token = getTodoistToken(db);
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Todoist is not configured. Set the TODOIST_API_TOKEN environment variable or add your API token in Settings.',
            },
          ],
          isError: true,
        };
      }

      try {
        const params = new URLSearchParams();
        if (args.project_id) params.set('project_id', args.project_id);
        if (args.label) params.set('label', args.label);
        if (args.priority !== undefined) params.set('priority', String(args.priority));
        if (args.filter) params.set('filter', args.filter);

        const qs = params.toString();
        const tasks = (await todoistFetch(token, 'GET', `/tasks${qs ? `?${qs}` : ''}`)) as Array<{
          id: string;
          content: string;
          description: string;
          priority: number;
          due?: { string: string; date: string };
          project_id: string;
          labels: string[];
          url: string;
        }>;

        if (tasks.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No tasks found matching the given criteria.' }] };
        }

        const lines: string[] = [`Found ${tasks.length} task${tasks.length !== 1 ? 's' : ''}:`, ''];
        for (const task of tasks) {
          lines.push(`ID: ${task.id}`);
          lines.push(`Content: ${fenceUntrustedContent(task.content, 'Todoist')}`);
          if (task.description) {
            lines.push(`Description: ${fenceUntrustedContent(task.description, 'Todoist')}`);
          }
          lines.push(`Priority: ${task.priority}`);
          if (task.due) {
            lines.push(`Due: ${fenceUntrustedContent(task.due.string || task.due.date, 'Todoist')}`);
          }
          lines.push(`Project ID: ${task.project_id}`);
          if (task.labels.length > 0) {
            lines.push(`Labels: ${fenceUntrustedContent(task.labels.join(', '), 'Todoist')}`);
          }
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing tasks: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Todoist Tasks',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// todoist_get_task
// ---------------------------------------------------------------------------

function createGetTaskTool(db: Database) {
  return tool(
    'todoist_get_task',
    'Get the details of a specific Todoist task by its ID.',
    {
      task_id: z.string().describe('The Todoist task ID to retrieve.'),
    },
    async (args) => {
      const token = getTodoistToken(db);
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Todoist is not configured. Set the TODOIST_API_TOKEN environment variable or add your API token in Settings.',
            },
          ],
          isError: true,
        };
      }

      try {
        const task = (await todoistFetch(token, 'GET', `/tasks/${encodeURIComponent(args.task_id)}`)) as {
          id: string;
          content: string;
          description: string;
          priority: number;
          due?: { string: string; date: string; datetime?: string };
          project_id: string;
          labels: string[];
          url: string;
          created_at: string;
          creator_id: string;
          assignee_id: string | null;
          comment_count: number;
          is_completed: boolean;
        };

        const lines = [
          `ID: ${task.id}`,
          `Content: ${fenceUntrustedContent(task.content, 'Todoist')}`,
          task.description ? `Description: ${fenceUntrustedContent(task.description, 'Todoist')}` : null,
          `Priority: ${task.priority}`,
          task.due
            ? `Due: ${fenceUntrustedContent(task.due.datetime ?? task.due.date ?? task.due.string, 'Todoist')}`
            : null,
          `Project ID: ${task.project_id}`,
          task.labels.length > 0
            ? `Labels: ${fenceUntrustedContent(task.labels.join(', '), 'Todoist')}`
            : null,
          `Completed: ${task.is_completed}`,
          `Comment Count: ${task.comment_count}`,
          `Created At: ${task.created_at}`,
          `URL: ${task.url}`,
        ]
          .filter(Boolean)
          .join('\n');

        return { content: [{ type: 'text' as const, text: lines }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving task: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Todoist Task',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// todoist_create_task
// ---------------------------------------------------------------------------

function createCreateTaskTool(db: Database) {
  return tool(
    'todoist_create_task',
    'Create a new task in Todoist. Returns the created task details.',
    {
      content: z.string().max(1000).describe('The task content/title (required).'),
      description: z
        .string()
        .max(10000)
        .optional()
        .describe('Optional longer description for the task (supports Markdown).'),
      due_string: z
        .string()
        .optional()
        .describe(
          'Natural language due date (e.g. "tomorrow", "next Monday", "Jan 15"). Uses Todoist smart date parsing.'
        ),
      priority: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe('Task priority: 1=normal (default), 2=medium, 3=high, 4=urgent.'),
      project_id: z
        .string()
        .optional()
        .describe('Project ID to add the task to. Omit to use the default Inbox project.'),
      labels: z
        .array(z.string())
        .optional()
        .describe('Array of label names to attach to the task.'),
    },
    async (args) => {
      const token = getTodoistToken(db);
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Todoist is not configured. Set the TODOIST_API_TOKEN environment variable or add your API token in Settings.',
            },
          ],
          isError: true,
        };
      }

      try {
        const body: Record<string, unknown> = { content: args.content };
        if (args.description !== undefined) body.description = args.description;
        if (args.due_string !== undefined) body.due_string = args.due_string;
        if (args.priority !== undefined) body.priority = args.priority;
        if (args.project_id !== undefined) body.project_id = args.project_id;
        if (args.labels !== undefined) body.labels = args.labels;

        const task = (await todoistFetch(token, 'POST', '/tasks', body)) as {
          id: string;
          content: string;
          description: string;
          priority: number;
          due?: { string: string; date: string };
          project_id: string;
          labels: string[];
          url: string;
        };

        const lines = [
          'Task created successfully.',
          `ID: ${task.id}`,
          `Content: ${fenceUntrustedContent(task.content, 'Todoist')}`,
          task.description ? `Description: ${fenceUntrustedContent(task.description, 'Todoist')}` : null,
          `Priority: ${task.priority}`,
          task.due ? `Due: ${fenceUntrustedContent(task.due.string || task.due.date, 'Todoist')}` : null,
          `Project ID: ${task.project_id}`,
          task.labels.length > 0
            ? `Labels: ${fenceUntrustedContent(task.labels.join(', '), 'Todoist')}`
            : null,
          `URL: ${task.url}`,
        ]
          .filter(Boolean)
          .join('\n');

        return { content: [{ type: 'text' as const, text: lines }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating task: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Create Todoist Task',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// todoist_update_task
// ---------------------------------------------------------------------------

function createUpdateTaskTool(db: Database) {
  return tool(
    'todoist_update_task',
    'Update fields of an existing Todoist task. Only the provided fields will be changed.',
    {
      task_id: z.string().describe('The Todoist task ID to update.'),
      content: z.string().max(1000).optional().describe('New task content/title.'),
      description: z.string().max(10000).optional().describe('New task description.'),
      due_string: z
        .string()
        .optional()
        .describe('New due date in natural language (e.g. "tomorrow", "next week").'),
      priority: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe('New priority: 1=normal, 2=medium, 3=high, 4=urgent.'),
      labels: z
        .array(z.string())
        .optional()
        .describe('Replace all labels with this array. Pass an empty array to clear labels.'),
    },
    async (args) => {
      const token = getTodoistToken(db);
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Todoist is not configured. Set the TODOIST_API_TOKEN environment variable or add your API token in Settings.',
            },
          ],
          isError: true,
        };
      }

      try {
        const body: Record<string, unknown> = {};
        if (args.content !== undefined) body.content = args.content;
        if (args.description !== undefined) body.description = args.description;
        if (args.due_string !== undefined) body.due_string = args.due_string;
        if (args.priority !== undefined) body.priority = args.priority;
        if (args.labels !== undefined) body.labels = args.labels;

        if (Object.keys(body).length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No fields provided to update. Specify at least one field to change.' }],
            isError: true,
          };
        }

        const task = (await todoistFetch(token, 'POST', `/tasks/${encodeURIComponent(args.task_id)}`, body)) as {
          id: string;
          content: string;
          description: string;
          priority: number;
          due?: { string: string; date: string };
          project_id: string;
          labels: string[];
          url: string;
        };

        const lines = [
          'Task updated successfully.',
          `ID: ${task.id}`,
          `Content: ${fenceUntrustedContent(task.content, 'Todoist')}`,
          task.description ? `Description: ${fenceUntrustedContent(task.description, 'Todoist')}` : null,
          `Priority: ${task.priority}`,
          task.due ? `Due: ${fenceUntrustedContent(task.due.string || task.due.date, 'Todoist')}` : null,
          `Project ID: ${task.project_id}`,
          task.labels.length > 0
            ? `Labels: ${fenceUntrustedContent(task.labels.join(', '), 'Todoist')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n');

        return { content: [{ type: 'text' as const, text: lines }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating task: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Update Todoist Task',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// todoist_complete_task
// ---------------------------------------------------------------------------

function createCompleteTaskTool(db: Database) {
  return tool(
    'todoist_complete_task',
    'Mark a Todoist task as complete (close it). This action is reversible via the Todoist UI.',
    {
      task_id: z.string().describe('The Todoist task ID to mark as complete.'),
    },
    async (args) => {
      const token = getTodoistToken(db);
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Todoist is not configured. Set the TODOIST_API_TOKEN environment variable or add your API token in Settings.',
            },
          ],
          isError: true,
        };
      }

      try {
        await todoistFetch(token, 'POST', `/tasks/${encodeURIComponent(args.task_id)}/close`);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Task ${args.task_id} marked as complete.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error completing task: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Complete Todoist Task',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// todoist_list_projects
// ---------------------------------------------------------------------------

function createListProjectsTool(db: Database) {
  return tool(
    'todoist_list_projects',
    'List all projects in Todoist. Returns project IDs, names, and hierarchy.',
    {},
    async (_args) => {
      const token = getTodoistToken(db);
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Todoist is not configured. Set the TODOIST_API_TOKEN environment variable or add your API token in Settings.',
            },
          ],
          isError: true,
        };
      }

      try {
        const projects = (await todoistFetch(token, 'GET', '/projects')) as Array<{
          id: string;
          name: string;
          color: string;
          parent_id: string | null;
          order: number;
          is_inbox_project: boolean;
          is_team_inbox: boolean;
          comment_count: number;
          url: string;
        }>;

        if (projects.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No projects found.' }] };
        }

        const lines: string[] = [`Found ${projects.length} project${projects.length !== 1 ? 's' : ''}:`, ''];
        for (const project of projects) {
          lines.push(`ID: ${project.id}`);
          lines.push(`Name: ${fenceUntrustedContent(project.name, 'Todoist')}`);
          if (project.parent_id) lines.push(`Parent ID: ${project.parent_id}`);
          if (project.is_inbox_project) lines.push('(Inbox project)');
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing projects: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Todoist Projects',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// todoist_search_tasks
// ---------------------------------------------------------------------------

function createSearchTasksTool(db: Database) {
  return tool(
    'todoist_search_tasks',
    'Search Todoist tasks using Todoist filter syntax. Examples: "today", "overdue", "p1", "#ProjectName", "@label", "assigned to: me".',
    {
      filter: z
        .string()
        .describe(
          'Todoist filter query string. Uses Todoist filter syntax (e.g. "today & @work", "overdue | due before: +7 days", "p1 & #MyProject").'
        ),
    },
    async (args) => {
      const token = getTodoistToken(db);
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Todoist is not configured. Set the TODOIST_API_TOKEN environment variable or add your API token in Settings.',
            },
          ],
          isError: true,
        };
      }

      try {
        const params = new URLSearchParams({ filter: args.filter });
        const tasks = (await todoistFetch(token, 'GET', `/tasks?${params.toString()}`)) as Array<{
          id: string;
          content: string;
          description: string;
          priority: number;
          due?: { string: string; date: string };
          project_id: string;
          labels: string[];
          url: string;
        }>;

        if (tasks.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No tasks found matching filter: "${fenceUntrustedContent(args.filter, 'Todoist')}"`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${tasks.length} task${tasks.length !== 1 ? 's' : ''} matching filter "${fenceUntrustedContent(args.filter, 'Todoist')}":`,
          '',
        ];
        for (const task of tasks) {
          lines.push(`ID: ${task.id}`);
          lines.push(`Content: ${fenceUntrustedContent(task.content, 'Todoist')}`);
          if (task.description) {
            lines.push(`Description: ${fenceUntrustedContent(task.description, 'Todoist')}`);
          }
          lines.push(`Priority: ${task.priority}`);
          if (task.due) {
            lines.push(`Due: ${fenceUntrustedContent(task.due.string || task.due.date, 'Todoist')}`);
          }
          lines.push(`Project ID: ${task.project_id}`);
          if (task.labels.length > 0) {
            lines.push(`Labels: ${fenceUntrustedContent(task.labels.join(', '), 'Todoist')}`);
          }
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching tasks: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Todoist Tasks',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'todoist_list_tasks',
      description: 'List tasks from Todoist with optional filters',
      sdkTool: createListTasksTool(db),
    },
    {
      name: 'todoist_get_task',
      description: 'Get details of a specific Todoist task by ID',
      sdkTool: createGetTaskTool(db),
    },
    {
      name: 'todoist_create_task',
      description: 'Create a new task in Todoist',
      sdkTool: createCreateTaskTool(db),
    },
    {
      name: 'todoist_update_task',
      description: 'Update fields of an existing Todoist task',
      sdkTool: createUpdateTaskTool(db),
    },
    {
      name: 'todoist_complete_task',
      description: 'Mark a Todoist task as complete',
      sdkTool: createCompleteTaskTool(db),
    },
    {
      name: 'todoist_list_projects',
      description: 'List all projects in Todoist',
      sdkTool: createListProjectsTool(db),
    },
    {
      name: 'todoist_search_tasks',
      description: 'Search Todoist tasks using Todoist filter syntax',
      sdkTool: createSearchTasksTool(db),
    },
  ];
}
