import { Database } from 'bun:sqlite';

interface ProjectRow {
  id: string;
  name: string;
  repo_path: string;
  repo_path_canonical: string;
  default_branch: string;
  setup_command: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

function mapProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    repoPath: row.repo_path,
    repoPathCanonical: row.repo_path_canonical,
    defaultBranch: row.default_branch,
    setupCommand: row.setup_command,
    isDeleted: row.is_deleted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProject(
  db: Database,
  id: string,
  name: string,
  repoPath: string,
  repoPathCanonical: string,
  defaultBranch: string,
  setupCommand?: string
) {
  const stmt = db.prepare(
    `INSERT INTO projects (id, name, repo_path, repo_path_canonical, default_branch, setup_command) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(id, name, repoPath, repoPathCanonical, defaultBranch, setupCommand ?? null) as ProjectRow;
  return mapProject(row);
}

export function listProjects(db: Database) {
  const stmt = db.prepare(`SELECT * FROM projects WHERE is_deleted = 0 ORDER BY created_at DESC`);
  const rows = stmt.all() as ProjectRow[];
  return rows.map(mapProject);
}

export function getProject(db: Database, id: string) {
  const stmt = db.prepare(`SELECT * FROM projects WHERE id = ?`);
  const row = stmt.get(id) as ProjectRow | null;
  return row ? mapProject(row) : null;
}

export function getProjectByPath(db: Database, canonicalPath: string) {
  const stmt = db.prepare(`SELECT * FROM projects WHERE repo_path_canonical = ?`);
  const row = stmt.get(canonicalPath) as ProjectRow | null;
  return row ? mapProject(row) : null;
}

export function updateProject(
  db: Database,
  id: string,
  updates: { name?: string; defaultBranch?: string; setupCommand?: string }
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.defaultBranch !== undefined) {
    setClauses.push('default_branch = ?');
    values.push(updates.defaultBranch);
  }
  if (updates.setupCommand !== undefined) {
    setClauses.push('setup_command = ?');
    values.push(updates.setupCommand);
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`
  );
  return stmt.run(...values);
}

export function deleteProject(db: Database, id: string) {
  const stmt = db.prepare(`DELETE FROM projects WHERE id = ?`);
  return stmt.run(id);
}
