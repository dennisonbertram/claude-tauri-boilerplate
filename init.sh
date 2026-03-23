#!/usr/bin/env bash
# init.sh — Zero-effort dev environment bootstrap
# Usage: ./init.sh                     (foreground, Ctrl+C to stop)
#        INIT_DAEMONIZE=1 ./init.sh    (start services, write .init-state, exit)
#        ./init.sh stop                (kill a daemonized environment)
#
# See docs/runbook.md for full documentation.
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1" >&2; }
info() { echo -e "${CYAN}→${NC} $1"; }

# ── Resolve script directory (works in worktrees) ───────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Stop command ────────────────────────────────────────────────────
if [ "${1:-}" = "stop" ]; then
  if [ -f "$SCRIPT_DIR/.init-state" ]; then
    # shellcheck disable=SC1091
    source "$SCRIPT_DIR/.init-state"
    kill "$SERVER_PID" 2>/dev/null && ok "Server (PID $SERVER_PID) stopped" || warn "Server already stopped"
    kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend (PID $FRONTEND_PID) stopped" || warn "Frontend already stopped"
    rm -f "$SCRIPT_DIR/.init-state"
    ok "Environment stopped"
  else
    warn "No .init-state found — nothing to stop"
  fi
  exit 0
fi

# ── Port allocation ────────────────────────────────────────────────
# Find a free port in a given range. Usage: find_free_port [start] [end]
find_free_port() {
  local start="${1:-3000}" end="${2:-9999}"
  local port
  for port in $(shuf -i "$start-$end" -n 50 2>/dev/null || jot -r 50 "$start" "$end"); do
    if ! lsof -ti :"$port" &>/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
  done
  err "Could not find a free port in range $start-$end"
  return 1
}

# ── Configuration ───────────────────────────────────────────────────
# Use explicit port if provided, otherwise pick a random free one
if [ -n "${INIT_SERVER_PORT:-}" ]; then
  SERVER_PORT="$INIT_SERVER_PORT"
else
  SERVER_PORT=$(find_free_port 3100 3999)
fi

if [ -n "${INIT_VITE_PORT:-}" ]; then
  VITE_PORT="$INIT_VITE_PORT"
else
  VITE_PORT=$(find_free_port 1400 1999)
fi

GOLDEN_DIR="${GOLDEN_DIR:-$HOME/.claude-tauri/golden}"
SERVER_PID=""
VITE_PID=""

info "Ports: server=$SERVER_PORT, frontend=$VITE_PORT"

# ── Cleanup trap ────────────────────────────────────────────────────
cleanup() {
  if [ "${INIT_DAEMONIZE:-}" = "1" ]; then
    return
  fi
  echo ""
  info "Shutting down..."
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null || true
  rm -f "$SCRIPT_DIR/.init-state"
}
trap cleanup EXIT

# ── Phase 0: Clean stale worktrees (background, non-blocking) ──────
if [ -f "$SCRIPT_DIR/scripts/cleanup-worktrees.sh" ]; then
  "$SCRIPT_DIR/scripts/cleanup-worktrees.sh" --max-age-days 7 &>/dev/null &
fi

# ── Phase 1: Prerequisites ──────────────────────────────────────────
info "Checking prerequisites..."
MISSING=0

if ! command -v node &>/dev/null; then
  err "Node.js not found. Install: curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22"
  MISSING=1
fi

if ! command -v bun &>/dev/null; then
  err "Bun not found. Install: curl -fsSL https://bun.sh/install | bash"
  MISSING=1
fi

if ! command -v pnpm &>/dev/null; then
  err "pnpm not found. Install: npm install -g pnpm"
  MISSING=1
fi

if [ "$MISSING" -eq 1 ]; then
  err "Missing prerequisites. Install them and re-run."
  exit 1
fi
ok "Prerequisites: node $(node --version), bun $(bun --version), pnpm $(pnpm --version)"

# ── Phase 2: Detect Environment (Local vs Cloud) ───────────────────
# Local = Claude subscription auth available (no API key needed)
# Cloud = must have ANTHROPIC_API_KEY from platform secrets
INIT_ENV="local"

if [ -n "${RAILWAY_ENVIRONMENT:-}" ] || [ -n "${FLY_APP_NAME:-}" ] || \
   [ -n "${CODESPACE:-}" ] || [ -n "${GITPOD_WORKSPACE_ID:-}" ] || \
   [ -n "${RENDER_SERVICE_ID:-}" ] || [ -n "${CI:-}" ]; then
  INIT_ENV="cloud"
elif [ ! -d "$HOME/.claude" ]; then
  # No ~/.claude directory — probably not a local dev machine with subscription
  INIT_ENV="cloud"
fi

# ── Phase 2b: Validate Keys for Environment ────────────────────────
KEYS_MISSING=0

if [ "$INIT_ENV" = "cloud" ]; then
  ok "Cloud environment detected"
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    err "ANTHROPIC_API_KEY is required in cloud environments."
    err "Set it in your platform's secrets/env vars dashboard."
    KEYS_MISSING=1
  else
    ok "ANTHROPIC_API_KEY is set"
  fi
else
  ok "Local environment detected (using subscription auth)"
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    warn "ANTHROPIC_API_KEY is set — this overrides subscription auth."
    warn "Unsetting it for this session. Export it explicitly if you want API key auth."
    unset ANTHROPIC_API_KEY
  fi
fi

if [ "$KEYS_MISSING" -eq 1 ]; then
  err "Missing required environment variables. See docs/runbook.md"
  exit 1
fi

# ── Phase 2c: .env File ────────────────────────────────────────────
# Only create if missing — don't noisily report on every run
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  if [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  else
    echo "PORT=$SERVER_PORT" > "$SCRIPT_DIR/.env"
  fi
fi

# ── Phase 3: Dependencies (Golden Symlink or Install) ───────────────
install_deps_golden() {
  local repo_hash
  repo_hash=$(shasum -a 256 "$SCRIPT_DIR/pnpm-lock.yaml" | cut -d' ' -f1)
  local golden_hash
  golden_hash=$(cat "$GOLDEN_DIR/.lockfile-hash" 2>/dev/null || echo "none")

  if [ "$repo_hash" != "$golden_hash" ]; then
    info "Golden directory stale — rebuilding (~4s)..."
    "$SCRIPT_DIR/scripts/golden-sync.sh"
  fi

  # Symlink node_modules from golden
  for dir in "." "apps/desktop" "apps/server"; do
    local target="$SCRIPT_DIR/$dir/node_modules"
    local golden_nm="$GOLDEN_DIR/$dir/node_modules"
    if [ -L "$target" ]; then
      # Already a symlink — verify it points to golden
      if [ "$(readlink "$target")" = "$golden_nm" ]; then
        continue
      fi
      rm "$target"
    elif [ -d "$target" ]; then
      # Real node_modules exists — remove to replace with symlink
      rm -rf "$target"
    fi
    if [ -d "$golden_nm" ]; then
      ln -s "$golden_nm" "$target"
    fi
  done
  ok "Dependencies linked from golden"
}

install_deps_direct() {
  info "Installing dependencies with pnpm..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  ok "Dependencies installed"
}

if [ -f "$SCRIPT_DIR/scripts/golden-sync.sh" ]; then
  install_deps_golden
else
  install_deps_direct
fi

# ── Phase 4: Start backend ──────────────────────────────────────────
info "Starting server on port $SERVER_PORT..."
PORT="$SERVER_PORT" VITE_PORT="$VITE_PORT" bun --watch "$SCRIPT_DIR/apps/server/src/index.ts" &
SERVER_PID=$!

# Health check
SERVER_READY=0
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$SERVER_PORT/api/health" >/dev/null 2>&1; then
    SERVER_READY=1
    break
  fi
  sleep 0.5
done

if [ "$SERVER_READY" -eq 0 ]; then
  err "Server failed to start on port $SERVER_PORT (timeout 15s)"
  exit 2
fi
ok "Server ready at http://localhost:$SERVER_PORT"

# ── Phase 5: Start frontend ────────────────────────────────────────
info "Starting frontend on port $VITE_PORT..."
cd "$SCRIPT_DIR/apps/desktop"
VITE_API_PORT="$SERVER_PORT" npx vite --port "$VITE_PORT" --strictPort false &
VITE_PID=$!
cd "$SCRIPT_DIR"

# Health check
VITE_READY=0
for i in $(seq 1 40); do
  if curl -sf "http://localhost:$VITE_PORT" >/dev/null 2>&1; then
    VITE_READY=1
    break
  fi
  sleep 0.5
done

if [ "$VITE_READY" -eq 0 ]; then
  err "Frontend failed to start on port $VITE_PORT (timeout 20s)"
  exit 3
fi
ok "Frontend ready at http://localhost:$VITE_PORT"

# ── Phase 6: Write state file ──────────────────────────────────────
cat > "$SCRIPT_DIR/.init-state" <<EOF
SERVER_URL=http://localhost:$SERVER_PORT
SERVER_PID=$SERVER_PID
FRONTEND_URL=http://localhost:$VITE_PORT
FRONTEND_PID=$VITE_PID
HEALTH_CHECK=http://localhost:$SERVER_PORT/api/health
EOF

# ── Phase 7: Install post-merge hook (once) ─────────────────────────
HOOK_PATH="$SCRIPT_DIR/.git/hooks/post-merge"
if [ -d "$SCRIPT_DIR/.git/hooks" ] && [ ! -f "$HOOK_PATH" ]; then
  cat > "$HOOK_PATH" <<'HOOKEOF'
#!/usr/bin/env bash
# Auto-refresh golden node_modules when pnpm-lock.yaml changes on merge
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if git diff HEAD@{1} --name-only | grep -q 'pnpm-lock.yaml'; then
  echo "pnpm-lock.yaml changed — refreshing golden directory in background..."
  "$SCRIPT_DIR/scripts/golden-sync.sh" &>/dev/null &
fi
HOOKEOF
  chmod +x "$HOOK_PATH"
fi

# ── Phase 8: Summary ───────────────────────────────────────────────
echo ""
echo "========================================"
echo "  CLAUDE-TAURI DEV ENVIRONMENT READY"
echo "========================================"
echo "SERVER_URL=http://localhost:$SERVER_PORT"
echo "SERVER_PID=$SERVER_PID"
echo "FRONTEND_URL=http://localhost:$VITE_PORT"
echo "FRONTEND_PID=$VITE_PID"
echo "HEALTH_CHECK=http://localhost:$SERVER_PORT/api/health"
echo "========================================"
echo ""

# ── Phase 9: Daemonize or wait ──────────────────────────────────────
if [ "${INIT_DAEMONIZE:-}" = "1" ]; then
  disown "$SERVER_PID" "$VITE_PID"
  ok "Processes daemonized. State written to .init-state"
  trap - EXIT  # disable cleanup since we're keeping processes
  exit 0
fi

info "Press Ctrl+C to stop all services"
wait
