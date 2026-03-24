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

# Create golden directory structure
mkdir -p "$GOLDEN_DIR/apps/desktop"
mkdir -p "$GOLDEN_DIR/apps/server"
mkdir -p "$GOLDEN_DIR/packages/shared"
mkdir -p "$GOLDEN_DIR/packages/pdf-forms"

# Copy workspace configuration files
cp "$REPO_DIR/pnpm-lock.yaml" "$GOLDEN_DIR/"
cp "$REPO_DIR/package.json" "$GOLDEN_DIR/"

# Copy pnpm-workspace.yaml
if [ -f "$REPO_DIR/pnpm-workspace.yaml" ]; then
  cp "$REPO_DIR/pnpm-workspace.yaml" "$GOLDEN_DIR/"
fi

# Copy .npmrc if it exists
if [ -f "$REPO_DIR/.npmrc" ]; then
  cp "$REPO_DIR/.npmrc" "$GOLDEN_DIR/"
fi

# Copy all workspace package.json files
cp "$REPO_DIR/apps/desktop/package.json" "$GOLDEN_DIR/apps/desktop/"
cp "$REPO_DIR/apps/server/package.json" "$GOLDEN_DIR/apps/server/"
cp "$REPO_DIR/packages/shared/package.json" "$GOLDEN_DIR/packages/shared/"
if [ -f "$REPO_DIR/packages/pdf-forms/package.json" ]; then
  cp "$REPO_DIR/packages/pdf-forms/package.json" "$GOLDEN_DIR/packages/pdf-forms/"
fi

# Packages that export raw TypeScript need their source for resolution
if [ -d "$REPO_DIR/packages/shared/src" ]; then
  mkdir -p "$GOLDEN_DIR/packages/shared/src"
  cp -R "$REPO_DIR/packages/shared/src/." "$GOLDEN_DIR/packages/shared/src/"
fi
if [ -d "$REPO_DIR/packages/pdf-forms/src" ]; then
  mkdir -p "$GOLDEN_DIR/packages/pdf-forms/src"
  cp -R "$REPO_DIR/packages/pdf-forms/src/." "$GOLDEN_DIR/packages/pdf-forms/src/"
fi

# Install dependencies in golden directory
info "Running pnpm install in golden directory..."
cd "$GOLDEN_DIR"
pnpm install --frozen-lockfile --force 2>/dev/null || pnpm install --force
ok "Dependencies installed"

# Write lockfile hash for cache invalidation
shasum -a 256 "$REPO_DIR/pnpm-lock.yaml" | cut -d' ' -f1 > "$GOLDEN_DIR/.lockfile-hash"
ok "Golden directory synced (hash: $(cat "$GOLDEN_DIR/.lockfile-hash" | head -c 12)...)"
