import { resolve } from 'path';

/**
 * Canonical project root. Prefers PROJECT_ROOT env var (set by init.sh),
 * falls back to resolving from this file's location.
 *
 * Directory depth: apps/server/src/lib/ -> 4 levels up to project root.
 */
export const PROJECT_ROOT =
  process.env.PROJECT_ROOT ?? resolve(import.meta.dir, '../../../..');
