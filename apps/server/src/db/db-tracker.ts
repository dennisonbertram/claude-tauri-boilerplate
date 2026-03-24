import { Database } from 'bun:sqlite';

// ─── Row interfaces (snake_case, matching DB columns) ────────────────────────

interface TrackerProjectRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  default_assignee: string | null;
  project_id: string | null;
  next_issue_number: number;
  created_at: string;
  updated_at: string;
}

interface TrackerStatusRow {
  id: string;
  tracker_project_id: string;
  name: string;
  category: string;
  color: string | null;
  sort_order: number;
}

interface TrackerLabelRow {
  id: string;
  tracker_project_id: string;
  name: string;
  color: string | null;
}

interface TrackerIssueRow {
  id: string;
  identifier: string;
  tracker_project_id: string;
  title: string;
  description: string | null;
  status_id: string;
  priority: number;
  assignee: string | null;
  due_date: string | null;
  sort_order: number;
  workspace_id: string | null;
  session_id: string | null;
  parent_issue_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackerIssueWithStatusRow extends TrackerIssueRow {
  status_name: string;
  status_category: string;
  status_color: string | null;
}

interface TrackerCommentRow {
  id: string;
  issue_id: string;
  author: string;
  content: string;
  created_at: string;
}

// ─── Map functions (snake_case -> camelCase) ─────────────────────────────────

function mapTrackerProject(row: TrackerProjectRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    color: row.color,
    defaultAssignee: row.default_assignee,
    projectId: row.project_id,
    nextIssueNumber: row.next_issue_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrackerStatus(row: TrackerStatusRow) {
  return {
    id: row.id,
    trackerProjectId: row.tracker_project_id,
    name: row.name,
    category: row.category,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

function mapTrackerLabel(row: TrackerLabelRow) {
  return {
    id: row.id,
    trackerProjectId: row.tracker_project_id,
    name: row.name,
    color: row.color,
  };
}

function mapTrackerIssue(row: TrackerIssueRow) {
  return {
    id: row.id,
    identifier: row.identifier,
    trackerProjectId: row.tracker_project_id,
    title: row.title,
    description: row.description,
    statusId: row.status_id,
    priority: row.priority,
    assignee: row.assignee,
    dueDate: row.due_date,
    sortOrder: row.sort_order,
    workspaceId: row.workspace_id,
    sessionId: row.session_id,
    parentIssueId: row.parent_issue_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrackerIssueWithStatus(row: TrackerIssueWithStatusRow) {
  return {
    ...mapTrackerIssue(row),
    status: {
      id: row.status_id,
      name: row.status_name,
      category: row.status_category,
      color: row.status_color,
    },
  };
}

function mapTrackerComment(row: TrackerCommentRow) {
  return {
    id: row.id,
    issueId: row.issue_id,
    author: row.author,
    content: row.content,
    createdAt: row.created_at,
  };
}

// ─── Tracker Projects ────────────────────────────────────────────────────────

const DEFAULT_STATUSES = [
  { name: 'Backlog', category: 'backlog', sortOrder: 0 },
  { name: 'Todo', category: 'todo', sortOrder: 1 },
  { name: 'In Progress', category: 'in_progress', sortOrder: 2 },
  { name: 'Done', category: 'done', sortOrder: 3 },
  { name: 'Cancelled', category: 'cancelled', sortOrder: 4 },
] as const;

export function createTrackerProject(
  db: Database,
  data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
    defaultAssignee?: string;
    projectId?: string;
  },
) {
  const id = crypto.randomUUID();
  const stmt = db.prepare(
    `INSERT INTO tracker_projects (id, name, slug, description, icon, color, default_assignee, project_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  );
  const row = stmt.get(
    id,
    data.name,
    data.slug,
    data.description ?? null,
    data.icon ?? null,
    data.color ?? null,
    data.defaultAssignee ?? null,
    data.projectId ?? null,
  ) as TrackerProjectRow;

  // Insert default statuses
  const statusStmt = db.prepare(
    `INSERT INTO tracker_statuses (id, tracker_project_id, name, category, sort_order) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const s of DEFAULT_STATUSES) {
    statusStmt.run(crypto.randomUUID(), id, s.name, s.category, s.sortOrder);
  }

  return mapTrackerProject(row);
}

export function listTrackerProjects(db: Database) {
  const rows = db.prepare(`SELECT * FROM tracker_projects ORDER BY created_at DESC`).all() as TrackerProjectRow[];
  return rows.map(mapTrackerProject);
}

export function getTrackerProject(db: Database, id: string) {
  const row = db.prepare(`SELECT * FROM tracker_projects WHERE id = ?`).get(id) as TrackerProjectRow | null;
  return row ? mapTrackerProject(row) : null;
}

export function getTrackerProjectBySlug(db: Database, slug: string) {
  const row = db.prepare(`SELECT * FROM tracker_projects WHERE slug = ?`).get(slug) as TrackerProjectRow | null;
  return row ? mapTrackerProject(row) : null;
}

export function getTrackerProjectWithDetails(db: Database, id: string) {
  const project = getTrackerProject(db, id);
  if (!project) return null;

  const statuses = listTrackerStatuses(db, id);
  const labels = listTrackerLabels(db, id);

  return { ...project, statuses, labels };
}

export function updateTrackerProject(
  db: Database,
  id: string,
  updates: {
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
    defaultAssignee?: string | null;
    projectId?: string | null;
  },
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.slug !== undefined) {
    setClauses.push('slug = ?');
    values.push(updates.slug);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.icon !== undefined) {
    setClauses.push('icon = ?');
    values.push(updates.icon);
  }
  if (updates.color !== undefined) {
    setClauses.push('color = ?');
    values.push(updates.color);
  }
  if (updates.defaultAssignee !== undefined) {
    setClauses.push('default_assignee = ?');
    values.push(updates.defaultAssignee);
  }
  if (updates.projectId !== undefined) {
    setClauses.push('project_id = ?');
    values.push(updates.projectId);
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tracker_projects SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteTrackerProject(db: Database, id: string) {
  db.prepare(`DELETE FROM tracker_projects WHERE id = ?`).run(id);
}

// ─── Statuses ────────────────────────────────────────────────────────────────

export function listTrackerStatuses(db: Database, projectId: string) {
  const rows = db
    .prepare(`SELECT * FROM tracker_statuses WHERE tracker_project_id = ? ORDER BY sort_order`)
    .all(projectId) as TrackerStatusRow[];
  return rows.map(mapTrackerStatus);
}

export function createTrackerStatus(
  db: Database,
  data: {
    trackerProjectId: string;
    name: string;
    category: string;
    color?: string;
    sortOrder?: number;
  },
) {
  const id = crypto.randomUUID();
  const row = db
    .prepare(
      `INSERT INTO tracker_statuses (id, tracker_project_id, name, category, color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .get(id, data.trackerProjectId, data.name, data.category, data.color ?? null, data.sortOrder ?? 0) as TrackerStatusRow;
  return mapTrackerStatus(row);
}

export function updateTrackerStatus(
  db: Database,
  id: string,
  updates: { name?: string; category?: string; color?: string; sortOrder?: number },
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.category !== undefined) {
    setClauses.push('category = ?');
    values.push(updates.category);
  }
  if (updates.color !== undefined) {
    setClauses.push('color = ?');
    values.push(updates.color);
  }
  if (updates.sortOrder !== undefined) {
    setClauses.push('sort_order = ?');
    values.push(updates.sortOrder);
  }

  if (setClauses.length === 0) return;
  values.push(id);

  db.prepare(`UPDATE tracker_statuses SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteTrackerStatus(db: Database, id: string) {
  db.prepare(`DELETE FROM tracker_statuses WHERE id = ?`).run(id);
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export function listTrackerLabels(db: Database, projectId: string) {
  const rows = db
    .prepare(`SELECT * FROM tracker_labels WHERE tracker_project_id = ? ORDER BY name`)
    .all(projectId) as TrackerLabelRow[];
  return rows.map(mapTrackerLabel);
}

export function createTrackerLabel(
  db: Database,
  data: { trackerProjectId: string; name: string; color?: string },
) {
  const id = crypto.randomUUID();
  const row = db
    .prepare(
      `INSERT INTO tracker_labels (id, tracker_project_id, name, color)
       VALUES (?, ?, ?, ?) RETURNING *`,
    )
    .get(id, data.trackerProjectId, data.name, data.color ?? null) as TrackerLabelRow;
  return mapTrackerLabel(row);
}

export function deleteTrackerLabel(db: Database, id: string) {
  db.prepare(`DELETE FROM tracker_labels WHERE id = ?`).run(id);
}

// ─── Issues ──────────────────────────────────────────────────────────────────

export function createTrackerIssue(
  db: Database,
  data: {
    trackerProjectId: string;
    title: string;
    description?: string;
    statusId: string;
    priority?: number;
    assignee?: string;
    dueDate?: string;
    sortOrder?: number;
    workspaceId?: string;
    sessionId?: string;
    parentIssueId?: string;
    labels?: string[];
  },
) {
  const id = crypto.randomUUID();

  // Get project to read next_issue_number and slug
  const project = db
    .prepare(`SELECT slug, next_issue_number FROM tracker_projects WHERE id = ?`)
    .get(data.trackerProjectId) as { slug: string; next_issue_number: number } | null;
  if (!project) throw new Error(`Tracker project not found: ${data.trackerProjectId}`);

  const identifier = `${project.slug.toUpperCase()}-${project.next_issue_number}`;

  // Increment next_issue_number
  db.prepare(`UPDATE tracker_projects SET next_issue_number = next_issue_number + 1, updated_at = datetime('now') WHERE id = ?`).run(
    data.trackerProjectId,
  );

  // Insert the issue
  const row = db
    .prepare(
      `INSERT INTO tracker_issues (id, identifier, tracker_project_id, title, description, status_id, priority, assignee, due_date, sort_order, workspace_id, session_id, parent_issue_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .get(
      id,
      identifier,
      data.trackerProjectId,
      data.title,
      data.description ?? null,
      data.statusId,
      data.priority ?? 3,
      data.assignee ?? null,
      data.dueDate ?? null,
      data.sortOrder ?? 0,
      data.workspaceId ?? null,
      data.sessionId ?? null,
      data.parentIssueId ?? null,
    ) as TrackerIssueRow;

  // Insert labels if provided
  if (data.labels && data.labels.length > 0) {
    const labelStmt = db.prepare(
      `INSERT INTO tracker_issue_labels (issue_id, label_id) VALUES (?, ?)`,
    );
    for (const labelId of data.labels) {
      labelStmt.run(id, labelId);
    }
  }

  // Return with status and labels joined
  return getTrackerIssue(db, id)!;
}

export function getTrackerIssue(db: Database, id: string) {
  const row = db
    .prepare(
      `SELECT i.*, s.name AS status_name, s.category AS status_category, s.color AS status_color
       FROM tracker_issues i
       JOIN tracker_statuses s ON i.status_id = s.id
       WHERE i.id = ?`,
    )
    .get(id) as TrackerIssueWithStatusRow | null;
  if (!row) return null;

  const labels = db
    .prepare(
      `SELECT l.* FROM tracker_labels l
       JOIN tracker_issue_labels il ON il.label_id = l.id
       WHERE il.issue_id = ?`,
    )
    .all(id) as TrackerLabelRow[];

  return {
    ...mapTrackerIssueWithStatus(row),
    labels: labels.map(mapTrackerLabel),
  };
}

export function getTrackerIssueByIdentifier(db: Database, identifier: string) {
  const row = db
    .prepare(
      `SELECT i.*, s.name AS status_name, s.category AS status_category, s.color AS status_color
       FROM tracker_issues i
       JOIN tracker_statuses s ON i.status_id = s.id
       WHERE i.identifier = ?`,
    )
    .get(identifier) as TrackerIssueWithStatusRow | null;
  if (!row) return null;

  const labels = db
    .prepare(
      `SELECT l.* FROM tracker_labels l
       JOIN tracker_issue_labels il ON il.label_id = l.id
       WHERE il.issue_id = ?`,
    )
    .all(row.id) as TrackerLabelRow[];

  return {
    ...mapTrackerIssueWithStatus(row),
    labels: labels.map(mapTrackerLabel),
  };
}

export function listTrackerIssues(
  db: Database,
  projectId: string,
  filters?: {
    statusId?: string;
    priority?: number;
    assignee?: string;
    search?: string;
  },
) {
  const whereClauses = ['i.tracker_project_id = ?'];
  const values: unknown[] = [projectId];

  if (filters?.statusId) {
    whereClauses.push('i.status_id = ?');
    values.push(filters.statusId);
  }
  if (filters?.priority !== undefined) {
    whereClauses.push('i.priority = ?');
    values.push(filters.priority);
  }
  if (filters?.assignee) {
    whereClauses.push('i.assignee = ?');
    values.push(filters.assignee);
  }
  if (filters?.search) {
    whereClauses.push('(i.title LIKE ? OR i.description LIKE ?)');
    const term = `%${filters.search}%`;
    values.push(term, term);
  }

  const rows = db
    .prepare(
      `SELECT i.*, s.name AS status_name, s.category AS status_category, s.color AS status_color
       FROM tracker_issues i
       JOIN tracker_statuses s ON i.status_id = s.id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY s.sort_order, i.sort_order`,
    )
    .all(...values) as TrackerIssueWithStatusRow[];

  return rows.map(mapTrackerIssueWithStatus);
}

export function updateTrackerIssue(
  db: Database,
  id: string,
  updates: {
    title?: string;
    description?: string;
    statusId?: string;
    priority?: number;
    assignee?: string | null;
    dueDate?: string | null;
    sortOrder?: number;
    workspaceId?: string | null;
    sessionId?: string | null;
    parentIssueId?: string | null;
    labels?: string[];
  },
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.statusId !== undefined) {
    setClauses.push('status_id = ?');
    values.push(updates.statusId);
  }
  if (updates.priority !== undefined) {
    setClauses.push('priority = ?');
    values.push(updates.priority);
  }
  if (updates.assignee !== undefined) {
    setClauses.push('assignee = ?');
    values.push(updates.assignee);
  }
  if (updates.dueDate !== undefined) {
    setClauses.push('due_date = ?');
    values.push(updates.dueDate);
  }
  if (updates.sortOrder !== undefined) {
    setClauses.push('sort_order = ?');
    values.push(updates.sortOrder);
  }
  if (updates.workspaceId !== undefined) {
    setClauses.push('workspace_id = ?');
    values.push(updates.workspaceId);
  }
  if (updates.sessionId !== undefined) {
    setClauses.push('session_id = ?');
    values.push(updates.sessionId);
  }
  if (updates.parentIssueId !== undefined) {
    setClauses.push('parent_issue_id = ?');
    values.push(updates.parentIssueId);
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE tracker_issues SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }

  // Update labels if provided
  if (updates.labels !== undefined) {
    db.prepare(`DELETE FROM tracker_issue_labels WHERE issue_id = ?`).run(id);
    if (updates.labels.length > 0) {
      const labelStmt = db.prepare(
        `INSERT INTO tracker_issue_labels (issue_id, label_id) VALUES (?, ?)`,
      );
      for (const labelId of updates.labels) {
        labelStmt.run(id, labelId);
      }
    }
  }
}

export function moveTrackerIssue(db: Database, id: string, statusId: string, sortOrder: number) {
  db.prepare(
    `UPDATE tracker_issues SET status_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(statusId, sortOrder, id);
}

export function deleteTrackerIssue(db: Database, id: string) {
  db.prepare(`DELETE FROM tracker_issues WHERE id = ?`).run(id);
}

// ─── Comments ────────────────────────────────────────────────────────────────

export function listTrackerComments(db: Database, issueId: string) {
  const rows = db
    .prepare(`SELECT * FROM tracker_comments WHERE issue_id = ? ORDER BY created_at ASC`)
    .all(issueId) as TrackerCommentRow[];
  return rows.map(mapTrackerComment);
}

export function createTrackerComment(
  db: Database,
  data: { issueId: string; author?: string; content: string },
) {
  const id = crypto.randomUUID();
  const row = db
    .prepare(
      `INSERT INTO tracker_comments (id, issue_id, author, content)
       VALUES (?, ?, ?, ?) RETURNING *`,
    )
    .get(id, data.issueId, data.author ?? 'user', data.content) as TrackerCommentRow;
  return mapTrackerComment(row);
}
