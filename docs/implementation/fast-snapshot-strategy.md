# Fast Snapshot Strategy for `init.sh`

## Benchmarks (Actual, This Repo)

| Operation | Time | Notes |
|-----------|------|-------|
| `git worktree add` | **0.26s** | Source files only |
| `pnpm install --frozen-lockfile` (warm store) | **4.2s** | Linking 1,490 packages |
| `bun install` (warm cache) | **1.6s** | Same 1,490 packages |
| APFS `cp -Rc` (full 595MB clone) | **7.0s** | CoW metadata overhead on 53K files |
| `pnpm install` (noop, already installed) | **0.7s** | Resolution skip |

## Key Sizes
- Root `node_modules`: **1.3GB** (53,585 entries)
- Desktop `node_modules`: **46MB** (mostly `.vite` cache)
- Server `node_modules`: **4.4MB**
- Full worktree + deps: **595MB**
- Stale worktrees: **89 worktrees, 22GB** (needs cleanup)

---

## The Winning Strategy: Golden Worktree + Symlinks (<0.5s)

Instead of each worktree running `pnpm install`, maintain a **single "golden" node_modules** at `~/.claude-tauri/golden/` and symlink into new worktrees.

### How It Works

```
~/.claude-tauri/golden/
├── node_modules/           # 1.3GB, fully installed
├── apps/desktop/node_modules/  # 46MB
├── apps/server/node_modules/   # 4.4MB
└── .lockfile-hash          # sha256 of pnpm-lock.yaml
```

### init.sh Fast Path
```bash
# 0.26s - create worktree
git worktree add "$WORKTREE_PATH" -b "agent-$BRANCH" main

# Check golden freshness (compare lockfile hashes)
REPO_HASH=$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)
GOLDEN_HASH=$(cat ~/.claude-tauri/golden/.lockfile-hash 2>/dev/null || echo "none")

if [ "$REPO_HASH" != "$GOLDEN_HASH" ]; then
  # Rare: lockfile changed, rebuild golden (~4.2s)
  scripts/golden-sync.sh
fi

# ~0.01s - symlink (instant)
ln -s ~/.claude-tauri/golden/node_modules ./node_modules
ln -s ~/.claude-tauri/golden/apps/desktop/node_modules ./apps/desktop/node_modules
ln -s ~/.claude-tauri/golden/apps/server/node_modules ./apps/server/node_modules
```

**Total: ~0.3s** (when golden is fresh — the common case)

### Golden Directory Maintenance
- **`scripts/golden-sync.sh`**: Copies lockfile + package.jsons, runs `pnpm install --frozen-lockfile`, writes `.lockfile-hash`
- **`post-merge` git hook**: Runs `golden-sync.sh` in background after merges to main
- **`init.sh` itself**: Checks hash on every run, rebuilds if stale (only ~4.2s, happens rarely)

### When Symlinks Won't Work
If an agent needs to `pnpm add` a dependency (rare), fall back to:
- **Tier 2**: `bun install` (~1.9s total)
- **Tier 3**: `pnpm install --frozen-lockfile` (~4.5s total)

---

## Tier Summary

| Tier | Strategy | Time | When to Use |
|------|----------|------|-------------|
| 1 | Golden symlinks | **<0.5s** | Default for all agents |
| 2 | `bun install` | **~1.9s** | Agent needs writable node_modules |
| 3 | `pnpm install` | **~4.5s** | Conservative fallback |

---

## Additional Optimizations

### Stale Worktree Cleanup
89 worktrees consuming 22GB. Add `scripts/cleanup-worktrees.sh`:
```bash
git worktree list | while read path hash branch; do
  # Remove worktrees older than 7 days with merged branches
done
```

### Shared Vite Cache
Set `cacheDir` in `vite.config.ts` to `~/.claude-tauri/golden/.vite` — avoids re-bundling deps per worktree.

### Persistent Dev Servers (Future)
Long-running servers on main that agents test against. Vite HMR handles frontend changes automatically. Larger architectural change — not needed for MVP.

---

## Per-Scenario

| Scenario | Strategy | Time |
|----------|----------|------|
| Local subagent in worktree | Golden symlinks | <0.5s |
| Local subagent same repo | No init needed | 0s |
| Remote/cloud agent | Docker image with deps baked in | ~2s (pull) |
