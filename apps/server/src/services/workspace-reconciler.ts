import { existsSync } from 'node:fs';
import type { Database } from 'bun:sqlite';
import {
  recordWorkspaceEvent,
  updateWorkspaceRecoveryStatus,
} from '../db';

interface ReconcileIssue {
  workspaceId: string;
  issue: 'orphan_row' | 'missing_branch' | 'stale_state';
  details: string;
}

export interface ReconciliationResult {
  projectId: string;
  workspacesChecked: number;
  issuesFound: number;
  issues: ReconcileIssue[];
}

export async function reconcileProjectWorkspaces(
  db: Database,
  projectId: string,
  repoPath: string,
  workspaces: Array<{ id: string; branch: string; worktreePath: string; status: string; errorMessage?: string | null }>
): Promise<ReconciliationResult> {
  const issues: ReconcileIssue[] = [];

  for (const ws of workspaces) {
    try {
      const dirExists = ws.worktreePath ? existsSync(ws.worktreePath) : false;

      // Check branch existence via git
      let branchExists = false;
      try {
        const proc = Bun.spawnSync(['git', '-C', repoPath, 'rev-parse', '--verify', ws.branch], {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        branchExists = proc.exitCode === 0;
      } catch {
        branchExists = false;
      }

      let issueType: ReconcileIssue['issue'] | null = null;
      let details = '';

      if (!dirExists && branchExists && ws.status !== 'archived' && ws.worktreePath) {
        issueType = 'orphan_row';
        details = `Worktree directory missing but branch exists (status=${ws.status})`;
      } else if (dirExists && !branchExists && ws.status !== 'archived') {
        issueType = 'missing_branch';
        details = `Branch ${ws.branch} missing but directory exists`;
      } else if (ws.status === 'error' && !ws.errorMessage) {
        issueType = 'stale_state';
        details = 'Status=error but no errorMessage recorded';
      }

      if (issueType) {
        issues.push({ workspaceId: ws.id, issue: issueType, details });
        const recoveryStatus = issueType === 'orphan_row' ? 'recoverable' : 'stale';
        updateWorkspaceRecoveryStatus(db, ws.id, recoveryStatus);
      } else {
        updateWorkspaceRecoveryStatus(db, ws.id, 'healthy');
      }

      recordWorkspaceEvent(db, ws.id, 'reconciled', {
        issueType: issueType ?? undefined,
        details: details || undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      issues.push({ workspaceId: ws.id, issue: 'stale_state', details: `Reconcile error: ${msg}` });
    }
  }

  return {
    projectId,
    workspacesChecked: workspaces.length,
    issuesFound: issues.length,
    issues,
  };
}
