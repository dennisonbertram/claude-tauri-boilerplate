/**
 * Pure sanitization and validation utilities for the Amazon Orders connector.
 * No external imports — safe to use in tests without SDK dependencies.
 */

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Valid Amazon order ID format: digits/letters separated by dashes.
 * Examples: 123-1234567-1234567, D01-1234567-1234567
 * Strictly validated to prevent Gmail query injection.
 */
const ORDER_ID_RE = /^[A-Z0-9]{3}-[0-9]{7}-[0-9]{7}$/;

/**
 * Valid date format for Gmail after:/before: operators: YYYY/MM/DD.
 * Month 01-12, day 01-31.
 */
const DATE_RE = /^[0-9]{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;

/**
 * Sanitize and validate an Amazon order ID.
 * Throws if the value does not strictly match the expected format.
 */
export function sanitizeOrderId(orderId: string): string {
  if (!ORDER_ID_RE.test(orderId)) {
    throw new Error(
      `Invalid order ID: "${orderId}". Expected format: 123-1234567-1234567 or D01-1234567-1234567`
    );
  }
  return orderId;
}

/**
 * Sanitize and validate a Gmail date parameter (YYYY/MM/DD).
 * Throws if the value does not strictly match the expected format.
 */
export function sanitizeDateParam(date: string): string {
  if (!DATE_RE.test(date)) {
    throw new Error(
      `Invalid date: "${date}". Expected format: YYYY/MM/DD (e.g. 2024/01/15)`
    );
  }
  return date;
}
