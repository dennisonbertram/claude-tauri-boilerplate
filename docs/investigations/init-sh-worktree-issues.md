# init.sh Worktree Investigation

**Date:** 2026-03-23

## What init.sh Does

`init.sh` is a zero-effort dev environment bootstrap script that:

1. **Port allocation** -- picks random free ports (server 3100-3999, frontend 1400-1999) unless pinned via `INIT_SERVER_PORT` / `INIT_VITE_PORT`
2. **Prerequisites check** -- verifies node, bun, pnpm are installed
3. **Environment detection** -- local vs cloud; unsets `ANTHROPIC_API_KEY` in local mode
4. **`.env` creation** -- copies `.env.example` if `.env` is missing
5. **Dependencies** -- symlinks `node_modules` from golden directory (`~/.claude-tauri/golden/`) or falls back to `pnpm install`
6. **Starts backend** -- `bun --watch apps/server/src/index.ts` with `PORT` and `VITE_PORT` env vars
7. **Starts frontend** -- `npx vite --port $VITE_PORT --strictPort false`
8. **Health checks** -- polls both services until ready
9. **Writes `.init-state`** -- exports `SERVER_URL`, `FRONTEND_URL`, `HEALTH_CHECK`, PIDs
10. **Daemonize mode** -- `INIT_DAEMONIZE=1` disowns processes and exits; otherwise blocks on `wait`
11. **Post-merge hook** -- installs a git hook to auto-refresh golden on lockfile changes

## Identified Issues

### Issue 1: `.env` File Overrides Random Port with Hardcoded 3131

**Severity: HIGH**

When `.env` does not exist, `init.sh` copies `.env.example` which contains `PORT=3131`. The server reads `process.env.PORT` at startup (line 14 of `index.ts`). However, `init.sh` passes `PORT` as an env var inline on the `bun` command (line 211), which takes precedence over the `.env` file.

The risk: if Bun or the server loads `.env` automatically (Bun does load `.env` by default), the `.env` value could shadow the inline env var depending on load order. Currently it works because inline env vars take precedence over `.env` in Bun, but this is fragile and confusing.

**Recommendation:** Either remove `PORT=3131` from `.env.example` or replace it with a comment. The init script should be the single source of truth for the port.

### Issue 2: Vite Config Has `strictPort: true` and Hardcoded Port 1420

**Severity: HIGH**

`apps/desktop/vite.config.ts` has:
```ts
port: 1420,
strictPort: true,
```

`init.sh` launches vite with `--port $VITE_PORT --strictPort false`, which overrides the config file. This works, but:
- If an agent runs `pnpm dev` directly (the `package.json` script), it gets port 1420 with `strictPort: true` -- it will fail if 1420 is occupied
- The `package.json` dev script is `"lsof -ti :1420 | xargs kill 2>/dev/null; vite"` -- it **kills whatever is on port 1420**, which could be another worktree's frontend

**Recommendation:** Make `vite.config.ts` read from `VITE_API_PORT` or another env var, and remove the kill command from `package.json`.

### Issue 3: CORS Whitelist Uses Dynamic Port but Tauri CSP Is Hardcoded

**Severity: MEDIUM**

The server CORS config dynamically uses `VITE_PORT` env var (line 44-48 of `app.ts`):
```ts
const vitePort = process.env.VITE_PORT || '1420';
origin: [`http://localhost:${vitePort}`, 'tauri://localhost'],
```

This works correctly for init.sh-launched servers. However, `tauri.conf.json` has a hardcoded CSP:
```
connect-src ipc: http://ipc.localhost http://localhost:3131
```

If the server runs on a different port, Tauri's CSP would block connections. This only matters when running the Tauri desktop app (not browser dev mode), but is a latent issue.

### Issue 4: Post-Merge Hook Fails Silently in Worktrees

**Severity: MEDIUM**

Lines 263-275 check for `$SCRIPT_DIR/.git/hooks/`. In a git worktree, `.git` is a **file** (not a directory) containing a `gitdir:` pointer. There is no `.git/hooks/` directory in a worktree -- hooks live in the main repo's `.git/worktrees/<name>/`. The `[ -d "$SCRIPT_DIR/.git/hooks" ]` check silently fails, so the post-merge hook is never installed in worktrees.

This is low-impact since golden sync is triggered on every `init.sh` run anyway, but the hook installation logic is technically broken for worktrees.

**Recommendation:** Use `git rev-parse --git-common-dir` to find the hooks directory.

### Issue 5: Golden Sync Race Condition with Parallel Worktrees

**Severity: MEDIUM**

If two worktrees run `init.sh` simultaneously and both detect a stale golden directory, they both call `golden-sync.sh`. This runs `pnpm install` in the shared `~/.claude-tauri/golden/` directory concurrently, which can corrupt `node_modules`.

The existing test results show this scenario did not occur during testing, but it is a real possibility with parallel agents.

**Recommendation:** Add a lockfile mechanism (e.g., `flock` or a `.lock` file with PID check) in `golden-sync.sh`.

### Issue 6: Symlinks Point to Absolute Golden Path

**Severity: LOW**

The symlinks created at `./node_modules`, `./apps/desktop/node_modules`, `./apps/server/node_modules` all point to the absolute golden path (`~/.claude-tauri/golden/*/node_modules`). This is correct behavior -- all worktrees share the same golden cache. However:

- If the golden directory is rebuilt while a worktree's server is running, the running processes could see inconsistent module state
- The `CLAUDE.md` warning about `git add -A` / `git add .` is critical -- these symlinks would be committed and break CI

### Issue 7: `init.sh stop` Only Kills by PID, Not by Port

**Severity: LOW**

The stop command reads PIDs from `.init-state` and kills them. If the process has already died and a different process now has that PID, it would kill the wrong process. This is a standard PID-file race condition.

Also, if `.init-state` is deleted or corrupted, there is no way to discover and kill orphaned processes except by port scanning.

**Recommendation:** Consider also checking port ownership before killing, or using process groups.

### Issue 8: Runbook Troubleshooting Section References Old Behavior

**Severity: LOW**

The runbook says: "`init.sh` auto-kills processes on ports 3131 and 1420." This is no longer true -- the current init.sh uses random ports and does NOT auto-kill anything on startup. The troubleshooting advice is stale.

### Issue 9: Test Files Have Hardcoded `localhost:3131` and `localhost:1420`

**Severity: LOW (tests only)**

Many test files in both `apps/desktop` and `apps/server` hardcode `http://localhost:3131` and `http://localhost:1420`. These work because tests mock fetch/use their own test servers, but if tests ever run against a live dev server, the hardcoded ports would cause failures.

## Agent-Specific Confusion Points

1. **Agents may run `pnpm dev` instead of `init.sh`** -- the `package.json` dev script kills port 1420 and starts with hardcoded ports, which conflicts with other worktrees.

2. **Agents may not source `.init-state`** -- if an agent runs `init.sh` but forgets to `source .init-state`, it won't know what ports were allocated and may default to 3131/1420.

3. **The `.env` file with `PORT=3131` is confusing** -- agents reading `.env` would think the server is on 3131, when in worktrees it's on a random port.

4. **`INIT_DAEMONIZE` mode requires a two-step pattern** -- agents must run `INIT_DAEMONIZE=1 ./init.sh && source .init-state`, not just `./init.sh`. If they run without `INIT_DAEMONIZE`, the script blocks forever on `wait`.

5. **No validation that allocated ports are still free by the time the server starts** -- there is a TOCTOU gap between `find_free_port` and the actual `bun` / `vite` bind, though this is unlikely to cause issues in practice.

## Summary of Recommendations

| Priority | Issue | Fix |
|----------|-------|-----|
| HIGH | `.env.example` has `PORT=3131` | Remove or comment out `PORT=` line |
| HIGH | `vite.config.ts` hardcodes port 1420 with `strictPort: true` | Read port from env var |
| HIGH | `package.json` dev script kills port 1420 | Remove the kill command |
| MEDIUM | Golden sync has no locking | Add flock/lockfile to `golden-sync.sh` |
| MEDIUM | Post-merge hook broken in worktrees | Use `git rev-parse --git-common-dir` |
| MEDIUM | Tauri CSP hardcodes port 3131 | Parameterize or widen CSP in dev |
| LOW | Runbook has stale troubleshooting info | Update the auto-kill reference |
| LOW | Stop command has PID reuse risk | Cross-check port ownership |
