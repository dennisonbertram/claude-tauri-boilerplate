# Todoist Connector Research

**Issue**: #379
**Date**: 2026-03-25
**Status**: Research complete

---

## 1. Executive Summary

Todoist is the strongest candidate for a task management connector. It has the best API in the category (REST + Sync), an official TypeScript SDK (`@doist/todoist-api-typescript`), and Doist themselves maintain an official MCP server package (`@doist/todoist-ai`). The connector should use the new **Todoist API v1** (not the deprecated REST v2), support OAuth 2.0 for multi-user auth, and expose 8-10 tools covering task CRUD, project management, labels, and search/filter. The existing weather connector pattern (tools.ts / api.ts / index.ts / test) maps cleanly to this use case.

---

## 2. API Overview

### Todoist API v1 (current, recommended)

The REST v2 API is deprecated. The new unified **Todoist API v1** at `https://developer.todoist.com/api/v1/` consolidates REST and Sync endpoints.

**Core resources:**

| Resource   | Endpoints                                      | Notes                                   |
|------------|-------------------------------------------------|-----------------------------------------|
| Tasks      | GET/POST/PATCH/DELETE `/tasks`                  | CRUD, quick-add with natural language   |
| Projects   | GET/POST/PATCH/DELETE `/projects`               | Hierarchical, colors, favorites         |
| Sections   | GET/POST/PATCH/DELETE `/sections`               | Organize tasks within projects          |
| Labels     | GET/POST/PATCH/DELETE `/labels`                 | Personal labels, attach to tasks        |
| Comments   | GET/POST/PATCH/DELETE `/comments`               | On tasks or projects, supports files    |

### Sync API v9

Available at `https://developer.todoist.com/sync/v9/`. Uses `sync_token` for incremental state sync:

- **Full sync**: `sync_token='*'` returns entire account state
- **Incremental sync**: subsequent calls with returned `sync_token` get only changes
- Supports batched writes (multiple commands in one request)
- Used by official mobile/web clients for offline-first architecture

**For our connector, REST (API v1) is sufficient.** Sync API is only needed if we want offline caching or real-time state tracking, which is out of scope for an MCP tool-based connector.

### Rate Limits

- **1,000 requests per user per 15-minute window**
- Community implementations often use a conservative 450 req/60s limit
- No per-endpoint rate limits documented; it is a global user-level limit
- Rate limit headers are returned in responses

---

## 3. Authentication

### OAuth 2.0 Flow

1. Register app at Todoist App Management Console
2. Redirect user to `https://api.todoist.com/oauth/authorize` with `client_id`, `scope`, `state`
3. User grants access, redirected back with `code` and `state`
4. Exchange `code` for access token via POST to `https://api.todoist.com/oauth/access_token`

**Scopes** (comma-separated, not space-separated -- Todoist deviates from OAuth standard):
- `data:read` -- read-only access
- `data:read_write` -- read and write
- `data:delete` -- delete permission
- `task:add` -- add tasks only
- `project:delete` -- delete projects

**Recommended scope for our connector**: `data:read_write,data:delete`

### Personal API Token

Users can also use a personal API token (found in Todoist Settings > Integrations > Developer). This is simpler for single-user desktop app use. Token is sent as `Authorization: Bearer <token>` header.

### Implementation recommendation

Support both:
1. **Personal API token** for quick setup (like the weather connector's no-auth pattern, but with a stored token)
2. **OAuth 2.0** for production multi-user flows (requires `requiresAuth: true` in ConnectorDefinition)

---

## 4. Existing MCP Server Implementations

### Official: `@doist/todoist-ai` (npm)

- **Package**: `@doist/todoist-ai` v5.2.0
- **Repo**: https://github.com/Doist/todoist-ai
- **Status**: Actively maintained by Doist; the older `Doist/todoist-mcp` repo is deprecated in favor of this
- **Architecture**: Provides MCP tools that can be used standalone or via a hosted MCP server at `https://ai.todoist.net/mcp`
- **Key insight**: Tools can be imported directly rather than running as an external MCP server, which aligns perfectly with our in-process connector pattern

### Community implementations

| Repository | Stars | Notes |
|---|---|---|
| `abhiz123/todoist-mcp-server` | Popular | Natural language task management, smart search, flexible filtering |
| `greirson/mcp-todoist` | Active | Bulk operations, project management |
| `ecfaria/todoist-mcp` | Moderate | Task and project management |
| `mingolladaniele/taskMaster-todoist-mcp` | Newer | Lightweight, IDE-focused |
| `stanislavlysenko0912/todoist-mcp-server` | Listed on PulseMCP | Full CRUD |

### Design decision

We should **not** depend on `@doist/todoist-ai` directly because:
1. Our connector pattern uses `@anthropic-ai/claude-agent-sdk`'s `tool()` function, not external MCP server tools
2. We want full control over tool schemas and error handling
3. The official TypeScript SDK (`@doist/todoist-api-typescript`) is the right dependency for API calls

However, we should study `@doist/todoist-ai`'s tool definitions for best-practice tool naming and parameter design.

---

## 5. Official TypeScript SDK

### `@doist/todoist-api-typescript`

- **npm**: https://www.npmjs.com/package/@doist/todoist-api-typescript
- **Docs**: https://doist.github.io/todoist-api-typescript/
- **Version**: 5.x (aligned with API v1; v4.x was the migration release)

**Usage:**
```typescript
import { TodoistApi } from '@doist/todoist-api-typescript'

const api = new TodoistApi('API_TOKEN')

// Tasks
const tasks = await api.getTasks({ projectId: '...' })
const task = await api.addTask({ content: 'Buy groceries', dueString: 'tomorrow at 3pm', priority: 4 })
await api.updateTask('taskId', { content: 'Updated content' })
await api.closeTask('taskId')  // complete
await api.deleteTask('taskId')

// Projects
const projects = await api.getProjects()
const project = await api.addProject({ name: 'Work' })

// Labels, Sections, Comments follow same pattern
```

**Key features:**
- Full TypeScript types for all request/response objects
- Built-in error handling with specific error types
- Handles auth header injection
- Supports quick-add natural language syntax via `dueString`

**Recommendation**: Use this SDK in `api.ts` rather than raw fetch calls. It handles auth, types, and error handling out of the box.

---

## 6. Proposed Tool Definitions

Based on analysis of existing MCP implementations and the weather connector pattern:

### Core tools (Phase 1)

| Tool Name | Description | Read/Write | Annotations |
|---|---|---|---|
| `todoist_list_tasks` | List tasks with optional filters (project, label, priority, due date) | Read | `readOnlyHint: true` |
| `todoist_get_task` | Get a single task by ID with full details | Read | `readOnlyHint: true` |
| `todoist_create_task` | Create a task with content, due date, priority, project, labels | Write | `readOnlyHint: false` |
| `todoist_update_task` | Update task properties | Write | `readOnlyHint: false` |
| `todoist_complete_task` | Mark a task as complete | Write | `readOnlyHint: false` |
| `todoist_delete_task` | Delete a task | Write | `destructiveHint: true` |
| `todoist_list_projects` | List all projects | Read | `readOnlyHint: true` |
| `todoist_search_tasks` | Search tasks using Todoist filter syntax | Read | `readOnlyHint: true` |

### Extended tools (Phase 2)

| Tool Name | Description |
|---|---|
| `todoist_create_project` | Create a new project |
| `todoist_list_sections` | List sections in a project |
| `todoist_create_section` | Create a section |
| `todoist_add_comment` | Add a comment to a task |
| `todoist_list_labels` | List all labels |
| `todoist_move_task` | Move task to different project/section |

### Tool parameter design

```typescript
// Example: todoist_create_task
{
  content: z.string().describe('Task content/title'),
  description: z.string().optional().describe('Detailed description'),
  due_string: z.string().optional().describe('Natural language due date, e.g. "tomorrow at 3pm", "every Monday"'),
  priority: z.number().min(1).max(4).optional().describe('Priority 1 (normal) to 4 (urgent)'),
  project_id: z.string().optional().describe('Project ID to add task to'),
  labels: z.array(z.string()).optional().describe('Label names to apply'),
  section_id: z.string().optional().describe('Section ID within the project'),
}
```

**Priority mapping note**: Todoist's API uses 1=normal, 4=urgent. The UI shows this inverted (p1=urgent). The tool description should clarify this to avoid confusion.

---

## 7. Edge Cases and Best Practices

### Recurring tasks
- Completing a recurring task via `closeTask()` creates the next occurrence automatically
- The `due` object has `is_recurring: boolean` and `string` (human-readable recurrence like "every Monday")
- Deleting a recurring task removes all future occurrences
- Tool descriptions should warn users about this behavior

### Natural language date parsing
- Todoist's `due_string` parameter supports rich natural language: "tomorrow", "next Monday at 2pm", "every weekday", "Jan 15", "in 3 days"
- This is handled server-side by Todoist -- no client-side parsing needed
- The `due_date` (YYYY-MM-DD) and `due_datetime` (RFC3339) fields are alternatives for programmatic use

### Filter syntax for search
- Todoist has a powerful filter language: `priority 1 & due before: tomorrow`, `@label & #project`, `assigned to: me`
- Exposing this via `todoist_search_tasks` gives power users flexible querying
- Document common filter patterns in the tool description

### Error handling
- 401: Invalid/expired token -- prompt re-auth
- 403: Insufficient scope
- 404: Resource not found (task deleted, wrong ID)
- 429: Rate limited -- back off and retry
- 5xx: Todoist service issues -- return user-friendly error

---

## 8. Alternatives Comparison

| Feature | Todoist | Things 3 | TickTick | Microsoft To Do |
|---|---|---|---|---|
| **API quality** | Excellent (REST + Sync + SDK) | Poor (AppleScript only, macOS-only) | Moderate (OpenAPI at developer.ticktick.com) | Good (Microsoft Graph API) |
| **TypeScript SDK** | Official (`@doist/todoist-api-typescript`) | None | None official | `@microsoft/microsoft-graph-client` |
| **Cross-platform** | Yes (web API) | macOS/iOS only | Yes (web API) | Yes (Graph API) |
| **OAuth support** | Yes | No | Yes (OAuth 2.0) | Yes (Azure AD/MSAL) |
| **MCP servers** | Official + 5+ community | None found | None found | Community only |
| **Rate limits** | 1000/15min | N/A | Not documented | Graph API throttling |
| **Natural language dates** | Built-in server-side | Via URL scheme only | Limited | No |
| **Recurring tasks** | Full API support | AppleScript only | API support | API support |
| **Auth complexity** | Low (simple OAuth + personal token) | N/A | Moderate | High (Azure AD tenant setup) |
| **Free tier** | Yes (5 projects, unlimited tasks) | $49.99 one-time | Free tier available | Free with Microsoft account |

**Verdict**: Todoist is the clear winner for a first task management connector. Things 3 is macOS-only with no real API. TickTick has an API but no SDK or MCP ecosystem. Microsoft To Do requires Azure AD setup which is heavy for a desktop app.

---

## 9. Testing Strategy

Following the existing weather connector test pattern (`bun:test`, mock fetch, test data factories):

### Unit tests (`todoist.test.ts`)

```
describe('Todoist API')
  describe('listTasks')
    - returns formatted task list
    - filters by project ID
    - filters by priority
    - handles empty result set
    - handles API error (401, 429, 500)

  describe('createTask')
    - creates task with all fields
    - creates task with natural language due date
    - creates recurring task
    - handles validation errors
    - handles rate limiting (429)

  describe('completeTask')
    - completes a regular task
    - completes a recurring task (verify next occurrence behavior)
    - handles already-completed task
    - handles nonexistent task (404)

  describe('searchTasks')
    - searches with filter syntax
    - handles invalid filter string
    - returns empty results

  describe('projects')
    - lists all projects
    - creates a project
```

### Mock strategy

Mock `@doist/todoist-api-typescript`'s `TodoistApi` class methods rather than raw fetch. This gives better type safety and tests our api.ts wrapper logic, not the SDK internals.

Alternatively, mock at the fetch level (like weather connector) if we use raw API calls instead of the SDK.

### Edge case tests (recurring tasks)

```typescript
test('completing recurring task returns next occurrence', async () => {
  // Mock closeTask to return success
  // Mock subsequent getTask to show updated due date
  // Verify the task is not marked as completed but has a new due date
})

test('deleting recurring task removes it entirely', async () => {
  // Mock deleteTask
  // Verify task is gone, not rescheduled
})
```

---

## 10. Implementation Plan

### File structure

```
apps/server/src/connectors/todoist/
  index.ts       -- ConnectorDefinition export
  api.ts         -- TodoistApi wrapper (handles auth, error normalization)
  tools.ts       -- Tool definitions using SDK tool() function
  todoist.test.ts -- Tests with mocked API
```

### Phase 1 (MVP)

1. Add `@doist/todoist-api-typescript` dependency
2. Implement `api.ts` with wrapper functions around the SDK
3. Implement 8 core tools in `tools.ts`
4. Register connector in `apps/server/src/connectors/index.ts`
5. Write tests for all tools
6. Add auth token storage (personal API token first, OAuth later)

### Phase 2 (Extended)

1. OAuth 2.0 flow integration with Tauri deep links
2. Extended tools (comments, sections, labels CRUD)
3. Rate limit handling with exponential backoff
4. Todoist filter syntax documentation in tool descriptions

### Estimated effort

- Phase 1: ~4-6 hours (following weather connector pattern closely)
- Phase 2: ~3-4 hours (OAuth flow is the main complexity)

---

## Sources

- [Todoist API v1 Documentation](https://developer.todoist.com/api/v1/)
- [Todoist Sync API v9 Reference](https://developer.todoist.com/sync/v9/)
- [Todoist Developer Guides](https://developer.todoist.com/guides/)
- [@doist/todoist-api-typescript SDK](https://doist.github.io/todoist-api-typescript/)
- [@doist/todoist-api-typescript on npm](https://www.npmjs.com/package/@doist/todoist-api-typescript)
- [Doist/todoist-ai (official MCP server)](https://github.com/Doist/todoist-ai)
- [@doist/todoist-ai on npm](https://www.npmjs.com/package/@doist/todoist-ai)
- [abhiz123/todoist-mcp-server](https://github.com/abhiz123/todoist-mcp-server)
- [greirson/mcp-todoist](https://github.com/greirson/mcp-todoist)
- [TickTick Developer Portal](https://developer.ticktick.com/)
- [Microsoft To Do Graph API](https://learn.microsoft.com/en-us/graph/api/resources/todo-overview?view=graph-rest-1.0)
- [Todoist OAuth Authorization](https://doist.github.io/todoist-api-typescript/authorization/)
