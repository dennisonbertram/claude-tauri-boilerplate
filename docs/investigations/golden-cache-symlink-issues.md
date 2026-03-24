# Golden Cache Symlink Architecture: Failure Modes

**Date:** 2026-03-24
**Status:** READ-ONLY investigation
**Triggered by:** `unpdf` failing to resolve its `pdfjs` worker bundle because paths resolved to golden cache instead of worktree

---

## Architecture Summary

The golden cache lives at `~/.claude-tauri/golden/`. The `golden-sync.sh` script:
1. Copies `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, and each workspace's `package.json` into the golden directory
2. Runs `pnpm install` inside `~/.claude-tauri/golden/`
3. Writes a lockfile hash for cache invalidation

Then `init.sh` creates **directory-level symlinks** for three `node_modules` directories:

```
repo/node_modules              -> ~/.claude-tauri/golden/./node_modules
repo/apps/server/node_modules  -> ~/.claude-tauri/golden/apps/server/node_modules
repo/apps/desktop/node_modules -> ~/.claude-tauri/golden/apps/desktop/node_modules
```

These are whole-directory symlinks, not individual package symlinks.

---

## Issue 1: `virtualStoreDir` Points to Stale Worktree (CRITICAL)

**Current state of `~/.claude-tauri/golden/node_modules/.modules.yaml`:**

```yaml
virtualStoreDir: ../../../Develop/claude-tauri-boilerplate/.claude/worktrees/upbeat-mendeleev/node_modules/.pnpm
```

pnpm records the `virtualStoreDir` relative to where `pnpm install` was run. Since `golden-sync.sh` does `cd "$GOLDEN_DIR" && pnpm install`, pnpm resolves symlinks and records the virtual store path relative to the real CWD context. If `golden-sync.sh` was triggered from a worktree (e.g., via the post-merge hook), pnpm may record the worktree path.

**Impact:** If pnpm needs to consult the virtual store (e.g., for peer dependency resolution or `pnpm why`), it follows a path that may not exist or points to the wrong worktree. This is latent corruption -- it works until it doesn't.

---

## Issue 2: `workspace:*` Links Resolve to Stale Worktree (CRITICAL)

**Current state:**

```
~/.claude-tauri/golden/apps/server/node_modules/@claude-tauri/shared
  -> ../../../../../../Develop/claude-tauri-boilerplate/.claude/worktrees/upbeat-mendeleev/packages/shared

~/.claude-tauri/golden/apps/desktop/node_modules/@claude-tauri/shared
  -> ../../../../../../Develop/claude-tauri-boilerplate/.claude/worktrees/upbeat-mendeleev/packages/shared
```

pnpm creates symlinks for `workspace:*` dependencies that point back to the **source directory of the workspace package**. Since the golden was built from (or influenced by) the `upbeat-mendeleev` worktree, these symlinks point there instead of to the actual repo or the consuming worktree.

**Impact:** When a worktree (or the main repo) follows `node_modules/@claude-tauri/shared`, it gets the `shared` package from whichever worktree last built the golden cache. If that worktree has different code (or is deleted), imports of `@claude-tauri/shared` silently resolve to stale or missing code.

**Current status:** The `upbeat-mendeleev` worktree still exists, but its `shared` package source may be out of date relative to the main repo or the consuming worktree.

---

## Issue 3: `__dirname` / `import.meta.url` Path Resolution (HIGH — the `unpdf` bug)

When a package uses `import.meta.url`, `__dirname`, or `new URL('./', import.meta.url)` to locate co-located assets (worker bundles, WASM files, etc.), Node.js resolves these relative to the **real path** of the file, not the symlink path.

For the `unpdf` case:
- Code in the worktree imports `unpdf`
- Node follows symlink: `repo/node_modules/unpdf` -> `~/.claude-tauri/golden/node_modules/unpdf`
- `unpdf` uses `import.meta.url` to find `pdfjs.mjs` worker
- The URL resolves to `file:///Users/.../.claude-tauri/golden/node_modules/unpdf/dist/pdfjs.mjs`
- If the consuming code expects to serve this via a dev server rooted at the repo directory, the path is outside the server's root

**Affected packages in current deps:**
- `unpdf` — confirmed, uses inline pdfjs bundle with path-relative resolution
- `mermaid` — complex package with worker/dynamic imports
- `lightningcss-darwin-arm64` — native `.node` binary (works because Node resolves native modules by real path anyway)
- `@anthropic-ai/claude-agent-sdk` — contains native `.node` binaries for tree-sitter-bash, audio-capture

---

## Issue 4: Vite Cache Contamination (MEDIUM)

Vite writes its dependency pre-bundling cache to `node_modules/.vite/`:

```
~/.claude-tauri/golden/apps/desktop/node_modules/.vite/deps/       (248 entries)
~/.claude-tauri/golden/apps/desktop/node_modules/.vite/deps_temp_*  (stale temp dirs)
```

Since `node_modules` is shared via symlink, **all worktrees and the main repo share the same Vite cache**. This causes:
- Cache invalidation races when multiple worktrees run dev servers simultaneously
- Stale pre-bundled dependencies if one worktree changes deps but another is still running
- Leftover `deps_temp_*` directories from crashed processes

---

## Issue 5: `pnpm add <package>` in a Worktree (HIGH)

When an agent runs `pnpm add <package>` in a worktree:
1. pnpm sees `node_modules` is a symlink to golden
2. pnpm will either:
   - **Overwrite the golden cache** — installing the new package into the shared golden `node_modules`, affecting ALL other worktrees
   - **Replace the symlink** with a real `node_modules` directory (unlikely with pnpm's behavior)
   - **Fail** because the `pnpm-lock.yaml` doesn't match the golden's lockfile hash

After this, `init.sh` on next run will detect the hash mismatch and re-sync golden, potentially losing the newly added package if the lockfile wasn't committed.

**What actually happens:** pnpm modifies the golden `node_modules` in place (since the symlink is transparent to pnpm), contaminating the shared cache.

---

## Issue 6: New Dependencies Without Golden Rebuild (MEDIUM)

If a developer adds a dependency to `package.json` and updates `pnpm-lock.yaml` but doesn't run `golden-sync.sh`:

1. `init.sh` compares lockfile hashes and detects the mismatch
2. It runs `golden-sync.sh` automatically
3. This works correctly **if run from init.sh**

However, if the lockfile is updated but `init.sh` isn't re-run (e.g., agent just does `pnpm install` directly), pnpm writes into the golden cache, and the lockfile hash becomes stale.

---

## Issue 7: pnpm's Own Symlink Layer Conflicts (MEDIUM)

pnpm already uses a symlink-based architecture:
- Packages in `node_modules/` are symlinks to `.pnpm/` virtual store
- The virtual store contains hardlinks to the content-addressable store at `~/Library/pnpm/store/v10`

Adding a third symlink layer (repo `node_modules` -> golden `node_modules`) means:
- `repo/node_modules/react` -> (symlink to golden) -> `golden/node_modules/react` -> (pnpm symlink) -> `golden/node_modules/.pnpm/react@19.2.4/node_modules/react` -> (hardlink) -> `~/Library/pnpm/store/v10/...`

However, in the current golden cache, the `.pnpm` directory only contains `lock.yaml` (no package directories). With `hoistPattern: ['*']`, pnpm hoists all packages directly into `node_modules/` as real directories (or hardlinks to the store), so the virtual store is minimal. This reduces but doesn't eliminate the path resolution issues.

---

## Issue 8: Read-Only Shared State (LOW)

The golden `node_modules` is writable by all consumers. There is no file locking. If two worktrees run `golden-sync.sh` simultaneously (e.g., triggered by post-merge hooks), they can corrupt the golden cache with partial installs.

---

## Summary of Severity

| Issue | Severity | Currently Broken? |
|-------|----------|-------------------|
| virtualStoreDir points to stale worktree | CRITICAL | Yes — latent |
| workspace:* links point to stale worktree | CRITICAL | Yes — active |
| __dirname/import.meta.url resolution (unpdf) | HIGH | Yes — active |
| pnpm add contaminates golden | HIGH | On next occurrence |
| Vite cache shared across worktrees | MEDIUM | Yes — active |
| Lockfile without golden rebuild | MEDIUM | On next occurrence |
| Triple symlink layer | MEDIUM | Latent |
| Concurrent golden-sync race | LOW | On next occurrence |

---

## Recommendations (not implemented — investigation only)

1. **Stop symlinking entire `node_modules` directories.** Instead, run `pnpm install` in each worktree. Use pnpm's content-addressable store (already at `~/Library/pnpm/store/v10`) as the "cache" — pnpm hardlinks from the store, so installs are already fast (~2-3s).

2. **If symlinks must stay**, at minimum:
   - Run `golden-sync.sh` from a stable path (not a worktree)
   - Set `virtualStoreDir` explicitly in `.npmrc` to a path inside golden
   - Move Vite's `cacheDir` to a per-worktree location (e.g., `../../.vite-cache` in vite.config)
   - Document that `pnpm add` must never be run directly — always edit `package.json` + `pnpm-lock.yaml` then re-sync golden

3. **For the `unpdf` / worker bundle issue specifically**: configure Vite's `server.fs.allow` to include the golden cache path, or use `resolve.preserveSymlinks: true` in `vite.config.ts` (though this has other side effects).
