# init.sh & .env Single Source of Truth Fixes

## Problem
Ports were configured in multiple places (.env.example hardcoded `PORT=3131`, init.sh picked random ports, desktop package.json killed port 1420), creating conflicts and confusion about which value was authoritative.

## Changes Made

### 1. `.env.example` — removed hardcoded PORT
- Removed `PORT=3131` line; replaced with a comment explaining ports are set dynamically by init.sh.

### 2. `init.sh` — writes dynamic ports INTO .env
- After port selection and .env creation, init.sh now strips any existing `PORT=`/`VITE_PORT=` lines from `.env` and appends the dynamically chosen values.
- This makes `.env` the single source of truth for port configuration.
- When .env.example is missing, creates an empty `.env` instead of one with a hardcoded port.

### 3. `init.sh` — PROJECT_ROOT env var for server
- Server launch now includes `PROJECT_ROOT="$SCRIPT_DIR"` so the server process knows the project root.

### 4. `init.sh` — .init-state liveness validation
- Added `validate_init_state()` function that checks if an existing `.init-state` has live PIDs.
- If services are already running, init.sh prints a warning and exits early (skippable with `INIT_FORCE=1`).
- Stale `.init-state` files (dead PIDs) are automatically cleaned up.

### 5. `init.sh` — stop command with PID validation
- Stop command now checks `kill -0` before attempting to kill each PID, giving accurate "already dead" vs "stopped" messages.

### 6. `init.sh` — worktree-safe post-merge hook
- Hook installation now uses `git rev-parse --git-common-dir` to find the correct hooks directory, which works in both main repos and worktrees.

### 7. `scripts/golden-sync.sh` — file locking
- Added `mkdir`-based lockfile mechanism (`$GOLDEN_DIR/.sync.lock/`) with PID tracking.
- Prevents concurrent golden-sync runs from corrupting shared node_modules.
- Stale locks (dead PIDs) are automatically recovered.
- Lock is released on EXIT via trap.

### 8. `apps/desktop/package.json` — removed port-killing hack
- Dev script changed from `lsof -ti :1420 | xargs kill 2>/dev/null; vite` to just `vite`.
- Port conflicts are now handled by init.sh's dynamic port allocation.

## Files Changed
- `init.sh`
- `.env.example`
- `scripts/golden-sync.sh`
- `apps/desktop/package.json`
