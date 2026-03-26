/**
 * Shared utility functions for connector tools.
 */

/**
 * Sanitizes an error message before surfacing it to the LLM.
 * Strips potential bearer tokens, credential URLs, and long stack traces.
 */
export function sanitizeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]')
    .replace(/https?:\/\/[^\s]*@[^\s]*/g, '[REDACTED_URL]')
    .substring(0, 500); // Cap error message length
}
