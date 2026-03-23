#!/usr/bin/env bash
# init.sh — Zero-effort dev environment bootstrap
# Usage: ./init.sh                     (foreground, Ctrl+C to stop)
#        INIT_DAEMONIZE=1 ./init.sh    (start services, write .init-state, exit)
#        INIT_KEEP_RUNNING=1 ./init.sh (don't kill services on exit)
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

# ── Configuration ───────────────────────────────────────────────────
SERVER_PORT="${INIT_SERVER_PORT:-3131}"
VITE_PORT="${INIT_VITE_PORT:-1420}"
GOLDEN_DIR="${GOLDEN_DIR:-$HOME/.claude-tauri/golden}"
SERVER_PID=""
VITE_PID=""

# ── Cleanup trap ────────────────────────────────────────────────────
cleanup() {
  if [ "${INIT_KEEP_RUNNING:-}" = "1" ] || [ "${INIT_DAEMONIZE:-}" = "1" ]; then
    return
  fi
  echo ""
  info "Shutting down..."
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null || true
  rm -f "$SCRIPT_DIR/.init-state"
}
trap cleanup EXIT

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
# Register required keys per environment. Local needs nothing (subscription).
# Cloud needs ANTHROPIC_API_KEY at minimum.
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

# Add future required keys here:
# if [ -z "${SOME_OTHER_KEY:-}" ]; then
#   err "SOME_OTHER_KEY is required. Set it in your platform secrets."
#   KEYS_MISSING=1
# fi

if [ "$KEYS_MISSING" -eq 1 ]; then
  err "Missing required environment variables. See docs/runbook.md"
  exit 1
fi

# ── Phase 2c: .env File ────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  if [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    ok "Created .env from .env.example"
  else
    echo "PORT=$SERVER_PORT" > "$SCRIPT_DIR/.env"
    ok "Created minimal .env (PORT=$SERVER_PORT)"
  fi
else
  ok ".env exists"
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
  ok "Dependencies linked from golden ($GOLDEN_DIR)"
}

install_deps_direct() {
  info "Installing dependencies with pnpm..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  ok "Dependencies installed"
}

# Use golden symlink strategy if golden-sync.sh exists, otherwise direct install
if [ -f "$SCRIPT_DIR/scripts/golden-sync.sh" ]; then
  install_deps_golden
else
  install_deps_direct
fi

# ── Phase 4: Kill existing processes on target ports ────────────────
for port in "$SERVER_PORT" "$VITE_PORT"; do
  if lsof -ti :"$port" &>/dev/null; then
    warn "Port $port in use — killing existing process"
    lsof -ti :"$port" | xargs kill 2>/dev/null || true
    sleep 0.5
  fi
done

# ── Phase 5: Start backend ─────────────────────────────────────────
info "Starting server on port $SERVER_PORT..."
PORT="$SERVER_PORT" bun --watch "$SCRIPT_DIR/apps/server/src/index.ts" &
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

# ── Phase 6: Start frontend ────────────────────────────────────────
info "Starting frontend on port $VITE_PORT..."
cd "$SCRIPT_DIR/apps/desktop"
npx vite --port "$VITE_PORT" &
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

# ── Phase 7: Write state file ──────────────────────────────────────
cat > "$SCRIPT_DIR/.init-state" <<EOF
SERVER_URL=http://localhost:$SERVER_PORT
SERVER_PID=$SERVER_PID
FRONTEND_URL=http://localhost:$VITE_PORT
FRONTEND_PID=$VITE_PID
HEALTH_CHECK=http://localhost:$SERVER_PORT/api/health
EOF

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
