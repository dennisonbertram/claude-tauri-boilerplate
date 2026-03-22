import { Database } from 'bun:sqlite';

export interface WorkspaceReviewRow {
  id: string;
  workspace_id: string;
  selected_from_ref: string | null;
  selected_to_ref: string | null;
  filter_mode: string;
  view_mode: string;
  pr_number: number | null;
  pr_url: string | null;
  pr_head_sha: string | null;
  pr_base_sha: string | null;
  pr_title: string | null;
  pr_body: string | null;
  checks_json: string;
  deployments_json: string;
  summary_json: string;
  freshness_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceReviewFileRow {
  id: string;
  review_id: string;
  file_path: string;
  review_state: string;
  reviewed_at: string | null;
  last_seen_status: string | null;
}

export interface WorkspaceReviewCommentRow {
  id: string;
  review_id: string;
  file_path: string;
  diff_line_key: string | null;
  old_line: number | null;
  new_line: number | null;
  markdown: string;
  status: string;
  sync_state: string;
  github_comment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceReviewTodoRow {
  id: string;
  review_id: string;
  body: string;
  status: string;
  source: string;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export type MergeReadiness = 'ready' | 'needs_review' | 'blocked' | 'stale';

export function getOrCreateWorkspaceReview(db: Database, workspaceId: string): WorkspaceReviewRow {
  const existing = db
    .prepare(`SELECT * FROM workspace_reviews WHERE workspace_id = ?`)
    .get(workspaceId) as WorkspaceReviewRow | null;
  if (existing) return existing;

  const id = crypto.randomUUID();
  const row = db
    .prepare(
      `INSERT INTO workspace_reviews (id, workspace_id) VALUES (?, ?) RETURNING *`
    )
    .get(id, workspaceId) as WorkspaceReviewRow;
  return row;
}

export function updateWorkspaceReview(
  db: Database,
  reviewId: string,
  patch: Partial<Pick<WorkspaceReviewRow, 'selected_from_ref' | 'selected_to_ref' | 'filter_mode' | 'view_mode' | 'pr_number' | 'pr_url' | 'pr_head_sha' | 'pr_base_sha' | 'pr_title' | 'pr_body' | 'checks_json' | 'deployments_json' | 'summary_json' | 'freshness_checked_at'>>
): void {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(reviewId);

  db.prepare(`UPDATE workspace_reviews SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

export function upsertReviewFile(
  db: Database,
  reviewId: string,
  filePath: string,
  state: 'unreviewed' | 'reviewed' | 'ignored'
): WorkspaceReviewFileRow {
  const id = crypto.randomUUID();
  const reviewedAt = state === 'reviewed' ? new Date().toISOString() : null;
  const row = db
    .prepare(
      `INSERT INTO workspace_review_files (id, review_id, file_path, review_state, reviewed_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(review_id, file_path) DO UPDATE SET
         review_state = excluded.review_state,
         reviewed_at = CASE WHEN excluded.review_state = 'reviewed' THEN excluded.reviewed_at ELSE workspace_review_files.reviewed_at END
       RETURNING *`
    )
    .get(id, reviewId, filePath, state, reviewedAt) as WorkspaceReviewFileRow;
  return row;
}

export function getReviewFiles(db: Database, reviewId: string): WorkspaceReviewFileRow[] {
  return db
    .prepare(`SELECT * FROM workspace_review_files WHERE review_id = ? ORDER BY file_path ASC`)
    .all(reviewId) as WorkspaceReviewFileRow[];
}

export function createReviewComment(
  db: Database,
  reviewId: string,
  data: {
    file_path: string;
    diff_line_key?: string | null;
    old_line?: number | null;
    new_line?: number | null;
    markdown: string;
  }
): WorkspaceReviewCommentRow {
  const id = crypto.randomUUID();
  const row = db
    .prepare(
      `INSERT INTO workspace_review_comments (id, review_id, file_path, diff_line_key, old_line, new_line, markdown)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .get(
      id,
      reviewId,
      data.file_path,
      data.diff_line_key ?? null,
      data.old_line ?? null,
      data.new_line ?? null,
      data.markdown
    ) as WorkspaceReviewCommentRow;
  return row;
}

export function updateReviewComment(
  db: Database,
  commentId: string,
  patch: Partial<Pick<WorkspaceReviewCommentRow, 'markdown' | 'status' | 'sync_state' | 'github_comment_id'>>
): void {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(commentId);

  db.prepare(`UPDATE workspace_review_comments SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteReviewComment(db: Database, commentId: string): boolean {
  const result = db
    .prepare(`DELETE FROM workspace_review_comments WHERE id = ?`)
    .run(commentId);
  return result.changes > 0;
}

export function getReviewComments(db: Database, reviewId: string): WorkspaceReviewCommentRow[] {
  return db
    .prepare(`SELECT * FROM workspace_review_comments WHERE review_id = ? ORDER BY created_at ASC`)
    .all(reviewId) as WorkspaceReviewCommentRow[];
}

export function createReviewTodo(
  db: Database,
  reviewId: string,
  data: {
    body: string;
    source?: 'local' | 'check' | 'agent';
    file_path?: string | null;
  }
): WorkspaceReviewTodoRow {
  const id = crypto.randomUUID();
  const row = db
    .prepare(
      `INSERT INTO workspace_review_todos (id, review_id, body, source, file_path)
       VALUES (?, ?, ?, ?, ?) RETURNING *`
    )
    .get(
      id,
      reviewId,
      data.body,
      data.source ?? 'local',
      data.file_path ?? null
    ) as WorkspaceReviewTodoRow;
  return row;
}

export function updateReviewTodo(
  db: Database,
  todoId: string,
  patch: Partial<Pick<WorkspaceReviewTodoRow, 'status' | 'body'>>
): void {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(todoId);

  db.prepare(`UPDATE workspace_review_todos SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

export function getReviewTodos(db: Database, reviewId: string): WorkspaceReviewTodoRow[] {
  return db
    .prepare(`SELECT * FROM workspace_review_todos WHERE review_id = ? ORDER BY created_at ASC`)
    .all(reviewId) as WorkspaceReviewTodoRow[];
}

export function computeMergeReadiness(
  review: WorkspaceReviewRow,
  files: WorkspaceReviewFileRow[],
  todos: WorkspaceReviewTodoRow[],
  currentCommit?: string | null
): MergeReadiness {
  // stale: pr_head_sha is set and does not match workspace's current commit
  if (review.pr_head_sha && currentCommit && review.pr_head_sha !== currentCommit) {
    return 'stale';
  }

  // blocked: any open TODO with source='check' or failing check in checks_json
  const hasBlockingTodo = todos.some(
    (t) => t.status === 'open' && t.source === 'check'
  );
  if (hasBlockingTodo) return 'blocked';

  let checks: Array<{ conclusion?: string; status?: string }> = [];
  try {
    checks = JSON.parse(review.checks_json);
  } catch {
    checks = [];
  }
  const hasFailingCheck = Array.isArray(checks) && checks.some(
    (c) => c.conclusion === 'failure' || c.conclusion === 'timed_out'
  );
  if (hasFailingCheck) return 'blocked';

  // needs_review: any file with review_state='unreviewed'
  const hasUnreviewed = files.some((f) => f.review_state === 'unreviewed');
  if (hasUnreviewed) return 'needs_review';

  return 'ready';
}
