/**
 * Tracker Tool Definitions for LLM Integration
 *
 * These tool definitions follow the Anthropic tool_use schema format so they
 * can be advertised to Claude via MCP server configuration or injected into
 * agent profile system prompts.
 *
 * Integration path:
 *   The Claude Agent SDK (`query()`) does NOT accept raw tool definitions
 *   directly. Tools are provided via MCP servers configured in agent profiles.
 *   This module provides:
 *     1. Tool schemas (TRACKER_TOOL_DEFINITIONS) for documentation / MCP server use
 *     2. Handler functions that execute against the DB
 *     3. A `handleTrackerToolCall` dispatcher for MCP server implementations
 *
 * To wire these into the chat system, add a local MCP server entry to the
 * agent profile's `mcpServersJson` that exposes these tools, OR inject the
 * tool descriptions into the system prompt so the agent can call the REST API.
 *
 * See the integration notes at the bottom of this file.
 */

import type { Database } from 'bun:sqlite';
import {
  listTrackerProjects,
  getTrackerProject,
  getTrackerProjectWithDetails,
  listTrackerStatuses,
  createTrackerIssue,
  getTrackerIssue,
  getTrackerIssueByIdentifier,
  listTrackerIssues,
  updateTrackerIssue,
  listTrackerComments,
  createTrackerComment,
} from '../db';

// ---------------------------------------------------------------------------
// Tool Schema Definitions (Anthropic tool_use format)
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TRACKER_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'tracker_list_projects',
    description:
      'List all tracker projects. Returns an array of project objects with id, name, slug, description, and metadata.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'tracker_get_project',
    description:
      'Get a tracker project by ID, including its statuses and labels. Use this to discover available statuses before creating or updating issues.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The UUID of the tracker project',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'tracker_create_issue',
    description:
      'Create a new issue in a tracker project. Returns the created issue with its identifier (e.g. "PROJ-1"), status, and labels. If statusId is omitted, the issue is placed in the first "todo" status.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The UUID of the tracker project to create the issue in',
        },
        title: {
          type: 'string',
          description: 'Issue title (required, max 500 chars)',
        },
        description: {
          type: 'string',
          description: 'Issue description in markdown (optional, max 50000 chars)',
        },
        statusId: {
          type: 'string',
          description:
            'UUID of the status to assign. Omit to use the default "Todo" status. Use tracker_get_project to see available statuses.',
        },
        priority: {
          type: 'number',
          description:
            'Priority level: 0 = none, 1 = urgent, 2 = high, 3 = medium (default), 4 = low',
          enum: [0, 1, 2, 3, 4],
        },
        assignee: {
          type: 'string',
          description: 'Name or identifier of the assignee (optional)',
        },
        dueDate: {
          type: 'string',
          description: 'Due date in ISO 8601 format, e.g. "2025-03-15" (optional)',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of label UUIDs to attach (optional)',
        },
        parentIssueId: {
          type: 'string',
          description: 'UUID of a parent issue for sub-task relationships (optional)',
        },
        workspaceId: {
          type: 'string',
          description: 'Link issue to a workspace by UUID (optional)',
        },
        sessionId: {
          type: 'string',
          description: 'Link issue to a chat session by UUID (optional)',
        },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'tracker_update_issue',
    description:
      'Update an existing tracker issue. Accepts the issue UUID or identifier (e.g. "PROJ-1"). Only the fields provided will be updated.',
    input_schema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'The issue UUID or identifier (e.g. "PROJ-1")',
        },
        title: {
          type: 'string',
          description: 'New title (max 500 chars)',
        },
        description: {
          type: 'string',
          description: 'New description in markdown (max 50000 chars). Pass null to clear.',
        },
        statusId: {
          type: 'string',
          description: 'UUID of the new status',
        },
        priority: {
          type: 'number',
          description: 'New priority: 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low',
          enum: [0, 1, 2, 3, 4],
        },
        assignee: {
          type: 'string',
          description: 'New assignee name or null to unassign',
        },
        dueDate: {
          type: 'string',
          description: 'New due date in ISO format or null to clear',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replacement array of label UUIDs (replaces all existing labels)',
        },
        parentIssueId: {
          type: 'string',
          description: 'New parent issue UUID or null to remove parent',
        },
        workspaceId: {
          type: 'string',
          description: 'Link to workspace or null to unlink',
        },
        sessionId: {
          type: 'string',
          description: 'Link to session or null to unlink',
        },
      },
      required: ['issueId'],
    },
  },
  {
    name: 'tracker_list_issues',
    description:
      'List and search issues in a tracker project. Supports filtering by status, priority, assignee, and free-text search. Returns issues with their current status.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The UUID of the tracker project',
        },
        statusId: {
          type: 'string',
          description: 'Filter by status UUID',
        },
        priority: {
          type: 'number',
          description: 'Filter by priority (0-4)',
        },
        assignee: {
          type: 'string',
          description: 'Filter by assignee name',
        },
        search: {
          type: 'string',
          description: 'Free-text search across title and description',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'tracker_get_issue',
    description:
      'Get full details of a single tracker issue by UUID or identifier (e.g. "PROJ-1"). Returns the issue with status, labels, and all fields.',
    input_schema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'The issue UUID or identifier (e.g. "PROJ-1")',
        },
      },
      required: ['issueId'],
    },
  },
  {
    name: 'tracker_add_comment',
    description:
      'Add a comment to a tracker issue. Comments are used for discussion, status updates, and audit trail.',
    input_schema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'The issue UUID or identifier (e.g. "PROJ-1")',
        },
        content: {
          type: 'string',
          description: 'Comment content in markdown (max 50000 chars)',
        },
        author: {
          type: 'string',
          description: 'Author name. Defaults to "assistant" for LLM-generated comments.',
        },
      },
      required: ['issueId', 'content'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

export type TrackerToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

function resolveIssue(db: Database, issueId: string) {
  let issue = getTrackerIssue(db, issueId);
  if (!issue) issue = getTrackerIssueByIdentifier(db, issueId);
  return issue;
}

export function handleTrackerListProjects(db: Database): TrackerToolResult {
  const projects = listTrackerProjects(db);
  return { success: true, data: projects };
}

export function handleTrackerGetProject(
  db: Database,
  input: { projectId: string }
): TrackerToolResult {
  const project = getTrackerProjectWithDetails(db, input.projectId);
  if (!project) {
    return { success: false, error: `Project not found: ${input.projectId}` };
  }
  return { success: true, data: project };
}

export function handleTrackerCreateIssue(
  db: Database,
  input: {
    projectId: string;
    title: string;
    description?: string;
    statusId?: string;
    priority?: number;
    assignee?: string;
    dueDate?: string;
    labels?: string[];
    parentIssueId?: string;
    workspaceId?: string;
    sessionId?: string;
  }
): TrackerToolResult {
  const project = getTrackerProject(db, input.projectId);
  if (!project) {
    return { success: false, error: `Project not found: ${input.projectId}` };
  }

  // Resolve default status if not provided
  let statusId = input.statusId;
  if (!statusId) {
    const statuses = listTrackerStatuses(db, input.projectId);
    const todoStatus = statuses.find((s) => s.category === 'todo');
    statusId = todoStatus?.id ?? statuses[0]?.id;
    if (!statusId) {
      return { success: false, error: 'No statuses defined for this project' };
    }
  }

  try {
    const issue = createTrackerIssue(db, {
      trackerProjectId: input.projectId,
      title: input.title,
      description: input.description,
      statusId,
      priority: input.priority,
      assignee: input.assignee,
      dueDate: input.dueDate,
      labels: input.labels,
      parentIssueId: input.parentIssueId,
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
    });
    return { success: true, data: issue };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function handleTrackerUpdateIssue(
  db: Database,
  input: {
    issueId: string;
    title?: string;
    description?: string | null;
    statusId?: string;
    priority?: number;
    assignee?: string | null;
    dueDate?: string | null;
    labels?: string[];
    parentIssueId?: string | null;
    workspaceId?: string | null;
    sessionId?: string | null;
  }
): TrackerToolResult {
  const issue = resolveIssue(db, input.issueId);
  if (!issue) {
    return { success: false, error: `Issue not found: ${input.issueId}` };
  }

  const { issueId: _, ...updates } = input;
  updateTrackerIssue(db, issue.id, updates);
  const updated = getTrackerIssue(db, issue.id);
  return { success: true, data: updated };
}

export function handleTrackerListIssues(
  db: Database,
  input: {
    projectId: string;
    statusId?: string;
    priority?: number;
    assignee?: string;
    search?: string;
  }
): TrackerToolResult {
  const project = getTrackerProject(db, input.projectId);
  if (!project) {
    return { success: false, error: `Project not found: ${input.projectId}` };
  }

  const { projectId, ...filters } = input;
  const issues = listTrackerIssues(db, projectId, filters);
  return { success: true, data: issues };
}

export function handleTrackerGetIssue(
  db: Database,
  input: { issueId: string }
): TrackerToolResult {
  const issue = resolveIssue(db, input.issueId);
  if (!issue) {
    return { success: false, error: `Issue not found: ${input.issueId}` };
  }

  // Also fetch comments for a complete picture
  const comments = listTrackerComments(db, issue.id);
  return { success: true, data: { ...issue, comments } };
}

export function handleTrackerAddComment(
  db: Database,
  input: { issueId: string; content: string; author?: string }
): TrackerToolResult {
  const issue = resolveIssue(db, input.issueId);
  if (!issue) {
    return { success: false, error: `Issue not found: ${input.issueId}` };
  }

  const comment = createTrackerComment(db, {
    issueId: issue.id,
    content: input.content,
    author: input.author ?? 'assistant',
  });
  return { success: true, data: comment };
}

// ---------------------------------------------------------------------------
// Unified dispatcher — call from MCP server handler or system prompt tool
// ---------------------------------------------------------------------------

export function handleTrackerToolCall(
  db: Database,
  toolName: string,
  input: Record<string, unknown>
): TrackerToolResult {
  switch (toolName) {
    case 'tracker_list_projects':
      return handleTrackerListProjects(db);

    case 'tracker_get_project':
      return handleTrackerGetProject(db, input as { projectId: string });

    case 'tracker_create_issue':
      return handleTrackerCreateIssue(
        db,
        input as Parameters<typeof handleTrackerCreateIssue>[1]
      );

    case 'tracker_update_issue':
      return handleTrackerUpdateIssue(
        db,
        input as Parameters<typeof handleTrackerUpdateIssue>[1]
      );

    case 'tracker_list_issues':
      return handleTrackerListIssues(
        db,
        input as Parameters<typeof handleTrackerListIssues>[1]
      );

    case 'tracker_get_issue':
      return handleTrackerGetIssue(db, input as { issueId: string });

    case 'tracker_add_comment':
      return handleTrackerAddComment(
        db,
        input as { issueId: string; content: string; author?: string }
      );

    default:
      return { success: false, error: `Unknown tracker tool: ${toolName}` };
  }
}

// ---------------------------------------------------------------------------
// System Prompt Fragment
//
// If MCP server integration is not available, the alternative approach is to
// inject this prompt fragment into the agent's system prompt. The agent will
// then use the Bash tool to call the REST API via curl.
// ---------------------------------------------------------------------------

export function buildTrackerSystemPromptFragment(serverUrl: string): string {
  return `
## Tracker Tools

You have access to a project tracker at ${serverUrl}/api/tracker. Use these REST endpoints to manage issues:

### List Projects
\`GET ${serverUrl}/api/tracker/projects\`

### Get Project (with statuses and labels)
\`GET ${serverUrl}/api/tracker/projects/:projectId\`

### Create Issue
\`POST ${serverUrl}/api/tracker/projects/:projectId/issues\`
Body: { "title": "...", "description": "...", "priority": 3, "statusId": "..." }

### Update Issue
\`PATCH ${serverUrl}/api/tracker/issues/:issueId\`
Body: { "title": "...", "statusId": "...", "priority": 2 }

### List Issues
\`GET ${serverUrl}/api/tracker/projects/:projectId/issues?search=...&statusId=...&priority=...\`

### Get Issue Details
\`GET ${serverUrl}/api/tracker/issues/:issueId\`

### Add Comment
\`POST ${serverUrl}/api/tracker/issues/:issueId/comments\`
Body: { "content": "...", "author": "assistant" }

Priority values: 0=none, 1=urgent, 2=high, 3=medium, 4=low
Use curl with -s flag for clean output. Always check project statuses before creating issues.
`.trim();
}

// ---------------------------------------------------------------------------
// Integration Notes
// ---------------------------------------------------------------------------
//
// HOW TO WIRE INTO THE CHAT SYSTEM:
//
// The Claude Agent SDK's `query()` function does not accept raw tool
// definitions. Instead, it supports tools via two mechanisms:
//
// 1. **MCP Servers** (recommended):
//    Agent profiles have an `mcpServersJson` field. To expose tracker tools,
//    create an MCP server that wraps `handleTrackerToolCall()` and add it
//    to the agent profile config. The SDK will then advertise these tools
//    to Claude and route tool_use calls back through the MCP protocol.
//
//    Example mcpServersJson entry:
//    ```json
//    {
//      "tracker": {
//        "command": "node",
//        "args": ["path/to/tracker-mcp-server.js"],
//        "env": {}
//      }
//    }
//    ```
//
// 2. **System Prompt + REST API** (simpler, no MCP required):
//    Inject `buildTrackerSystemPromptFragment(serverUrl)` into the agent's
//    system prompt. The agent will use its built-in Bash tool to call the
//    tracker REST API via curl. This works immediately with zero config
//    but is less structured than MCP.
//
//    To add this to the streaming pipeline, modify `buildStreamExecute()`
//    in chat-streaming.ts to include the tracker prompt fragment in the
//    context blocks:
//
//    ```typescript
//    import { buildTrackerSystemPromptFragment } from '../services/tracker-tools';
//    // In buildStreamExecute, add to promptWithContext:
//    const trackerPrompt = buildTrackerSystemPromptFragment('http://localhost:3131');
//    ```
//
// 3. **Exported constants** for programmatic use:
//    - TRACKER_TOOL_DEFINITIONS: Array of tool schemas
//    - handleTrackerToolCall(db, toolName, input): Unified dispatcher
//    - Individual handlers: handleTrackerCreateIssue, etc.
//
