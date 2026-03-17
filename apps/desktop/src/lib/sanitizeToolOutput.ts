export const DEFAULT_TOOL_OUTPUT_MAX_LENGTH = 5000;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export function sanitizeToolOutputText(input: string, maxLength = DEFAULT_TOOL_OUTPUT_MAX_LENGTH): string {
  const sanitized = input.replace(CONTROL_CHARACTERS, '');

  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return sanitized.slice(0, maxLength);
}

export function sanitizeToolOutputUrl(rawUrl: string): string {
  const cleanedUrl = sanitizeToolOutputText(rawUrl, rawUrl.length).trim();

  if (!cleanedUrl) {
    return '';
  }

  try {
    const url = new URL(cleanedUrl);

    if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) {
      return '';
    }

    return url.href;
  } catch {
    return '';
  }
}
