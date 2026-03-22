/**
 * Format a duration in milliseconds to a human-readable string.
 *
 * - Below 1 second: returns e.g. "450ms"
 * - 1 second and above: returns e.g. "1.2s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
