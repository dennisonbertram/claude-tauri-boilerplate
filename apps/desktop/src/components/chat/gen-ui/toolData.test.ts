import { describe, expect, it } from 'vitest';
import {
  parseToolInput,
  sanitizeDisplayText,
  sanitizeToolResult,
  sanitizeUrl,
} from './toolData';

describe('toolData.parseToolInput', () => {
  it('returns parsed for valid JSON', () => {
    const result = parseToolInput<{ file_path: string }>('{"file_path":"src/app.ts"}');

    expect(result.status).toBe('parsed');
    expect(result.value).toEqual({ file_path: 'src/app.ts' });
  });

  it('returns empty for blank input', () => {
    const result = parseToolInput('');

    expect(result.status).toBe('empty');
    expect(result.value).toBeNull();
  });

  it('returns partial for incomplete streamed JSON', () => {
    const result = parseToolInput<{ file_path: string }>('{"file_path":"src/app.ts"');

    expect(result.status).toBe('partial');
    expect(result.value).toBeNull();
  });

  it('returns invalid for malformed JSON', () => {
    const result = parseToolInput<{ file_path: string }>('{"file_path": }');

    expect(result.status).toBe('invalid');
    expect(result.value).toBeNull();
  });
});

describe('toolData sanitizers', () => {
  it('sanitizes display text by removing unsafe control characters', () => {
    expect(sanitizeDisplayText('hello\u0000world\u0008!')).toBe('helloworld!');
  });

  it('allows safe URLs and rejects unsafe protocols', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeUrl('http://example.com/path')).toBe('http://example.com/path');
    expect(sanitizeUrl('/tmp/image.png')).toBe('/tmp/image.png');
    expect(sanitizeUrl('file:///tmp/image.png')).toBe('file:///tmp/image.png');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('sanitizes nested tool results recursively', () => {
    expect(
      sanitizeToolResult({
        title: 'Hello\u0000',
        links: ['https://example.com', 'javascript:alert(1)'],
        nested: {
          summary: 'World\u0008',
        },
      })
    ).toEqual({
      title: 'Hello',
      links: ['https://example.com', 'javascript:alert(1)'],
      nested: {
        summary: 'World',
      },
    });
  });
});
