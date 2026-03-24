#!/usr/bin/env bash
# golden-sync.sh — Maintain the golden node_modules directory
# This runs pnpm install once and stores the result at ~/.claude-tauri/golden/
# so worktrees can symlink instead of re-installing.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${CYAN}→${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GOLDEN_DIR="${GOLDEN_DIR:-$HOME/.claude-tauri/golden}"

info "Syncing golden directory at $GOLDEN_DIR"

# Copy root workspace configuration files
mkdir -p "$GOLDEN_DIR"
cp "$REPO_DIR/pnpm-lock.yaml" "$GOLDEN_DIR/"
cp "$REPO_DIR/package.json" "$GOLDEN_DIR/"

if [ -f "$REPO_DIR/pnpm-workspace.yaml" ]; then
  cp "$REPO_DIR/pnpm-workspace.yaml" "$GOLDEN_DIR/"
fi

if [ -f "$REPO_DIR/.npmrc" ]; then
  cp "$REPO_DIR/.npmrc" "$GOLDEN_DIR/"
fi

# Dynamically discover all workspace packages from their package.json files
# This avoids hardcoding package paths — new packages are picked up automatically.
workspace_dirs=()
while IFS= read -r pkg_json; do
  workspace_dirs+=("$(dirname "$pkg_json")")
done < <(cd "$REPO_DIR" && find apps packages -maxdepth 2 -name package.json -not -path '*/node_modules/*' 2>/dev/null | sort)

info "Found ${#workspace_dirs[@]} workspace packages: ${workspace_dirs[*]}"

for ws_dir in "${workspace_dirs[@]}"; do
  mkdir -p "$GOLDEN_DIR/$ws_dir"
  cp "$REPO_DIR/$ws_dir/package.json" "$GOLDEN_DIR/$ws_dir/"

  # If the package exports raw TypeScript source (like shared), copy it for resolution
  if [ -d "$REPO_DIR/$ws_dir/src" ] && grep -q '"\.\/src' "$REPO_DIR/$ws_dir/package.json" 2>/dev/null; then
    mkdir -p "$GOLDEN_DIR/$ws_dir/src"
    cp -R "$REPO_DIR/$ws_dir/src/." "$GOLDEN_DIR/$ws_dir/src/"
  fi
done

# Install dependencies in golden directory
info "Running pnpm install in golden directory..."
cd "$GOLDEN_DIR"
CI=true pnpm install --frozen-lockfile 2>/dev/null || CI=true pnpm install
ok "Dependencies installed"

# Write lockfile hash for cache invalidation
shasum -a 256 "$REPO_DIR/pnpm-lock.yaml" | cut -d' ' -f1 > "$GOLDEN_DIR/.lockfile-hash"
ok "Golden directory synced (hash: $(cat "$GOLDEN_DIR/.lockfile-hash" | head -c 12)...)"
