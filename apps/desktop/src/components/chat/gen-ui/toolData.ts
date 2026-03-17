const DEFAULT_MAX_TEXT_LENGTH = 5000;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export interface ParsedToolInput<T> {
  status: 'empty' | 'partial' | 'parsed' | 'invalid';
  value: Partial<T> | null;
  raw: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUnclosedQuote(input: string): boolean {
  let escaped = false;
  let inQuote = false;

  for (const char of input) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
    }
  }

  return inQuote;
}

function hasUnbalancedDelimiters(input: string): boolean {
  let depth = 0;

  for (const char of input) {
    if (char === '{' || char === '[') depth += 1;
    if (char === '}' || char === ']') depth -= 1;
  }

  return depth > 0;
}

function looksLikePartialJson(raw: string, error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';

  if (
    message.includes('Unexpected end of JSON input') ||
    message.includes('Unterminated string')
  ) {
    return true;
  }

  return hasUnclosedQuote(raw) || hasUnbalancedDelimiters(raw);
}

export function parseToolInput<T extends Record<string, unknown>>(
  raw: string
): ParsedToolInput<T> {
  if (!raw.trim()) {
    return { status: 'empty', value: null, raw };
  }

  try {
    const parsed = JSON.parse(raw);

    if (!isPlainObject(parsed)) {
      return { status: 'invalid', value: null, raw };
    }

    return {
      status: 'parsed',
      value: parsed as Partial<T>,
      raw,
    };
  } catch (error) {
    return {
      status: looksLikePartialJson(raw, error) ? 'partial' : 'invalid',
      value: null,
      raw,
    };
  }
}

export function sanitizeDisplayText(
  value: unknown,
  maxLength = DEFAULT_MAX_TEXT_LENGTH
): string {
  if (value == null) return '';

  const text = String(value).replace(CONTROL_CHARACTERS, '');
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}

export function sanitizeUrl(value: unknown): string | null {
  const raw = sanitizeDisplayText(value, DEFAULT_MAX_TEXT_LENGTH).trim();

  if (!raw) return null;
  if (raw.startsWith('/') || WINDOWS_ABSOLUTE_PATH.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function sanitizeToolResult(result: unknown): unknown {
  if (result == null) return result;

  if (typeof result === 'string') {
    return sanitizeDisplayText(result);
  }

  if (
    typeof result === 'number' ||
    typeof result === 'boolean'
  ) {
    return result;
  }

  if (Array.isArray(result)) {
    return result.map((item) => sanitizeToolResult(item));
  }

  if (isPlainObject(result)) {
    return Object.fromEntries(
      Object.entries(result).map(([key, value]) => [
        sanitizeDisplayText(key),
        sanitizeToolResult(value),
      ])
    );
  }

  return sanitizeDisplayText(result);
}

export function formatToolInputForDisplay(raw: string): string {
  const parsed = parseToolInput<Record<string, unknown>>(raw);

  if (parsed.status === 'parsed' && parsed.value) {
    return sanitizeDisplayText(JSON.stringify(parsed.value, null, 2));
  }

  return sanitizeDisplayText(raw);
}

export function formatToolResultForDisplay(result: unknown): string {
  if (typeof result === 'string') {
    return sanitizeDisplayText(result);
  }

  try {
    return sanitizeDisplayText(JSON.stringify(sanitizeToolResult(result), null, 2));
  } catch {
    return sanitizeDisplayText(result);
  }
}
