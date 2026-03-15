import { GitCommandRunner, gitCommand } from './git-command';

export interface WorktreeInfo {
  worktree: string;
  head: string;
  branch: string;
  bare: boolean;
  detached: boolean;
}

export type ChangedFileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'untracked';

export interface ChangedFile {
  path: string;
  status: ChangedFileStatus;
}

/**
 * Git worktree operations.
 * All methods use GitCommandRunner with argument arrays — no shell interpolation.
 */
export class WorktreeService {
  constructor(private git: GitCommandRunner = gitCommand) {}

  /**
   * Create a new worktree with a new branch based on baseBranch.
   * Runs: git worktree add -b <branchName> <worktreePath> <baseBranch>
   */
  async createWorktree(
    repoPath: string,
    worktreePath: string,
    branchName: string,
    baseBranch: string
  ): Promise<void> {
    const result = await this.git.run(
      ['worktree', 'add', '-b', branchName, worktreePath, baseBranch],
      { cwd: repoPath }
    );
    if (result.exitCode !== 0) {
      throw Object.assign(
        new Error(`Failed to create worktree: ${result.stderr.trim()}`),
        { status: 500, code: 'GIT_ERROR' }
      );
    }
  }

  /**
   * Remove a worktree.
   * Runs: git worktree remove <worktreePath> [--force]
   */
  async removeWorktree(
    repoPath: string,
    worktreePath: string,
    force?: boolean
  ): Promise<void> {
    const args = ['worktree', 'remove', worktreePath];
    if (force) args.push('--force');

    const result = await this.git.run(args, { cwd: repoPath });
    if (result.exitCode !== 0) {
      throw Object.assign(
        new Error(`Failed to remove worktree: ${result.stderr.trim()}`),
        { status: 500, code: 'GIT_ERROR' }
      );
    }
  }

  /**
   * List all worktrees for a repository.
   * Parses `git worktree list --porcelain` output.
   */
  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    const result = await this.git.run(['worktree', 'list', '--porcelain'], {
      cwd: repoPath,
    });
    if (result.exitCode !== 0) {
      throw Object.assign(
        new Error(`Failed to list worktrees: ${result.stderr.trim()}`),
        { status: 500, code: 'GIT_ERROR' }
      );
    }

    return parseWorktreeListPorcelain(result.stdout);
  }

  /**
   * Delete a branch.
   * Runs: git branch -d/-D <branchName>
   */
  async deleteBranch(
    repoPath: string,
    branchName: string,
    force?: boolean
  ): Promise<void> {
    const flag = force ? '-D' : '-d';
    const result = await this.git.run(['branch', flag, branchName], {
      cwd: repoPath,
    });
    if (result.exitCode !== 0) {
      throw Object.assign(
        new Error(`Failed to delete branch: ${result.stderr.trim()}`),
        { status: 500, code: 'GIT_ERROR' }
      );
    }
  }

  /**
   * Check if a branch exists in the repository.
   */
  async branchExists(repoPath: string, branchName: string): Promise<boolean> {
    const result = await this.git.runSafe(
      ['rev-parse', '--verify', `refs/heads/${branchName}`],
      { cwd: repoPath }
    );
    return result.exitCode === 0;
  }

  /**
   * Get the full diff for a worktree relative to its base branch.
   * Uses `git diff <baseBranch>...HEAD` to show all commits the workspace
   * branch introduces over the base, plus any uncommitted working tree changes.
   * Returns the raw diff string, capped at 1MB.
   */
  async getWorktreeDiff(worktreePath: string, baseBranch = 'main'): Promise<string> {
    // Branch diff: all commits workspace introduces over baseBranch
    const branchDiff = await this.git.run(
      ['diff', `${baseBranch}...HEAD`],
      { cwd: worktreePath }
    );

    // Plus any uncommitted working tree changes (staged + unstaged)
    const [unstaged, staged] = await Promise.all([
      this.git.run(['diff', 'HEAD'], { cwd: worktreePath }),
      this.git.run(['diff', '--cached', 'HEAD'], { cwd: worktreePath }),
    ]);

    if (branchDiff.exitCode !== 0 && unstaged.exitCode !== 0 && staged.exitCode !== 0) {
      throw Object.assign(
        new Error(`Failed to get diff: ${branchDiff.stderr.trim()}`),
        { status: 500, code: 'GIT_ERROR' }
      );
    }

    const combined = [branchDiff.stdout, unstaged.stdout, staged.stdout]
      .filter(Boolean)
      .join('\n');

    // Cap at 1MB
    const MAX_DIFF_BYTES = 1024 * 1024;
    return combined.slice(0, MAX_DIFF_BYTES);
  }

  /**
   * Get list of files changed in the workspace branch relative to baseBranch,
   * plus any uncommitted working tree changes.
   * Uses `git diff --name-status <baseBranch>...HEAD` for committed changes
   * and `git status --porcelain` for uncommitted changes, deduplicating by path.
   */
  async getChangedFiles(worktreePath: string, baseBranch = 'main'): Promise<ChangedFile[]> {
    // Committed branch changes
    const branchResult = await this.git.run(
      ['diff', '--name-status', `${baseBranch}...HEAD`],
      { cwd: worktreePath }
    );

    // Uncommitted working tree changes
    const result = await this.git.run(['status', '--porcelain'], {
      cwd: worktreePath,
    });
    if (result.exitCode !== 0) {
      throw Object.assign(
        new Error(`Failed to list changed files: ${result.stderr.trim()}`),
        { status: 500, code: 'GIT_ERROR' }
      );
    }

    // Parse committed branch changes from `git diff --name-status`
    const branchFiles: ChangedFile[] = branchResult.exitCode === 0
      ? branchResult.stdout
          .split('\n')
          .map((line) => line.trimEnd())
          .filter(Boolean)
          .map(parseDiffNameStatus)
          .filter((f): f is ChangedFile => f !== null)
      : [];

    // Parse uncommitted working tree changes
    const uncommittedFiles: ChangedFile[] = result.stdout
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map(parseChangedFile);

    // Merge, letting uncommitted state override branch state for same path
    const byPath = new Map<string, ChangedFile>();
    for (const f of branchFiles) byPath.set(f.path, f);
    for (const f of uncommittedFiles) byPath.set(f.path, f);

    return Array.from(byPath.values());
  }

  /**
   * Merge a workspace branch into the target branch.
   * Auto-commits any uncommitted changes in the worktree first.
   * On conflict, aborts the merge and returns the conflicted files.
   */
  async mergeWorktreeBranch(
    repoPath: string,
    branch: string,
    targetBranch: string
  ): Promise<{ success: boolean; conflictFiles?: string[] }> {
    // Remember the current branch so we can switch back
    const currentBranchResult = await this.git.run(
      ['branch', '--show-current'],
      { cwd: repoPath }
    );
    const previousBranch = currentBranchResult.stdout.trim();

    // Switch to target branch
    const checkoutResult = await this.git.run(
      ['checkout', targetBranch],
      { cwd: repoPath }
    );
    if (checkoutResult.exitCode !== 0) {
      throw Object.assign(
        new Error(`Failed to checkout ${targetBranch}: ${checkoutResult.stderr.trim()}`),
        { status: 500, code: 'GIT_ERROR' }
      );
    }

    // Attempt merge
    const mergeResult = await this.git.run(
      ['merge', branch, '--no-ff', '-m', `Merge workspace ${branch}`],
      { cwd: repoPath }
    );

    if (mergeResult.exitCode === 0) {
      return { success: true };
    }

    // Merge failed — check for conflicts
    const conflictResult = await this.git.run(
      ['diff', '--name-only', '--diff-filter=U'],
      { cwd: repoPath }
    );

    const conflictFiles = conflictResult.stdout
      .trim()
      .split('\n')
      .filter(Boolean);

    // Abort the merge
    await this.git.run(['merge', '--abort'], { cwd: repoPath });

    // Switch back to previous branch
    if (previousBranch) {
      await this.git.run(['checkout', previousBranch], { cwd: repoPath });
    }

    return { success: false, conflictFiles };
  }
}

/**
 * Parse the porcelain output of `git worktree list --porcelain`.
 * Each worktree block is separated by a blank line.
 */
function parseWorktreeListPorcelain(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const blocks = output.trim().split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.trim().split('\n');
    const info: Partial<WorktreeInfo> = {
      bare: false,
      detached: false,
    };

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        info.worktree = line.slice('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        info.head = line.slice('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        info.branch = line.slice('branch '.length);
      } else if (line === 'bare') {
        info.bare = true;
      } else if (line === 'detached') {
        info.detached = true;
      }
    }

    if (info.worktree) {
      worktrees.push({
        worktree: info.worktree,
        head: info.head || '',
        branch: info.branch || '',
        bare: info.bare!,
        detached: info.detached!,
      });
    }
  }

  return worktrees;
}

function parseChangedFile(line: string): ChangedFile {
  const rawStatus = line.slice(0, 2);
  let path = line.slice(3).trim();

  if (path.includes(' -> ')) {
    path = path.split(' -> ').at(-1) ?? path;
  }

  return {
    path,
    status: normalizeChangedFileStatus(rawStatus),
  };
}

function normalizeChangedFileStatus(rawStatus: string): ChangedFileStatus {
  if (rawStatus === '??') return 'untracked';

  const statusFlags = rawStatus.replaceAll(' ', '');
  if (statusFlags.includes('R')) return 'renamed';
  if (statusFlags.includes('D')) return 'deleted';
  if (statusFlags.includes('A')) return 'added';
  return 'modified';
}

/**
 * Parse a line from `git diff --name-status` output.
 * Format: <status>\t<path>  (or <status>\t<oldPath>\t<newPath> for renames)
 */
function parseDiffNameStatus(line: string): ChangedFile | null {
  const parts = line.split('\t');
  if (parts.length < 2) return null;
  const statusChar = parts[0].charAt(0).toUpperCase();
  const path = parts.length >= 3 ? parts[2] : parts[1]; // use new path for renames
  const statusMap: Record<string, ChangedFileStatus> = {
    M: 'modified',
    A: 'added',
    D: 'deleted',
    R: 'renamed',
  };
  return {
    path,
    status: statusMap[statusChar] ?? 'modified',
  };
}

/** Singleton instance */
export const worktreeService = new WorktreeService();
