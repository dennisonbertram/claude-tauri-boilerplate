import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  createDb,
  createSession,
  getSession,
  deleteSession,
  createProject,
  listProjects,
  getProject,
  getProjectByPath,
  updateProject,
  deleteProject,
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  transitionWorkspaceStatus,
  updateWorkspaceStatus,
  updateWorkspaceClaudeSession,
  setWorkspaceError,
  deleteWorkspace,
} from './index';

describe('Projects & Workspaces Database', () => {
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  // --- Schema Tests ---

  describe('Schema', () => {
    test('creates projects table', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
        .all() as Array<{ name: string }>;
      expect(tables).toHaveLength(1);
    });

    test('creates workspaces table', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'")
        .all() as Array<{ name: string }>;
      expect(tables).toHaveLength(1);
    });

    test('sessions table has workspace_id column', () => {
      const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
      const hasWorkspaceId = columns.some((col) => col.name === 'workspace_id');
      expect(hasWorkspaceId).toBe(true);
    });

    test('indexes are created for projects', () => {
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='projects'")
        .all() as Array<{ name: string }>;
      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain('idx_projects_name');
      expect(indexNames).toContain('idx_projects_canonical_path');
    });

    test('indexes are created for workspaces', () => {
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='workspaces'")
        .all() as Array<{ name: string }>;
      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain('idx_workspaces_project_id');
      expect(indexNames).toContain('idx_workspaces_status');
      expect(indexNames).toContain('idx_workspaces_updated_at');
    });

    test('workspaces table has linear issue columns', () => {
      const columns = db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
      const columnNames = columns.map((col) => col.name);
      expect(columnNames).toContain('linear_issue_id');
      expect(columnNames).toContain('linear_issue_title');
      expect(columnNames).toContain('linear_issue_summary');
      expect(columnNames).toContain('linear_issue_url');
    });

    test('workspaces table has additional directories column', () => {
      const columns = db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
      const columnNames = columns.map((col) => col.name);
      expect(columnNames).toContain('additional_directories');
    });

    test('sessions workspace_id index is created', () => {
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sessions' AND name='idx_sessions_workspace_id'")
        .all() as Array<{ name: string }>;
      expect(indexes).toHaveLength(1);
    });
  });

  // --- Project CRUD Tests ---

  describe('createProject', () => {
    test('creates a project and returns mapped object', () => {
      const project = createProject(db, 'proj-1', 'My App', '/home/user/my-app', '/home/user/my-app', 'main');

      expect(project.id).toBe('proj-1');
      expect(project.name).toBe('My App');
      expect(project.repoPath).toBe('/home/user/my-app');
      expect(project.repoPathCanonical).toBe('/home/user/my-app');
      expect(project.defaultBranch).toBe('main');
      expect(project.setupCommand).toBeNull();
      expect(project.isDeleted).toBe(false);
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    test('creates a project with setup command', () => {
      const project = createProject(db, 'proj-2', 'API', '/home/user/api', '/home/user/api', 'main', 'pnpm install');
      expect(project.setupCommand).toBe('pnpm install');
    });

    test('rejects project with empty name', () => {
      expect(() =>
        createProject(db, 'proj-bad', '', '/home/user/x', '/home/user/x', 'main')
      ).toThrow();
    });

    test('rejects project with whitespace-only name', () => {
      expect(() =>
        createProject(db, 'proj-bad2', '   ', '/home/user/y', '/home/user/y', 'main')
      ).toThrow();
    });

    test('rejects duplicate repo_path', () => {
      createProject(db, 'proj-a', 'A', '/home/user/dup', '/home/user/dup-a', 'main');
      expect(() =>
        createProject(db, 'proj-b', 'B', '/home/user/dup', '/home/user/dup-b', 'main')
      ).toThrow();
    });

    test('rejects duplicate repo_path_canonical', () => {
      createProject(db, 'proj-a', 'A', '/home/user/dup-a', '/home/user/canonical', 'main');
      expect(() =>
        createProject(db, 'proj-b', 'B', '/home/user/dup-b', '/home/user/canonical', 'main')
      ).toThrow();
    });
  });

  describe('listProjects', () => {
    test('returns empty array when no projects exist', () => {
      expect(listProjects(db)).toEqual([]);
    });

    test('returns only non-deleted projects', () => {
      createProject(db, 'proj-1', 'Active', '/a', '/a', 'main');
      createProject(db, 'proj-2', 'Deleted', '/b', '/b', 'main');
      // Simulate soft-delete
      db.run("UPDATE projects SET is_deleted = 1 WHERE id = 'proj-2'");

      const projects = listProjects(db);
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Active');
    });

    test('returns projects ordered by created_at descending', () => {
      db.run(
        `INSERT INTO projects (id, name, repo_path, repo_path_canonical, default_branch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['old', 'Old', '/old', '/old', 'main', '2024-01-01 00:00:00', '2024-01-01 00:00:00']
      );
      db.run(
        `INSERT INTO projects (id, name, repo_path, repo_path_canonical, default_branch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['new', 'New', '/new', '/new', 'main', '2024-06-01 00:00:00', '2024-06-01 00:00:00']
      );

      const projects = listProjects(db);
      expect(projects).toHaveLength(2);
      expect(projects[0].id).toBe('new');
      expect(projects[1].id).toBe('old');
    });
  });

  describe('getProject', () => {
    test('returns project by id', () => {
      createProject(db, 'proj-get', 'GetMe', '/get', '/get', 'main');
      const project = getProject(db, 'proj-get');
      expect(project).not.toBeNull();
      expect(project!.name).toBe('GetMe');
    });

    test('returns null for non-existent id', () => {
      expect(getProject(db, 'nope')).toBeNull();
    });
  });

  describe('getProjectByPath', () => {
    test('returns project by canonical path', () => {
      createProject(db, 'proj-path', 'ByPath', '/display', '/canonical', 'main');
      const project = getProjectByPath(db, '/canonical');
      expect(project).not.toBeNull();
      expect(project!.id).toBe('proj-path');
    });

    test('returns null for unknown canonical path', () => {
      expect(getProjectByPath(db, '/unknown')).toBeNull();
    });
  });

  describe('updateProject', () => {
    test('updates project name', () => {
      createProject(db, 'proj-upd', 'Original', '/upd', '/upd', 'main');
      updateProject(db, 'proj-upd', { name: 'Updated' });

      const project = getProject(db, 'proj-upd');
      expect(project!.name).toBe('Updated');
    });

    test('updates defaultBranch', () => {
      createProject(db, 'proj-br', 'BranchTest', '/br', '/br', 'main');
      updateProject(db, 'proj-br', { defaultBranch: 'develop' });

      const project = getProject(db, 'proj-br');
      expect(project!.defaultBranch).toBe('develop');
    });

    test('updates setupCommand', () => {
      createProject(db, 'proj-sc', 'SetupTest', '/sc', '/sc', 'main');
      updateProject(db, 'proj-sc', { setupCommand: 'npm install' });

      const project = getProject(db, 'proj-sc');
      expect(project!.setupCommand).toBe('npm install');
    });

    test('updates multiple fields at once', () => {
      createProject(db, 'proj-multi', 'Multi', '/multi', '/multi', 'main');
      updateProject(db, 'proj-multi', { name: 'New Name', defaultBranch: 'dev', setupCommand: 'bun install' });

      const project = getProject(db, 'proj-multi');
      expect(project!.name).toBe('New Name');
      expect(project!.defaultBranch).toBe('dev');
      expect(project!.setupCommand).toBe('bun install');
    });

    test('updates updated_at timestamp', () => {
      db.run(
        `INSERT INTO projects (id, name, repo_path, repo_path_canonical, default_branch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['proj-ts', 'TSTest', '/ts', '/ts', 'main', '2024-01-01 00:00:00', '2024-01-01 00:00:00']
      );

      updateProject(db, 'proj-ts', { name: 'NewName' });
      const project = getProject(db, 'proj-ts');
      expect(project!.updatedAt).not.toBe('2024-01-01 00:00:00');
    });

    test('does nothing when no updates provided', () => {
      createProject(db, 'proj-noop', 'Noop', '/noop', '/noop', 'main');
      // Should not throw
      updateProject(db, 'proj-noop', {});
      const project = getProject(db, 'proj-noop');
      expect(project!.name).toBe('Noop');
    });
  });

  describe('deleteProject', () => {
    test('deletes a project', () => {
      createProject(db, 'proj-del', 'Delete Me', '/del', '/del', 'main');
      deleteProject(db, 'proj-del');
      expect(getProject(db, 'proj-del')).toBeNull();
    });

    test('cascade deletes workspaces when project is deleted', () => {
      createProject(db, 'proj-casc', 'Cascade', '/casc', '/casc', 'main');
      createWorkspace(db, 'ws-1', 'proj-casc', 'feat', 'workspace/feat', '/wt/feat', '/wt/feat', 'main');

      expect(getWorkspace(db, 'ws-1')).not.toBeNull();

      deleteProject(db, 'proj-casc');
      expect(getWorkspace(db, 'ws-1')).toBeNull();
    });

    test('does not throw when deleting non-existent project', () => {
      expect(() => deleteProject(db, 'ghost')).not.toThrow();
    });
  });

  // --- Workspace CRUD Tests ---

  describe('createWorkspace', () => {
    test('stores linear issue metadata when provided', () => {
      createProject(db, 'proj-ws-linear', 'WSProjectLinear', '/ws-linear', '/ws-linear', 'main');
      const ws = createWorkspace(
        db,
        'ws-linear-1',
        'proj-ws-linear',
        'feat-login',
        'workspace/feat-login',
        '/wt/login',
        '/wt/login',
        'main',
        {
          id: 'ISS-303',
          title: 'Login failure',
          summary: 'Investigate auth edge case',
          url: 'https://linear.app/org/issue/ISS-303',
        }
      );

      expect(ws.linearIssueId).toBe('ISS-303');
      expect(ws.linearIssueTitle).toBe('Login failure');
      expect(ws.linearIssueSummary).toBe('Investigate auth edge case');
      expect(ws.linearIssueUrl).toBe('https://linear.app/org/issue/ISS-303');
    });

    test('stores additional directories when provided', () => {
      createProject(db, 'proj-ws-dirs', 'WSProjectDirs', '/ws-dirs', '/ws-dirs', 'main');
      const ws = createWorkspace(
        db,
        'ws-dirs-1',
        'proj-ws-dirs',
        'feat-multi',
        'workspace/feat-multi',
        '/wt/multi',
        '/wt/multi',
        'main',
        undefined,
        ['/repo-a', '/repo-b']
      );

      expect(ws.additionalDirectories).toEqual(['/repo-a', '/repo-b']);
      const stored = getWorkspace(db, 'ws-dirs-1');
      expect(stored?.additionalDirectories).toEqual(['/repo-a', '/repo-b']);
    });

    test('creates a workspace and returns mapped object', () => {
      createProject(db, 'proj-ws', 'WSProject', '/ws', '/ws', 'main');
      const ws = createWorkspace(db, 'ws-1', 'proj-ws', 'feat-auth', 'workspace/feat-auth', '/wt/auth', '/wt/auth', 'main');

      expect(ws.id).toBe('ws-1');
      expect(ws.projectId).toBe('proj-ws');
      expect(ws.name).toBe('feat-auth');
      expect(ws.branch).toBe('workspace/feat-auth');
      expect(ws.worktreePath).toBe('/wt/auth');
      expect(ws.worktreePathCanonical).toBe('/wt/auth');
      expect(ws.baseBranch).toBe('main');
      expect(ws.status).toBe('creating');
      expect(ws.claudeSessionId).toBeNull();
      expect(ws.setupPid).toBeNull();
      expect(ws.errorMessage).toBeNull();
      expect(ws.createdAt).toBeDefined();
      expect(ws.updatedAt).toBeDefined();
    });

    test('rejects workspace referencing non-existent project', () => {
      expect(() =>
        createWorkspace(db, 'ws-orphan', 'no-project', 'feat', 'workspace/feat', '/wt/o', '/wt/o', 'main')
      ).toThrow();
    });

    test('rejects duplicate workspace name within same project', () => {
      createProject(db, 'proj-dup', 'DupProject', '/dup', '/dup', 'main');
      createWorkspace(db, 'ws-a', 'proj-dup', 'same-name', 'workspace/a', '/wt/a', '/wt/a', 'main');

      expect(() =>
        createWorkspace(db, 'ws-b', 'proj-dup', 'same-name', 'workspace/b', '/wt/b', '/wt/b', 'main')
      ).toThrow();
    });

    test('rejects duplicate branch within same project', () => {
      createProject(db, 'proj-br', 'BrProject', '/br', '/br', 'main');
      createWorkspace(db, 'ws-c', 'proj-br', 'name-c', 'workspace/same-branch', '/wt/c', '/wt/c', 'main');

      expect(() =>
        createWorkspace(db, 'ws-d', 'proj-br', 'name-d', 'workspace/same-branch', '/wt/d', '/wt/d', 'main')
      ).toThrow();
    });

    test('allows same workspace name in different projects', () => {
      createProject(db, 'proj-x', 'X', '/x', '/x', 'main');
      createProject(db, 'proj-y', 'Y', '/y', '/y', 'main');
      createWorkspace(db, 'ws-x', 'proj-x', 'feat', 'workspace/feat-x', '/wt/x', '/wt/x', 'main');

      expect(() =>
        createWorkspace(db, 'ws-y', 'proj-y', 'feat', 'workspace/feat-y', '/wt/y', '/wt/y', 'main')
      ).not.toThrow();
    });

    test('rejects duplicate worktree_path', () => {
      createProject(db, 'proj-wtp', 'WTP', '/wtp', '/wtp', 'main');
      createWorkspace(db, 'ws-p1', 'proj-wtp', 'a', 'workspace/a', '/wt/same', '/wt/can-a', 'main');

      expect(() =>
        createWorkspace(db, 'ws-p2', 'proj-wtp', 'b', 'workspace/b', '/wt/same', '/wt/can-b', 'main')
      ).toThrow();
    });

    test('rejects duplicate worktree_path_canonical', () => {
      createProject(db, 'proj-wtpc', 'WTPC', '/wtpc', '/wtpc', 'main');
      createWorkspace(db, 'ws-pc1', 'proj-wtpc', 'a', 'workspace/a', '/wt/diff-a', '/wt/same-can', 'main');

      expect(() =>
        createWorkspace(db, 'ws-pc2', 'proj-wtpc', 'b', 'workspace/b', '/wt/diff-b', '/wt/same-can', 'main')
      ).toThrow();
    });
  });

  describe('listWorkspaces', () => {
    test('returns empty array when no workspaces exist', () => {
      createProject(db, 'proj-empty', 'Empty', '/empty', '/empty', 'main');
      expect(listWorkspaces(db, 'proj-empty')).toEqual([]);
    });

    test('returns only workspaces for the given project', () => {
      createProject(db, 'proj-a', 'A', '/a', '/a', 'main');
      createProject(db, 'proj-b', 'B', '/b', '/b', 'main');
      createWorkspace(db, 'ws-a1', 'proj-a', 'feat-a', 'workspace/feat-a', '/wt/a1', '/wt/a1', 'main');
      createWorkspace(db, 'ws-b1', 'proj-b', 'feat-b', 'workspace/feat-b', '/wt/b1', '/wt/b1', 'main');

      const wsA = listWorkspaces(db, 'proj-a');
      expect(wsA).toHaveLength(1);
      expect(wsA[0].id).toBe('ws-a1');

      const wsB = listWorkspaces(db, 'proj-b');
      expect(wsB).toHaveLength(1);
      expect(wsB[0].id).toBe('ws-b1');
    });
  });

  describe('getWorkspace', () => {
    test('returns workspace by id', () => {
      createProject(db, 'proj-get-ws', 'GetWS', '/get-ws', '/get-ws', 'main');
      createWorkspace(db, 'ws-get', 'proj-get-ws', 'feat', 'workspace/feat', '/wt/get', '/wt/get', 'main');

      const ws = getWorkspace(db, 'ws-get');
      expect(ws).not.toBeNull();
      expect(ws!.name).toBe('feat');
    });

    test('returns null for non-existent id', () => {
      expect(getWorkspace(db, 'nope')).toBeNull();
    });
  });

  describe('updateWorkspace', () => {
    test('updates additional directories', () => {
      createProject(db, 'proj-updirs', 'UpdateDirs', '/updirs', '/updirs', 'main');
      createWorkspace(db, 'ws-updirs', 'proj-updirs', 'feat', 'workspace/feat', '/wt/dirs', '/wt/dirs', 'main');

      updateWorkspace(db, 'ws-updirs', { additionalDirectories: ['/repo-a', '/repo-b'] });

      const ws = getWorkspace(db, 'ws-updirs');
      expect(ws?.additionalDirectories).toEqual(['/repo-a', '/repo-b']);
    });
  });

  describe('updateWorkspaceStatus', () => {
    test('updates workspace status', () => {
      createProject(db, 'proj-st', 'Status', '/st', '/st', 'main');
      createWorkspace(db, 'ws-st', 'proj-st', 'feat', 'workspace/feat', '/wt/st', '/wt/st', 'main');

      updateWorkspaceStatus(db, 'ws-st', 'ready');
      const ws = getWorkspace(db, 'ws-st');
      expect(ws!.status).toBe('ready');
      expect(ws!.errorMessage).toBeNull();
    });

    test('updates status with error message', () => {
      createProject(db, 'proj-err', 'ErrProject', '/err', '/err', 'main');
      createWorkspace(db, 'ws-err', 'proj-err', 'feat', 'workspace/feat', '/wt/err', '/wt/err', 'main');

      updateWorkspaceStatus(db, 'ws-err', 'error', 'Something went wrong');
      const ws = getWorkspace(db, 'ws-err');
      expect(ws!.status).toBe('error');
      expect(ws!.errorMessage).toBe('Something went wrong');
    });

    test('clears error message when updating to non-error status', () => {
      createProject(db, 'proj-clr', 'Clear', '/clr', '/clr', 'main');
      createWorkspace(db, 'ws-clr', 'proj-clr', 'feat', 'workspace/feat', '/wt/clr', '/wt/clr', 'main');

      updateWorkspaceStatus(db, 'ws-clr', 'error', 'Failed');
      updateWorkspaceStatus(db, 'ws-clr', 'ready');
      const ws = getWorkspace(db, 'ws-clr');
      expect(ws!.status).toBe('ready');
      expect(ws!.errorMessage).toBeNull();
    });

    test('rejects invalid status value via CHECK constraint', () => {
      createProject(db, 'proj-chk', 'Check', '/chk', '/chk', 'main');
      createWorkspace(db, 'ws-chk', 'proj-chk', 'feat', 'workspace/feat', '/wt/chk', '/wt/chk', 'main');

      expect(() =>
        db.run("UPDATE workspaces SET status = 'invalid_status' WHERE id = 'ws-chk'")
      ).toThrow();
    });
  });

  describe('transitionWorkspaceStatus', () => {
    test('allows valid transitions', () => {
      createProject(db, 'proj-ts', 'Transition', '/ts', '/ts', 'main');
      createWorkspace(db, 'ws-ts', 'proj-ts', 'feat', 'workspace/feat', '/wt/ts', '/wt/ts', 'main');

      transitionWorkspaceStatus(db, 'ws-ts', 'ready');
      transitionWorkspaceStatus(db, 'ws-ts', 'active');

      const ws = getWorkspace(db, 'ws-ts');
      expect(ws!.status).toBe('active');
    });

    test('rejects invalid transitions', () => {
      createProject(db, 'proj-ts-bad', 'TransitionBad', '/ts-bad', '/ts-bad', 'main');
      createWorkspace(db, 'ws-ts-bad', 'proj-ts-bad', 'feat', 'workspace/feat', '/wt/ts-bad', '/wt/ts-bad', 'main');

      expect(() => transitionWorkspaceStatus(db, 'ws-ts-bad', 'merged')).toThrow(
        "Invalid workspace status transition from 'creating' to 'merged'"
      );

      const ws = getWorkspace(db, 'ws-ts-bad');
      expect(ws!.status).toBe('creating');
    });
  });

  describe('updateWorkspaceClaudeSession', () => {
    test('sets claude session id on workspace', () => {
      createProject(db, 'proj-cs', 'ClaudeSession', '/cs', '/cs', 'main');
      createWorkspace(db, 'ws-cs', 'proj-cs', 'feat', 'workspace/feat', '/wt/cs', '/wt/cs', 'main');

      updateWorkspaceClaudeSession(db, 'ws-cs', 'claude-sess-123');
      const ws = getWorkspace(db, 'ws-cs');
      expect(ws!.claudeSessionId).toBe('claude-sess-123');
    });
  });

  describe('setWorkspaceError', () => {
    test('sets status to error and stores error message', () => {
      createProject(db, 'proj-se', 'SetErr', '/se', '/se', 'main');
      createWorkspace(db, 'ws-se', 'proj-se', 'feat', 'workspace/feat', '/wt/se', '/wt/se', 'main');

      // First move to ready
      updateWorkspaceStatus(db, 'ws-se', 'ready');

      setWorkspaceError(db, 'ws-se', 'Worktree path missing');
      const ws = getWorkspace(db, 'ws-se');
      expect(ws!.status).toBe('error');
      expect(ws!.errorMessage).toBe('Worktree path missing');
    });
  });

  describe('deleteWorkspace', () => {
    test('deletes a workspace', () => {
      createProject(db, 'proj-dw', 'DelWS', '/dw', '/dw', 'main');
      createWorkspace(db, 'ws-dw', 'proj-dw', 'feat', 'workspace/feat', '/wt/dw', '/wt/dw', 'main');

      deleteWorkspace(db, 'ws-dw');
      expect(getWorkspace(db, 'ws-dw')).toBeNull();
    });

    test('does not throw when deleting non-existent workspace', () => {
      expect(() => deleteWorkspace(db, 'ghost')).not.toThrow();
    });
  });

  // --- Sessions + workspace_id Tests ---

  describe('sessions workspace_id', () => {
    test('workspace_id is nullable (default null)', () => {
      const session = createSession(db, 'sess-null-ws');
      expect(session.workspaceId).toBeNull();
    });

    test('can set workspace_id on a session', () => {
      createProject(db, 'proj-sw', 'SessionWS', '/sw', '/sw', 'main');
      createWorkspace(db, 'ws-sw', 'proj-sw', 'feat', 'workspace/feat', '/wt/sw', '/wt/sw', 'main');
      createSession(db, 'sess-ws');

      db.run("UPDATE sessions SET workspace_id = 'ws-sw' WHERE id = 'sess-ws'");
      const session = getSession(db, 'sess-ws');
      expect(session!.workspaceId).toBe('ws-sw');
    });

    test('workspace_id set to NULL when workspace is deleted (ON DELETE SET NULL)', () => {
      createProject(db, 'proj-sn', 'SetNull', '/sn', '/sn', 'main');
      createWorkspace(db, 'ws-sn', 'proj-sn', 'feat', 'workspace/feat', '/wt/sn', '/wt/sn', 'main');
      createSession(db, 'sess-sn');
      db.run("UPDATE sessions SET workspace_id = 'ws-sn' WHERE id = 'sess-sn'");

      // Verify it's set
      let session = getSession(db, 'sess-sn');
      expect(session!.workspaceId).toBe('ws-sn');

      // Delete workspace
      deleteWorkspace(db, 'ws-sn');

      // Session should still exist but workspace_id should be null
      session = getSession(db, 'sess-sn');
      expect(session).not.toBeNull();
      expect(session!.workspaceId).toBeNull();
    });

    test('session survives project cascade delete (workspace deleted, session workspace_id nulled)', () => {
      createProject(db, 'proj-full', 'Full', '/full', '/full', 'main');
      createWorkspace(db, 'ws-full', 'proj-full', 'feat', 'workspace/feat', '/wt/full', '/wt/full', 'main');
      createSession(db, 'sess-full');
      db.run("UPDATE sessions SET workspace_id = 'ws-full' WHERE id = 'sess-full'");

      // Delete project (cascades to workspaces, which SET NULL on sessions)
      deleteProject(db, 'proj-full');

      const session = getSession(db, 'sess-full');
      expect(session).not.toBeNull();
      expect(session!.workspaceId).toBeNull();
    });
  });

  // --- Idempotency Tests ---

  describe('schema idempotency', () => {
    test('calling createDb twice on same in-memory db does not fail', () => {
      // Running the schema + migration again should be safe
      db.exec('PRAGMA foreign_keys = ON');
      // Re-import and re-run would be the real test, but we can simulate
      // by running the migration function again
      const { migrateSessionsWorkspaceId } = require('./schema');
      expect(() => migrateSessionsWorkspaceId(db)).not.toThrow();
    });
  });
});
