# Runbook: Worktree Workflow

## Why Worktrees?

We never commit directly to main. Every change happens in a worktree branch, gets tested, and only merges to main when tests pass. This keeps main always deployable.

## Workflow

### 1. Start Work
- Agent spawns with `isolation: "worktree"` on the Task tool
- If you create a worktree manually, run `./init.sh` immediately after checkout so the environment is bootstrapped the standard way

### 2. Develop
- Write tests first (TDD)
- Implement the feature/fix
- Run all tests

### 3. Merge
- If all tests pass: merge the worktree branch to main
- If tests fail: fix issues, re-run tests, then merge
- Never merge with failing tests

### 4. Cleanup
- Worktree is automatically cleaned up after merge
- Verify main branch is clean

## Manual Worktree Commands (if needed)

```bash
# Create a worktree
git worktree add .claude/worktrees/my-feature -b feature/my-feature

# Bootstrap it the normal way
cd .claude/worktrees/my-feature
./init.sh

# List worktrees
git worktree list

# Remove a worktree
git worktree remove .claude/worktrees/my-feature

# Merge back to main
git checkout main
git merge feature/my-feature
git branch -d feature/my-feature
```

## Troubleshooting

- **Worktree already exists**: Remove the old one first with `git worktree remove`
- **Merge conflicts**: Resolve manually, run tests, then complete merge
- **Orphaned worktrees**: Run `git worktree prune` to clean up
