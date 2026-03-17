import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOOL_OUTPUT_MAX_LENGTH,
  sanitizeToolOutputText,
  sanitizeToolOutputUrl,
} from '../sanitizeToolOutput';

describe('sanitizeToolOutputText', () => {
  it('passes through clean text unchanged', () => {
    const input = 'Hello, world!';
    const output = sanitizeToolOutputText(input);

    expect(output).toBe(input);
  });

  it('strips control characters', () => {
    const input = 'hello\u0000world\u000btext';
    const output = sanitizeToolOutputText(input);

    expect(output).toBe('helloworldtext');
  });

  it('caps strings longer than max length', () => {
    const input = 'x'.repeat(DEFAULT_TOOL_OUTPUT_MAX_LENGTH + 20);
    const output = sanitizeToolOutputText(input);

    expect(output).toHaveLength(DEFAULT_TOOL_OUTPUT_MAX_LENGTH);
  });

  it('accepts a custom max length', () => {
    const input = 'abcdef';

    expect(sanitizeToolOutputText(input, 3)).toBe('abc');
  });
});

describe('sanitizeToolOutputUrl', () => {
  it('allows http URLs', () => {
    const input = 'http://example.com/search?q=1';

    expect(sanitizeToolOutputUrl(input)).toBe('http://example.com/search?q=1');
  });

  it('allows https URLs', () => {
    const input = 'https://example.com/path#fragment';

    expect(sanitizeToolOutputUrl(input)).toBe('https://example.com/path#fragment');
  });

  it('allows file URLs', () => {
    const input = 'file:///tmp/report.txt';

    expect(sanitizeToolOutputUrl(input)).toBe('file:///tmp/report.txt');
  });

  it('blocks javascript URLs', () => {
    const input = 'javascript:alert(1)';

    expect(sanitizeToolOutputUrl(input)).toBe('');
  });

  it('blocks data URLs', () => {
    const input = 'data:text/html,alert(1)';

    expect(sanitizeToolOutputUrl(input)).toBe('');
  });
});
