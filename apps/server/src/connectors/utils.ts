/**
 * Shared utility functions for connector tools.
 */
import { randomBytes } from 'crypto';

// Random nonce generated once per process — attackers cannot predict this,
// so they cannot forge fence sentinel markers to escape the untrusted data block.
const FENCE_NONCE = randomBytes(8).toString('hex');

/**
 * Wraps untrusted external content in clearly-marked fencing to reduce
 * prompt injection risk. The model should treat fenced content as data,
 * not as instructions. The nonce-based markers are unpredictable, so an
 * attacker cannot forge an end marker that breaks out of the fence.
 */
export function fenceUntrustedContent(content: string, source: string): string {
  const beginMarker = `[UNTRUSTED_BEGIN_${FENCE_NONCE} source=${source}]`;
  const endMarker = `[UNTRUSTED_END_${FENCE_NONCE}]`;
  return `${beginMarker}\n${content}\n${endMarker}`;
}

/**
 * Returns the nonce used for fence markers in this process.
 * Exposed for testing purposes only.
 */
export function _getFenceNonce(): string {
  return FENCE_NONCE;
}

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
