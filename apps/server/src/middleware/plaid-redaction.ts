import type { MiddlewareHandler } from 'hono';

/**
 * Patterns that match Plaid token values in logged request/response bodies.
 * These are stripped to prevent accidental leakage to logs.
 */
const TOKEN_PATTERNS = [
  // Plaid access tokens: access-sandbox-..., access-development-..., access-production-...
  /access-(?:sandbox|development|production)-[a-f0-9-]{36}/gi,
  // Plaid public tokens: public-sandbox-..., etc.
  /public-(?:sandbox|development|production)-[a-f0-9-]{36}/gi,
  // Plaid link tokens: link-sandbox-..., etc.
  /link-(?:sandbox|development|production)-[a-f0-9-]{36}/gi,
  // Encrypted access tokens stored in our DB: v1:keyId:base64:base64:base64
  /v1:[^:]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+/g,
];

const REDACTED = '[REDACTED]';

/**
 * Redact token-like patterns from a string.
 */
export function redactTokens(input: string): string {
  let result = input;
  for (const pattern of TOKEN_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

/**
 * Redact sensitive Plaid token fields from an object (shallow).
 * Mutates and returns the same object for efficiency.
 */
export function redactBody(body: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['access_token', 'public_token', 'link_token'];
  for (const key of sensitiveKeys) {
    if (key in body && typeof body[key] === 'string') {
      body[key] = REDACTED;
    }
  }
  return body;
}

/**
 * Middleware that redacts Plaid tokens from logged request/response bodies.
 * Applied to all `/api/plaid/*` routes.
 *
 * This wraps console.log/warn/error during request processing to
 * strip token patterns from any output.
 */
export function plaidRedaction(): MiddlewareHandler {
  return async (c, next) => {
    // Store original console methods
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    const wrapLogger =
      (orig: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        const redacted = args.map((arg) => {
          if (typeof arg === 'string') return redactTokens(arg);
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.parse(redactTokens(JSON.stringify(arg)));
            } catch {
              return arg;
            }
          }
          return arg;
        });
        orig(...redacted);
      };

    console.log = wrapLogger(origLog);
    console.warn = wrapLogger(origWarn);
    console.error = wrapLogger(origError);

    try {
      await next();
    } finally {
      // Always restore original loggers
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }
  };
}
