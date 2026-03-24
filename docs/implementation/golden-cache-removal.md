# Golden Cache Symlink Architecture Removal

**Date**: 2026-03-24

## Summary

Replaced the golden cache symlink architecture with plain `pnpm install` in each worktree. The golden cache concept is retired — pnpm's built-in content-addressable store (`~/.local/share/pnpm/store/v10`) serves as the natural cache layer.

## What Changed

### `init.sh`
- Removed `GOLDEN_DIR` variable and `install_deps_golden()` function
- Removed all symlink creation logic (`ln -s` from golden to repo `node_modules`)
- Added migration step: removes legacy golden-cache symlinks if present
- Dependencies now installed via `pnpm install --frozen-lockfile` directly in the repo
- Lockfile hash check (`md5` of `pnpm-lock.yaml`) stored in `node_modules/.lock_hash` to skip redundant installs
- Post-merge hook updated to run `pnpm install` instead of `golden-sync.sh`

### `scripts/golden-sync.sh`
- Simplified to a store-warming wrapper (just runs `pnpm install` in the repo root)
- Kept the file so existing worktrees or scripts referencing it don't break

### `CLAUDE.md`
- Removed references to golden cache and symlinks
- Updated dependency description to reflect pnpm's content-addressable store
- Kept `git add -A` warning (good practice regardless)

### `apps/desktop/vite.config.ts`
- No changes needed — no golden cache references found

## Why

- Symlinked `node_modules` caused issues with `git add -A` accidentally committing symlinks
- The golden cache added complexity (separate install location, hash tracking, sync script) for marginal speed gains
- pnpm's store already provides the same caching benefit natively
- Real `node_modules` directories are more compatible with tooling (IDE indexing, Vite, etc.)

## Migration Notes

- Existing `~/.claude-tauri/golden/` directory is left in place — clean up manually if desired
- Next `init.sh` run will automatically remove old symlinks and do a real `pnpm install`
- First install in a fresh worktree takes ~2-5s (warm store) vs previous ~0.5s (symlink), but avoids all symlink-related issues
