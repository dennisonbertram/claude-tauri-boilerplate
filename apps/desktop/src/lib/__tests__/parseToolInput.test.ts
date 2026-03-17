import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseToolInput } from '../parseToolInput';

const userInputSchema = z.object({
  id: z.number(),
  name: z.string(),
});

describe('parseToolInput', () => {
  it('parses valid JSON objects and returns typed success payload', () => {
    const input = JSON.stringify({ id: 7, name: 'Ada' });
    const result = parseToolInput(input, userInputSchema);

    expect(result).toEqual({
      success: true,
      data: { id: 7, name: 'Ada' },
    });
  });

  it('returns malformed_json result for invalid JSON input', () => {
    const result = parseToolInput('{\"id\":7', userInputSchema);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.reason).toBe('malformed_json');
      expect(result.message).toMatch(/JSON/i);
    }
  });

  it('returns schema_mismatch result for valid JSON with invalid shape', () => {
    const input = JSON.stringify({ id: '7', name: 3 });
    const result = parseToolInput(input, userInputSchema);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.reason).toBe('schema_mismatch');
      expect(result.issues).toHaveLength(2);
    }
  });

  it('returns schema_mismatch result for null input', () => {
    const result = parseToolInput(null, userInputSchema);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.reason).toBe('schema_mismatch');
    }
  });

  it('returns schema_mismatch result for undefined input', () => {
    const result = parseToolInput(undefined, userInputSchema);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.reason).toBe('schema_mismatch');
    }
  });
});
