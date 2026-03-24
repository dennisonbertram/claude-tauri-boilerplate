# Tracker Projects UX Architecture Review

**Date**: March 24, 2026  
**Scope**: Deep dive into the relationship between workspace projects, tracker projects, navigation, and issue linking

---

## Executive Summary

This codebase has **two distinct project systems**:

1. **Workspace Projects** (`projects` table): Git repositories with git worktrees for development/collaboration
2. **Tracker Projects** (`tracker_projects` table): Standalone issue tracking system independent of workspace projects

While tracker_projects includes an optional foreign key to link to workspace projects (`project_id`), this relationship is largely **unused** in the current UI. The two systems operate independently with separate UIs and data models.

---

## 1. Workspace Projects

### What They Are
Workspace projects represent **git repositories** that users can add to the app for collaborative development. They are the entry point to git worktree management.

### Database Schema
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL UNIQUE,
  repo_path_canonical TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL DEFAULT 'main',
  setup_command TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Key Fields:**
- `id`: UUID
- `name`: Display name (e.g., "claude-tauri-boilerplate")
- `repo_path`: User-provided path (may have symlinks)
- `repo_path_canonical`: Normalized absolute path (unique)
- `default_branch`: Default branch (e.g., "main")
- `setup_command`: Optional setup script to run when creating workspaces
- `is_deleted`: Soft delete flag

### TypeScript Types

```typescript
interface Project {
  id: string;
  name: string;
  repoPath: string;
  repoPathCanonical: string;
  defaultBranch: string;
  setupCommand?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  location?: ProjectLocation;
  repoConfig?: WorkspaceRepoConfig;
}
```

### UI Components

**ProjectsSection.tsx** (`src/components/sidebar/ProjectsSection.tsx`)
- Sidebar tree view listing all projects and their workspaces
- Shows expanded/collapsed state for each project
- Displays workspaces beneath each project with status badges
- Allows selection of workspaces to open WorkspacePanel

**ProjectsGridView.tsx** (`src/components/workspaces/ProjectsGridView.tsx`)
- Main workspaces view grid/list display
- Shows all projects with workspace count
- Color-coded project cards
- Search and filter by project name
- Can switch between grid and list view

### Key API Routes
- `GET /api/projects` - List all projects
- `POST /api/projects` - Add a new project (GitHub import or local)
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

---

## 2. Tracker Projects

### What They Are
Tracker projects are **standalone issue tracking containers** (like Linear, Jira, or GitHub Issues) without mandatory connection to workspace projects. They provide:
- Issue management (create, update, move, delete)
- Status/workflow management (Backlog → Todo → In Progress → Done → Cancelled)
- Labels for categorization
- Comments on issues
- Priority levels (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)

### Database Schema

```sql
CREATE TABLE tracker_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  default_assignee TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,  -- ← Optional link to workspace project
  next_issue_number INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tracker_statuses (
  id TEXT PRIMARY KEY,
  tracker_project_id TEXT NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('backlog','todo','in_progress','done','cancelled')),
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tracker_labels (
  id TEXT PRIMARY KEY,
  tracker_project_id TEXT NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT
);

CREATE TABLE tracker_issues (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,  -- e.g., "PROJ-42"
  tracker_project_id TEXT NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status_id TEXT NOT NULL REFERENCES tracker_statuses(id),
  priority INTEGER NOT NULL DEFAULT 3,
  assignee TEXT,
  due_date TEXT,
  sort_order REAL NOT NULL DEFAULT 0,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,  -- ← Optional link to workspace
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,      -- ← Optional link to chat session
  parent_issue_id TEXT REFERENCES tracker_issues(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tracker_comments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES tracker_issues(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Key Fields on tracker_projects:**
- `id`: UUID
- `slug`: Unique identifier for issue numbering (e.g., "myproj" → MYPROJ-1, MYPROJ-2)
- `description`, `icon`, `color`: Customization fields
- `default_assignee`: Default person for new issues
- `project_id`: **Optional** FK to workspace projects table (currently unused in UI)
- `next_issue_number`: Auto-incrementing counter for issue identifiers

**Key Fields on tracker_issues:**
- `identifier`: Human-readable issue key (e.g., "PROJ-42") - unique across all projects
- `workspace_id`: **Optional** link to a workspace in the `workspaces` table
- `session_id`: **Optional** link to a chat session in the `sessions` table
- `parent_issue_id`: Supports issue hierarchies/subtasks

### TypeScript Types

```typescript
interface TrackerProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  defaultAssignee: string | null;
  projectId: string | null;  // Optional link to workspace project
  nextIssueNumber: number;
  createdAt: string;
  updatedAt: string;
}

interface TrackerStatus {
  id: string;
  trackerProjectId: string;
  name: string;
  category: 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';
  color: string | null;
  sortOrder: number;
}

interface TrackerLabel {
  id: string;
  trackerProjectId: string;
  name: string;
  color: string | null;
}

interface TrackerIssue {
  id: string;
  identifier: string;  // e.g., "PROJ-42"
  trackerProjectId: string;
  title: string;
  description: string | null;
  statusId: string;
  priority: 0 | 1 | 2 | 3 | 4;
  assignee: string | null;
  dueDate: string | null;
  sortOrder: number;
  workspaceId: string | null;  // Optional link to workspace
  sessionId: string | null;    // Optional link to chat session
  parentIssueId: string | null;
  createdAt: string;
  updatedAt: string;
  status?: TrackerStatus;      // Joined data
  labels?: TrackerLabel[];     // Joined data
}

interface TrackerProjectWithDetails extends TrackerProject {
  statuses: TrackerStatus[];
  labels: TrackerLabel[];
}
```

### UI Components

**TrackerView.tsx** (`src/components/tracker/TrackerView.tsx`)
- Main tracker interface
- Project selector dropdown (auto-selects first project)
- Toggle between Kanban board and list view
- Filter issues by search, category, priority, assignee
- Create new issues or projects
- Shows no projects message with CTA to create project

**Supporting Components:**
- `KanbanBoard.tsx` - Kanban board with drag-and-drop columns by status
- `IssueListView.tsx` - Table/list view of issues
- `IssueDetailPanel.tsx` - Side panel to view/edit issue details
- `CreateIssueDialog.tsx` - Dialog to create new issue
- `IssueCard.tsx` - Individual issue card display
- `TrackerFilters.tsx` - Filter controls (search, priority, assignee, category)
- `KanbanColumn.tsx` - Individual kanban column

### Key API Routes
- `GET /api/tracker/projects` - List all tracker projects
- `POST /api/tracker/projects` - Create tracker project
- `GET /api/tracker/projects/:id` - Get project with statuses and labels
- `PATCH /api/tracker/projects/:id` - Update project
- `DELETE /api/tracker/projects/:id` - Delete project
- `GET /api/tracker/projects/:projectId/issues` - List issues for project (with optional filters)
- `POST /api/tracker/projects/:projectId/issues` - Create issue
- `GET /api/tracker/issues/:id` - Get issue details
- `PATCH /api/tracker/issues/:id` - Update issue
- `PATCH /api/tracker/issues/:id/move` - Move issue to different status/column
- `DELETE /api/tracker/issues/:id` - Delete issue
- `POST /api/tracker/issues/:id/comments` - Add comment to issue

---

## 3. Navigation Structure

### Main Routes (src/lib/routes.ts)

```typescript
export const routes = {
  chat: (sessionId?: string) => (sessionId ? `/chat/${sessionId}` : '/chat'),
  workspaces: (projectId?: string) => projectId ? `/workspaces/${projectId}` : '/workspaces',
  teams: (teamId?: string) => (teamId ? `/teams/${teamId}` : '/teams'),
  agents: (profileId?: string) => profileId ? `/agents/${profileId}` : '/agents',
  documents: '/documents',
  tracker: '/tracker',  // ← No project ID in URL
} as const;

export type ActiveView = 'chat' | 'teams' | 'workspaces' | 'agents' | 'documents' | 'tracker';
```

### Active Views (src/App.tsx)

The main `AppLayout` component renders different views based on `activeView`:

- **'chat'**: ChatPage (active AI session or welcome screen)
- **'workspaces'**: ProjectsGridView (showing all projects) OR WorkspacePanel (editing a specific workspace)
- **'agents'**: AgentBuilderView
- **'documents'**: DocumentsView
- **'teams'**: TeamsView
- **'tracker'**: TrackerView (project selector dropdown in header, then issues)

### Sidebar Navigation (AppSidebar.tsx, src/components/AppSidebar.tsx)

**Navigation Items (top):**
```javascript
const navItems = [
  { view: 'documents', icon: FileText, label: 'Documents' },
  { view: 'workspaces', icon: FolderOpen, label: 'Projects' },  // ← Git projects
  { view: 'agents', icon: Robot, label: 'Agent Profiles' },
  { view: 'teams', icon: UsersThree, label: 'Teams' },
];
```

**Note:** There is **no nav item for Tracker** in the main nav. Tracker is accessible via the main view switcher but not listed in the primary nav items array.

**Session List:** Shows chat sessions grouped by date with search.

**Projects Section (inline):** Displays project tree with workspaces (only in workspaces view).

### View Switcher Header (src/app/ViewSwitcherHeader.tsx)

Shows the current view name and allows switching between views (chat, workspaces, tracker, teams, agents, documents).

---

## 4. WorkspacePanelTabs Structure

Located in `src/components/workspaces/WorkspacePanelTabs.tsx`

```typescript
type Tab = 'chat' | 'diff' | 'paths' | 'notes' | 'dashboards';

interface WorkspacePanelTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}
```

**Available Tabs:**
1. **Chat** - Claude conversation for the workspace
2. **Diff** - View code changes in the workspace
3. **Paths** - File/directory browser
4. **Notes** - Workspace notes/documentation
5. **Dashboards** - Visual dashboards (artifacts/dashboard specs)

**Note:** There is **no Tracker tab** in the workspace panel. Issues are managed separately in the dedicated Tracker view.

---

## 5. Relationship: tracker_projects.project_id ↔ workspace projects

### Current State

The foreign key exists:
```sql
project_id TEXT REFERENCES projects(id) ON DELETE SET NULL
```

**Status: Exists but largely unused**

### Where It's Used

**In database layer (db-tracker.ts):**
- `createTrackerProject()` accepts optional `projectId` parameter
- `updateTrackerProject()` can update the `projectId`
- The field is returned in API responses

**In API layer (routes/tracker.ts):**
- Creation schema accepts optional `projectId`
- Update schema does not include `projectId` (cannot change after creation)

**In UI layer:**
- **NOT used in TrackerView** - Projects are selected independently; no workspace context
- **NOT available in create project dialog** - No option to link to a workspace project

### Potential Use Cases (Not Yet Implemented)

This field could enable:
- Filtering tracker projects by workspace project
- Creating issues from workspace code changes
- Cross-linking workspace PRs with tracker issues
- Limiting tracker project visibility to specific workspace project members

---

## 6. Linking Issues to Workspaces/Sessions

### tracker_issues Table Fields

```sql
workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
```

### Current Usage

**In TypeScript types** (shared/types.ts):
```typescript
interface TrackerIssue {
  workspaceId: string | null;
  sessionId: string | null;
  ...
}
```

**In db-tracker.ts:**
- Both fields can be set when creating an issue via `createTrackerIssue()`
- Both fields can be updated via `updateTrackerIssue()`
- Both are optional (nullable)

**In routes/tracker.ts:**
- `createIssueSchema` accepts optional `workspaceId` and `sessionId`
- `updateIssueSchema` accepts optional `workspaceId` and `sessionId`

**In UI** (TrackerView, CreateIssueDialog):
- No UI to set or display `workspace_id` or `session_id`
- Issues are created without context about where they came from
- Workspace/session linkage is **metadata only** at present

### Potential Use Cases

These fields could enable:
- Showing which workspace/branch an issue is being worked on
- Creating issues from a chat session context
- Displaying related issues in a workspace
- Tracking issue progress alongside workspace status
- Batch operations on issues related to a workspace

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         App Navigation                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AppSidebar (nav items)                                         │
│  ├── Documents                                                  │
│  ├── Projects (Workspaces)  ←─────────────────┐                │
│  ├── Agent Profiles                           │                │
│  └── Teams                                    │                │
│                                               │                │
│  Sessions (chat history)                      │                │
│  └── [Session Items]                          │                │
│                                               │                │
│  Projects Section (when in workspaces)        │                │
│  ├── Project 1                                │                │
│  │   ├── Workspace A                          │                │
│  │   ├── Workspace B                          │                │
│  │   └── ...                                  │                │
│  └── ...                                      │                │
│                                               │                │
└───────────────────────────────────────────────┼────────────────┘
                                                │
                                    (Navigation to workspaces view)
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│            WORKSPACES VIEW                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ProjectsGridView (all projects)                                │
│  ├── [Project Card 1] (4 workspaces)                            │
│  ├── [Project Card 2] (2 workspaces)                            │
│  └── [Project Card 3] (0 workspaces)                            │
│                                                                 │
│  OR                                                             │
│                                                                 │
│  WorkspacePanel (selected workspace)                            │
│  ├── WorkspacePanelTabs                                         │
│  │   ├── Chat                                                   │
│  │   ├── Diff                                                   │
│  │   ├── Paths                                                  │
│  │   ├── Notes                                                  │
│  │   └── Dashboards                                             │
│  └── [Tab Content]                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│            TRACKER VIEW (Standalone)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Header                                                         │
│  ├── Project Selector Dropdown (all tracker projects)           │
│  │   └── Auto-selects first project                            │
│  ├── View Mode Toggle (Kanban/List)                            │
│  └── + Create Issue / + Create Project Buttons                 │
│                                                                 │
│  Filters (if project selected)                                  │
│  ├── Search issues                                              │
│  ├── Filter by category                                         │
│  ├── Filter by priority                                         │
│  └── Filter by assignee                                         │
│                                                                 │
│  Content Area                                                   │
│  ├── Kanban Board (if no project: "Create your first project") │
│  │   ├── [Backlog] Column                                       │
│  │   ├── [Todo] Column                                          │
│  │   ├── [In Progress] Column                                   │
│  │   ├── [Done] Column                                          │
│  │   └── [Cancelled] Column                                     │
│  │       └── [Issue Cards] (draggable)                          │
│  │                                                               │
│  └── OR List View                                               │
│      └── [Issue Rows] (sortable by status, then by order)      │
│                                                                 │
│  Side Panels                                                    │
│  ├── IssueDetailPanel (click issue to view/edit)               │
│  │   ├── Title, description, status                            │
│  │   ├── Priority, assignee, due date                          │
│  │   ├── Labels, comments                                      │
│  │   └── Parent issue (if subtask)                             │
│  │                                                               │
│  └── CreateIssueDialog (+ Issue button)                         │
│      ├── Title (required)                                       │
│      ├── Description, status, priority                          │
│      ├── Assignee, labels, due date                            │
│      └── Parent issue (for subtasks)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

NOTE: NO DIRECT CONNECTION between workspace projects and tracker
      in the UI. They are two separate, independent systems.

      tracker_issues.workspace_id and tracker_issues.session_id
      are metadata fields that are not currently exposed in the UI.
```

---

## 8. Key Observations & Findings

### ✅ Strengths
1. **Clean separation of concerns**: Git projects and issue tracking are distinct systems
2. **Type safety**: Well-defined TypeScript interfaces for both systems
3. **Flexible linking**: `workspace_id` and `session_id` on tracker_issues allows future integration
4. **Extensible tracker schema**: Default statuses, labels, priorities all configurable
5. **Independent scale**: Tracker can grow without affecting workspace projects

### ⚠️ Gaps & Opportunities

1. **Unused foreign key**: `tracker_projects.project_id` exists but isn't used in UI or API
   - Could enable workspace-scoped tracker views
   - Could auto-link issues to workspace context

2. **No issue-workspace linkage in UI**: Despite `workspace_id` field, no UI to:
   - Set workspace when creating issue
   - Display which workspace an issue relates to
   - Browse issues by workspace

3. **No tracker nav item**: Tracker accessible only via view switcher, not sidebar nav
   - Could add dedicated sidebar section for tracker projects
   - Could show quick access to recent/pinned projects

4. **No workspace-tracker integration**: They operate completely independently
   - Could show related issues in workspace panel
   - Could create issues from workspace context
   - Could link PRs to tracker issues

5. **Session linkage unexposed**: `session_id` field exists but never set or displayed
   - Could show which chat session an issue was created from
   - Could link code generation to tracker context

---

## 9. File Locations Summary

### Database & API
- `/apps/server/src/db/schema.ts` - Main schema definition
- `/apps/server/src/db/migrations.ts` - Tracker migration with table creation
- `/apps/server/src/db/db-tracker.ts` - Tracker database functions
- `/apps/server/src/routes/tracker.ts` - Tracker API routes

### Shared Types
- `/packages/shared/src/types.ts` - All TypeScript interfaces

### Workspace Projects UI
- `/apps/desktop/src/components/sidebar/ProjectsSection.tsx` - Sidebar project tree
- `/apps/desktop/src/components/workspaces/ProjectsGridView.tsx` - Main projects grid
- `/apps/desktop/src/components/workspaces/WorkspacePanel.tsx` - Selected workspace view
- `/apps/desktop/src/components/workspaces/WorkspacePanelTabs.tsx` - Workspace tabs (chat/diff/paths/notes/dashboards)

### Tracker UI
- `/apps/desktop/src/components/tracker/TrackerView.tsx` - Main tracker container
- `/apps/desktop/src/components/tracker/KanbanBoard.tsx` - Kanban board view
- `/apps/desktop/src/components/tracker/IssueListView.tsx` - List view
- `/apps/desktop/src/components/tracker/IssueDetailPanel.tsx` - Issue detail side panel
- `/apps/desktop/src/components/tracker/CreateIssueDialog.tsx` - Issue creation dialog
- `/apps/desktop/src/components/tracker/KanbanColumn.tsx` - Individual column
- `/apps/desktop/src/components/tracker/IssueCard.tsx` - Issue card display
- `/apps/desktop/src/components/tracker/TrackerFilters.tsx` - Filter controls

### Navigation & Hooks
- `/apps/desktop/src/App.tsx` - Main app with routes and state
- `/apps/desktop/src/components/AppSidebar.tsx` - Main sidebar navigation
- `/apps/desktop/src/lib/routes.ts` - Route definitions
- `/apps/desktop/src/hooks/useTracker.ts` - Tracker data hooks
- `/apps/desktop/src/hooks/useProjects.ts` - Workspace projects hooks

---

## 10. Conclusion

The codebase implements **two independent project systems**:

1. **Workspace Projects** - Git-centric, for collaborative development with git worktrees
2. **Tracker Projects** - Issue-centric, for task and workflow management

They can optionally reference each other via `tracker_projects.project_id`, but this relationship is not currently leveraged in the UI or business logic. Issues can optionally link to workspaces and chat sessions via `tracker_issues.workspace_id` and `tracker_issues.session_id`, but these linkages are also unexposed in the current UI.

Future enhancements could integrate these systems more deeply by:
- Exposing the workspace/project linkage in the tracker UI
- Adding a tracker sidebar section
- Creating issues from workspace context
- Displaying related issues in workspace panels
- Implementing workspace-scoped tracker views
