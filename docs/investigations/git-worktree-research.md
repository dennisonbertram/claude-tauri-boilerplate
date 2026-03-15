# Git Worktree Research

Comprehensive research on git worktrees: how they work, programmatic management from Node.js/TypeScript, multi-instance patterns, and integration with the Claude Agent SDK.

---

## Table of Contents

1. [How Git Worktrees Work](#1-how-git-worktrees-work)
2. [Programmatic Worktree Management](#2-programmatic-worktree-management)
3. [Multi-Instance Patterns](#3-multi-instance-patterns)
4. [Claude Agent SDK and Worktrees](#4-claude-agent-sdk-and-worktrees)
5. [Practical Architecture for claude-tauri-boilerplate](#5-practical-architecture-for-claude-tauri-boilerplate)

---

## 1. How Git Worktrees Work

### Core Concept

A git repository normally has one working tree. `git worktree` lets you create additional working trees, each checked out to a different branch. All worktrees share the same `.git` object store, refs, and history -- but each has its own `HEAD`, `index` (staging area), and working directory.

This means you can have `main`, `feature-auth`, and `bugfix-123` all checked out simultaneously in different directories, editing and committing in each without switching branches.

### Commands

#### `git worktree add <path> [<commit-ish>]`

Creates a new worktree at `<path>`.

```bash
# Create worktree with auto-created branch (named after directory)
git worktree add ../hotfix

# Checkout existing branch in new worktree
git worktree add ../feature feature-branch

# Create new branch from a specific commit
git worktree add -b new-fix ../temp master

# Detached HEAD (no branch)
git worktree add -d ../experiment
```

Key flags:
- `-b <branch>` / `-B <branch>` -- Create new branch (fails if exists / resets if exists)
- `-d` / `--detach` -- Detached HEAD
- `--no-checkout` -- Skip checkout (useful for sparse-checkout setup)
- `--lock` -- Lock the worktree immediately after creation
- `-f` / `--force` -- Override the "branch already checked out" safety

#### `git worktree list`

Shows all worktrees with their paths, commits, and branches.

```bash
$ git worktree list
/path/to/main          abc1234 [main]
/path/to/hotfix        def5678 [hotfix]
/path/to/experiment    ghi9012 (detached HEAD)
```

Add `--porcelain` for machine-parseable output (one field per line, blank line between records):

```bash
$ git worktree list --porcelain
worktree /path/to/main
HEAD abc1234abc1234abc1234abc1234abc1234abc1234
branch refs/heads/main

worktree /path/to/hotfix
HEAD def5678def5678def5678def5678def5678def5678
branch refs/heads/hotfix
```

#### `git worktree remove <worktree>`

Deletes the working tree and its metadata. Only removes clean worktrees by default (no untracked files, no uncommitted changes). Use `-f` to force removal of dirty worktrees, `-f -f` for locked worktrees.

```bash
git worktree remove ../hotfix
git worktree remove --force ../dirty-worktree
```

#### `git worktree lock/unlock`

Prevents a worktree from being auto-pruned. Useful for worktrees on external drives or network shares that aren't always mounted.

```bash
git worktree lock --reason "on external drive" ../hotfix
git worktree unlock ../hotfix
```

#### `git worktree prune`

Cleans up stale metadata in `$GIT_DIR/worktrees/` for worktrees that were deleted manually (without `git worktree remove`).

```bash
git worktree prune --dry-run   # Preview what would be cleaned
git worktree prune --verbose   # Clean and report
```

#### `git worktree move <worktree> <new-path>`

Moves a worktree to a different location. Cannot move the main worktree or worktrees with submodules.

#### `git worktree repair`

Fixes broken links after manually moving worktrees or the main repository.

### How Worktrees Share the .git Directory

This is the critical internal detail. The structure looks like:

```
main-repo/
├── .git/                        # Full git directory (main worktree owns this)
│   ├── objects/                  # SHARED: all git objects (commits, trees, blobs)
│   ├── refs/                    # SHARED: branches, tags, remotes
│   ├── config                   # SHARED: repository config
│   ├── HEAD                     # Main worktree's HEAD only
│   ├── index                    # Main worktree's staging area only
│   └── worktrees/               # Metadata for linked worktrees
│       ├── hotfix/
│       │   ├── HEAD             # hotfix worktree's HEAD
│       │   ├── index            # hotfix worktree's staging area
│       │   ├── gitdir           # Points back: "/path/to/hotfix/.git"
│       │   └── logs/            # hotfix worktree's reflog
│       └── experiment/
│           ├── HEAD
│           ├── index
│           ├── gitdir
│           └── logs/
└── [working tree files]

hotfix-worktree/
├── .git                         # FILE, not directory!
│   └── (contents: "gitdir: /path/to/main-repo/.git/worktrees/hotfix")
└── [working tree files]
```

**What's shared across all worktrees:**
- Object store (`objects/`) -- all commits, trees, blobs
- References (`refs/heads/`, `refs/tags/`, `refs/remotes/`)
- Repository config (unless `extensions.worktreeConfig` is enabled)
- Hooks (`hooks/`)

**What's per-worktree (independent):**
- `HEAD` -- each worktree tracks its own current branch/commit
- `index` -- each worktree has its own staging area
- `logs/` -- reflog is per-worktree
- Refs under `refs/bisect/`, `refs/worktree/`, `refs/rewritten/`

**Key environment variables in a linked worktree:**
- `$GIT_DIR` = `/path/main/.git/worktrees/<name>` (private metadata)
- `$GIT_COMMON_DIR` = `/path/main/.git` (shared repository)

### Branch Uniqueness Constraint

**A branch can only be checked out in one worktree at a time.** This is the most important constraint.

```bash
# If main worktree is on 'main':
$ git worktree add ../other main
fatal: 'main' is already checked out at '/path/to/main-repo'

# Must create a new branch or use -f (dangerous):
$ git worktree add -b feature ../other main   # OK: new branch from main
$ git worktree add -f ../other main            # DANGEROUS: forces shared checkout
```

This constraint exists because two worktrees on the same branch with independent staging areas would create confusing states where commits in one worktree silently change the branch pointer for the other.

### Lifecycle

1. **Create:** `git worktree add` creates the directory, writes the `.git` file, and creates metadata in `$GIT_DIR/worktrees/`.
2. **Use:** Normal git operations work. Commits, branches (other than the current one), tags, and remote operations all work normally.
3. **Remove properly:** `git worktree remove` deletes both the working directory and the metadata.
4. **Remove improperly:** If you `rm -rf` a worktree directory, the metadata in `$GIT_DIR/worktrees/` becomes stale. Run `git worktree prune` to clean it up.

### Limitations and Gotchas

1. **Branch uniqueness:** Each branch can only be checked out in one worktree. This is the biggest operational constraint.
2. **Submodules:** Multiple worktrees with submodules is experimental and not recommended. Moving worktrees with submodules is unsupported.
3. **Shared hooks:** Git hooks are shared across all worktrees (they live in `$GIT_COMMON_DIR/hooks/`). A pre-commit hook runs the same way in every worktree.
4. **Shared config:** By default, `.git/config` is shared. Enable `extensions.worktreeConfig` for per-worktree config (stored in `config.worktree` files).
5. **Stale metadata:** If you manually delete a worktree directory (instead of `git worktree remove`), the metadata remains. Always use `git worktree remove` or run `prune` afterward.
6. **Absolute paths by default:** Worktree links use absolute paths. Moving the main repo or worktrees without using `git worktree move` breaks the links. Use `worktree.useRelativePaths` (Git 2.52+) for portability, or `git worktree repair` to fix broken links.
7. **Lock management:** Locked worktrees cannot be pruned, moved, or removed without double-`-f`. Forgetting to unlock a worktree on an unmounted drive will prevent cleanup.

---

## 2. Programmatic Worktree Management

### Option A: Shell Out to Git (Recommended)

The simplest and most reliable approach. Git worktree commands are stable, well-documented, and output is parseable.

```typescript
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Create a worktree
async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string
): Promise<void> {
  await execAsync(
    `git worktree add -b ${branchName} ${worktreePath}`,
    { cwd: repoPath }
  );
}

// List worktrees (machine-parseable)
async function listWorktrees(repoPath: string): Promise<Worktree[]> {
  const { stdout } = await execAsync(
    'git worktree list --porcelain',
    { cwd: repoPath }
  );
  return parseWorktreeOutput(stdout);
}

// Remove a worktree
async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force = false
): Promise<void> {
  const forceFlag = force ? '--force' : '';
  await execAsync(
    `git worktree remove ${forceFlag} ${worktreePath}`,
    { cwd: repoPath }
  );
}

// Parse porcelain output
function parseWorktreeOutput(output: string): Worktree[] {
  const worktrees: Worktree[] = [];
  const blocks = output.trim().split('\n\n');

  for (const block of blocks) {
    const lines = block.split('\n');
    const wt: Partial<Worktree> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) wt.path = line.slice(9);
      else if (line.startsWith('HEAD ')) wt.head = line.slice(5);
      else if (line.startsWith('branch ')) wt.branch = line.slice(7);
      else if (line === 'detached') wt.detached = true;
      else if (line === 'bare') wt.bare = true;
      else if (line.startsWith('locked')) wt.locked = true;
      else if (line.startsWith('prunable')) wt.prunable = true;
    }

    if (wt.path) worktrees.push(wt as Worktree);
  }

  return worktrees;
}

interface Worktree {
  path: string;
  head: string;
  branch?: string;
  detached?: boolean;
  bare?: boolean;
  locked?: boolean;
  prunable?: boolean;
}
```

**Detecting if a directory is a worktree vs. a regular repo:**

```typescript
import { stat, readFile } from 'fs/promises';
import { join } from 'path';

async function isWorktree(dirPath: string): Promise<boolean> {
  const gitPath = join(dirPath, '.git');
  const stats = await stat(gitPath);

  if (stats.isFile()) {
    // .git is a FILE => this is a linked worktree
    const content = await readFile(gitPath, 'utf-8');
    return content.trim().startsWith('gitdir:');
  }

  // .git is a directory => this is the main worktree (or a regular repo)
  return false;
}

// Or use git commands:
async function getWorktreeInfo(dirPath: string) {
  const { stdout: gitDir } = await execAsync(
    'git rev-parse --git-dir',
    { cwd: dirPath }
  );
  const { stdout: commonDir } = await execAsync(
    'git rev-parse --git-common-dir',
    { cwd: dirPath }
  );

  // If git-dir !== git-common-dir, this is a linked worktree
  const isLinked = gitDir.trim() !== commonDir.trim();
  return { gitDir: gitDir.trim(), commonDir: commonDir.trim(), isLinked };
}
```

### Option B: simple-git

[simple-git](https://github.com/steveukx/git-js) is the most popular Node.js git library (~1.6M weekly downloads). However, it does **not** have dedicated worktree methods. You must use `.raw()` to execute worktree commands:

```typescript
import simpleGit from 'simple-git';

const git = simpleGit('/path/to/repo');

// Create worktree via raw command
await git.raw(['worktree', 'add', '-b', 'my-branch', '../my-worktree']);

// List worktrees
const output = await git.raw(['worktree', 'list', '--porcelain']);

// Remove worktree
await git.raw(['worktree', 'remove', '../my-worktree']);
```

Since you're just calling `.raw()`, there's minimal benefit over shelling out directly. simple-git does add value for other git operations (branches, commits, diffs), so if you're already using it for those, `.raw()` for worktrees keeps things consistent.

### Option C: git-worktree npm package

[git-worktree](https://github.com/alexweininger/git-worktree) is a small TypeScript wrapper specifically for worktree operations. Low adoption (3 stars, 24 commits) but focused on this exact use case.

```typescript
import { WorktreeClient } from 'git-worktree';

const client = new WorktreeClient(process.cwd());
const worktrees = await client.list();
```

The API surface is limited -- essentially just `list()` is documented. For a production system, shelling out directly gives you more control and reliability.

### Option D: isomorphic-git

[isomorphic-git](https://isomorphic-git.org/) is a pure JavaScript git implementation that works in Node.js and browsers. It does **not** support worktrees. It reimplements git operations from scratch rather than wrapping the git binary, and worktree support is not part of its feature set.

### Recommendation

**Shell out to `git worktree` commands.** The reasons:

1. Git's worktree implementation is mature and stable.
2. The porcelain output format is designed for machine parsing.
3. No dependency overhead -- git is already required.
4. All edge cases (locks, pruning, repair) are handled by git itself.
5. TypeScript wrapper functions are trivial to write (see Option A above).

---

## 3. Multi-Instance Patterns

### Running Separate Processes in Different Worktrees

Each worktree is a fully functional checkout. You can run any process in any worktree by setting the working directory:

```typescript
import { spawn } from 'child_process';

// Run a dev server in worktree 1
const server1 = spawn('npm', ['run', 'dev'], {
  cwd: '/path/to/worktree-feature-auth',
  stdio: 'pipe'
});

// Run tests in worktree 2
const server2 = spawn('npm', ['test'], {
  cwd: '/path/to/worktree-bugfix-123',
  stdio: 'pipe'
});
```

### Process Isolation Considerations

**What IS isolated between worktrees:**
- Working directory files (each worktree has its own copy)
- Git staging area (independent indexes)
- Git HEAD (independent branch pointers)
- Any process-local state (each process has its own memory)

**What is NOT isolated:**
- Git object store (shared -- commits from one worktree are visible in all)
- Git branches and tags (shared -- creating a branch in one worktree makes it available in all)
- `node_modules/` -- each worktree needs its own `npm install` since `node_modules` is in the working tree, not in `.git`
- Ports -- if two worktrees run servers, they need different ports
- Database files -- if the database is outside the repo (e.g., `~/.app/data.db`), it's shared
- Environment variables -- shared via the shell environment

**Critical: `node_modules` and dependencies.**
Each worktree starts as a fresh checkout. It does not copy `node_modules/`. You must run `npm install` (or `pnpm install`) in each worktree before running code. For monorepos with `pnpm workspaces`, this means running `pnpm install` at the worktree root.

### How IDEs Handle Worktrees

**VS Code** (as of July 2025):
- Native worktree support via Source Control UI
- Create, list, and switch worktrees from the Command Palette
- `Git: Open Worktree in New Window` opens a separate VS Code window pointing at the worktree
- Each window is fully independent (own terminal, own file tree, own git status)
- `git.detectWorktrees` setting enables automatic worktree detection
- Can compare files across worktrees and migrate changes between them

**JetBrains IDEs:**
- Support opening worktrees as separate projects
- Git UI shows worktree relationships

**Pattern:** IDEs treat each worktree as a separate project/window. They don't try to merge multiple worktrees into a single view. This is the correct approach -- each worktree is a separate working context.

---

## 4. Claude Agent SDK and Worktrees

### The `cwd` Option

The `query()` function accepts a `cwd` option that sets the working directory for the Claude session:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: "Fix the auth bug",
  options: {
    cwd: '/path/to/worktree-bugfix',  // Claude operates in this directory
    allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
  }
});
```

**What `cwd` controls:**
- Where file operations (Read, Write, Edit, Glob, Grep) are rooted
- Where Bash commands execute
- Where the SDK looks for `.claude/` settings when `settingSources` includes `"project"`
- Where the SDK looks for `CLAUDE.md` files
- Where session files are stored (under `~/.claude/projects/<encoded-cwd>/`)

### Running Multiple SDK Instances in Different Worktrees

Each `query()` call spawns a separate Claude Code process. You can run multiple `query()` calls concurrently, each with a different `cwd` pointing to a different worktree:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Session 1: Auth feature in worktree 1
const session1 = query({
  prompt: "Implement OAuth2 provider",
  options: {
    cwd: '/project/.claude/worktrees/feature-auth',
    allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
  }
});

// Session 2: Bug fix in worktree 2 (runs concurrently)
const session2 = query({
  prompt: "Fix the rate limiting bug",
  options: {
    cwd: '/project/.claude/worktrees/bugfix-ratelimit',
    allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
  }
});

// Process both streams concurrently
await Promise.all([
  processStream(session1),
  processStream(session2),
]);
```

**This works because:**
1. Each `query()` spawns an independent Claude Code subprocess.
2. Each subprocess operates in its own `cwd` (the worktree directory).
3. File edits in one worktree don't affect the other.
4. Git operations in one worktree don't conflict with the other (different branches, different indexes).
5. Sessions are stored separately (different `<encoded-cwd>` paths).

### Session Storage with Worktrees

Sessions are stored at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`, where `<encoded-cwd>` replaces every non-alphanumeric character in the absolute path with `-`.

For worktrees:
- Main repo at `/Users/me/project` stores sessions at `~/.claude/projects/-Users-me-project/`
- Worktree at `/Users/me/project/.claude/worktrees/feature` stores at `~/.claude/projects/-Users-me-project-.claude-worktrees-feature/`

The `listSessions()` function has an `includeWorktrees` option (default: `true`) that, when the `dir` is inside a git repository, also returns sessions from all worktree paths:

```typescript
import { listSessions } from '@anthropic-ai/claude-agent-sdk';

// Lists sessions from the main repo AND all worktrees
const sessions = await listSessions({
  dir: '/path/to/project',
  includeWorktrees: true  // default
});
```

### How Claude Code CLI Uses Worktrees

Claude Code CLI supports worktrees natively via the `--worktree` flag:

```bash
# Create a named worktree session
claude --worktree feature-auth

# Auto-named worktree
claude --worktree
```

This creates a worktree at `.claude/worktrees/<name>/` with branch `worktree-<name>`.

The CLI also supports worktree isolation for subagents. When agents are spawned with `isolation: "worktree"`, each gets its own worktree. Custom agents can declare worktree isolation in their frontmatter:

```yaml
isolation: worktree
```

### What the SDK Does Not Provide

The SDK does not have built-in worktree management. There is no `createWorktree()` or `removeWorktree()` function in the SDK. You must:

1. Create worktrees yourself (via git commands)
2. Run `npm install` / `pnpm install` in each worktree
3. Pass the worktree path as `cwd` to `query()`
4. Clean up worktrees yourself when done

The SDK's `cwd` option is the bridge -- it makes the SDK instance operate in the worktree directory, but it doesn't know or care that it's a worktree specifically. It just uses it as a working directory.

---

## 5. Practical Architecture for claude-tauri-boilerplate

### Proposed Worktree Management Flow

For the desktop app, worktree management would be a server-side concern (in the Hono sidecar), exposed via API endpoints:

```
POST   /api/worktrees           Create a new worktree
GET    /api/worktrees           List all worktrees
DELETE /api/worktrees/:name     Remove a worktree
POST   /api/worktrees/:name/install  Run pnpm install in worktree
```

### Implementation Approach

```typescript
// apps/server/src/services/worktree.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string | null;
  isDetached: boolean;
  isMain: boolean;
}

export async function createWorktree(
  projectRoot: string,
  name: string,
  baseBranch = 'HEAD'
): Promise<WorktreeInfo> {
  const worktreePath = join(projectRoot, '.claude', 'worktrees', name);
  const branchName = `worktree-${name}`;

  await execAsync(
    `git worktree add -b "${branchName}" "${worktreePath}" "${baseBranch}"`,
    { cwd: projectRoot }
  );

  // Install dependencies
  await execAsync('pnpm install', { cwd: worktreePath });

  return {
    path: worktreePath,
    head: '', // Would parse from git
    branch: `refs/heads/${branchName}`,
    isDetached: false,
    isMain: false,
  };
}

export async function listWorktrees(projectRoot: string): Promise<WorktreeInfo[]> {
  const { stdout } = await execAsync(
    'git worktree list --porcelain',
    { cwd: projectRoot }
  );
  return parseWorktreeOutput(stdout);
}

export async function removeWorktree(
  projectRoot: string,
  name: string,
  force = false
): Promise<void> {
  const worktreePath = join(projectRoot, '.claude', 'worktrees', name);
  const branchName = `worktree-${name}`;
  const forceFlag = force ? '--force' : '';

  // Remove worktree
  await execAsync(
    `git worktree remove ${forceFlag} "${worktreePath}"`,
    { cwd: projectRoot }
  );

  // Delete the branch (it's no longer needed)
  try {
    await execAsync(
      `git branch -D "${branchName}"`,
      { cwd: projectRoot }
    );
  } catch {
    // Branch might not exist or might have been merged already
  }
}
```

### Running Claude SDK Sessions in Worktrees

Each chat session in the app could optionally target a specific worktree:

```typescript
// In the chat route handler
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: userMessage,
  options: {
    cwd: worktreePath ?? projectRoot,  // Use worktree if specified
    resume: sessionId,
    includePartialMessages: true,
  }
});
```

The frontend would need:
- A worktree selector in the UI (which worktree is this session operating in?)
- Visual indication of which worktree a session belongs to
- Controls to create/delete worktrees

### Key Design Decisions

1. **Worktree storage location:** `.claude/worktrees/` within the project root (matches Claude Code CLI convention). Add to `.gitignore`.

2. **Branch naming:** `worktree-<name>` prefix (matches Claude Code CLI convention).

3. **Dependency installation:** Must run `pnpm install` in each new worktree. This is slow but necessary. Consider caching `node_modules` or using `pnpm`'s content-addressable store to speed this up.

4. **Port conflicts:** If worktrees run dev servers, each needs unique ports. The server should assign ports dynamically or let the user configure them.

5. **Database isolation:** The SQLite database at `~/.claude-tauri/data.db` is shared across all worktrees. Session records should include a `worktree` field to track which worktree they belong to.

6. **Cleanup on session end:** When a worktree session ends with no uncommitted changes, offer to auto-remove the worktree (matches Claude Code CLI behavior).

---

## Sources

- [Git Worktree Official Documentation](https://git-scm.com/docs/git-worktree)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Agent SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Claude Agent SDK Claude Code Features](https://platform.claude.com/docs/en/agent-sdk/claude-code-features)
- [Claude Code Worktree Guide](https://claudefa.st/blog/guide/development/worktree-guide)
- [VS Code Git Worktrees](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees)
- [simple-git npm package](https://github.com/steveukx/git-js)
- [git-worktree npm package](https://github.com/alexweininger/git-worktree)
- [isomorphic-git](https://isomorphic-git.org/)
- [Practical Guide to Git Worktree (DEV Community)](https://dev.to/yankee/practical-guide-to-git-worktree-58o0)
- [Using Git Worktrees for Concurrent Development (Ken Muse)](https://www.kenmuse.com/blog/using-git-worktrees-for-concurrent-development/)
