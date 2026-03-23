#!/usr/bin/env bash
# cleanup-worktrees.sh — Remove stale git worktrees
# Usage: ./scripts/cleanup-worktrees.sh [--dry-run] [--max-age-days N]
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
info() { echo -e "${CYAN}→${NC} $1"; }

DRY_RUN=0
MAX_AGE_DAYS=7

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=1; shift ;;
    --max-age-days) MAX_AGE_DAYS="$2"; shift 2 ;;
    *) echo "Usage: $0 [--dry-run] [--max-age-days N]"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

info "Cleaning worktrees older than $MAX_AGE_DAYS days..."
[ "$DRY_RUN" -eq 1 ] && warn "DRY RUN — no changes will be made"

# First, prune worktrees whose directories no longer exist
git worktree prune 2>/dev/null

REMOVED=0
FREED_MB=0

# Parse git worktree list for non-bare entries
while IFS= read -r line; do
  # Format: /path/to/worktree  <hash> [branch]
  wt_path=$(echo "$line" | awk '{print $1}')

  # Skip the main working tree
  if [ "$wt_path" = "$REPO_DIR" ]; then
    continue
  fi

  # Skip if path doesn't exist
  if [ ! -d "$wt_path" ]; then
    continue
  fi

  # Check age based on directory modification time
  if [[ "$OSTYPE" == "darwin"* ]]; then
    age_days=$(( ($(date +%s) - $(stat -f%m "$wt_path")) / 86400 ))
  else
    age_days=$(( ($(date +%s) - $(stat -c%Y "$wt_path")) / 86400 ))
  fi

  if [ "$age_days" -lt "$MAX_AGE_DAYS" ]; then
    continue
  fi

  # Calculate size
  size_kb=$(du -sk "$wt_path" 2>/dev/null | cut -f1)
  size_mb=$((size_kb / 1024))

  if [ "$DRY_RUN" -eq 1 ]; then
    warn "Would remove: $wt_path (${size_mb}MB, ${age_days}d old)"
  else
    info "Removing: $wt_path (${size_mb}MB, ${age_days}d old)"
    git worktree remove --force "$wt_path" 2>/dev/null || rm -rf "$wt_path"
    REMOVED=$((REMOVED + 1))
    FREED_MB=$((FREED_MB + size_mb))
  fi
done < <(git worktree list 2>/dev/null)

if [ "$DRY_RUN" -eq 1 ]; then
  info "Run without --dry-run to remove these worktrees"
else
  ok "Removed $REMOVED worktrees, freed ~${FREED_MB}MB"
fi
