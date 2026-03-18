import { Hono } from 'hono';
import type { GitStatus, GitDiff, GitFileStatus } from '@claude-tauri/shared';

/**
 * Run a git command and return stdout as a string.
 * Returns null if the command fails (e.g., not a git repo).
 */
async function runGit(
  args: string[],
  cwd?: string
): Promise<{ stdout: string; exitCode: number }> {
  try {
    const proc = Bun.spawn(['git', ...args], {
      cwd: cwd || process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    return { stdout: stdout.trim(), exitCode };
  } catch {
    return { stdout: '', exitCode: 1 };
  }
}

/**
 * Parse git status --porcelain=v1 output into structured file statuses.
 */
function parseStatusLine(line: string): {
  staged: GitFileStatus | null;
  unstaged: GitFileStatus | null;
} {
  if (line.length < 4) return { staged: null, unstaged: null };

  const indexStatus = line[0];
  const workTreeStatus = line[1];
  const filePath = line.slice(3);

  let staged: GitFileStatus | null = null;
  let unstaged: GitFileStatus | null = null;

  // Index (staged) status
  if (indexStatus !== ' ' && indexStatus !== '?') {
    staged = {
      path: filePath,
      status: mapStatusChar(indexStatus),
    };
  }

  // Work tree (unstaged) status
  if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
    unstaged = {
      path: filePath,
      status: mapStatusChar(workTreeStatus),
    };
  }

  // Untracked files (both chars are ?)
  if (indexStatus === '?' && workTreeStatus === '?') {
    unstaged = {
      path: filePath,
      status: 'untracked',
    };
  }

  return { staged, unstaged };
}

function mapStatusChar(
  char: string
): GitFileStatus['status'] {
  switch (char) {
    case 'M':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    default:
      return 'modified';
  }
}

export function createGitRouter() {
  const gitRouter = new Hono();

  gitRouter.get('/status', async (c) => {
    const cwd = c.req.query('cwd');

    // Get current branch
    const branchResult = await runGit(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      cwd
    );

    if (branchResult.exitCode !== 0) {
      const status: GitStatus = {
        branch: '',
        isClean: true,
        modifiedFiles: [],
        stagedFiles: [],
        error: 'Not a git repository',
      };
      return c.json(status);
    }

    // Get file statuses
    const statusResult = await runGit(
      ['status', '--porcelain=v1'],
      cwd
    );

    const modifiedFiles: GitFileStatus[] = [];
    const stagedFiles: GitFileStatus[] = [];

    if (statusResult.stdout) {
      const lines = statusResult.stdout.split('\n');
      for (const line of lines) {
        if (!line) continue;
        const { staged, unstaged } = parseStatusLine(line);
        if (staged) stagedFiles.push(staged);
        if (unstaged) modifiedFiles.push(unstaged);
      }
    }

    const isClean = modifiedFiles.length === 0 && stagedFiles.length === 0;
    const pullRebaseResult = await runGit(['config', '--get', 'pull.rebase'], cwd);
    const pullRebaseValue = pullRebaseResult.stdout.trim().toLowerCase();
    const pullRebase =
      pullRebaseResult.exitCode === 0
        ? pullRebaseValue === 'true' || pullRebaseValue === 'interactive'
        : null;

    const status: GitStatus = {
      branch: branchResult.stdout,
      isClean,
      modifiedFiles,
      stagedFiles,
      pullRebase,
    };

    return c.json(status);
  });

  gitRouter.get('/diff', async (c) => {
    const cwd = c.req.query('cwd');

    // Check if we're in a git repo first
    const checkResult = await runGit(['rev-parse', '--git-dir'], cwd);
    if (checkResult.exitCode !== 0) {
      const diff: GitDiff = {
        diff: '',
        error: 'Not a git repository',
      };
      return c.json(diff);
    }

    // Get combined diff (staged + unstaged)
    const diffResult = await runGit(['diff', 'HEAD'], cwd);

    // If HEAD doesn't exist yet (empty repo), try just `git diff`
    let diffOutput = diffResult.stdout;
    if (diffResult.exitCode !== 0) {
      const fallback = await runGit(['diff'], cwd);
      diffOutput = fallback.stdout;
    }

    const diff: GitDiff = {
      diff: diffOutput,
    };

    return c.json(diff);
  });

  return gitRouter;
}
