import { z } from 'zod';

export type ParseToolInputSuccess<T> = {
  success: true;
  data: T;
};

export type ParseToolInputFailure =
  | {
      success: false;
      reason: 'malformed_json';
      message: string;
      rawInput: unknown;
    }
  | {
      success: false;
      reason: 'schema_mismatch';
      issues: z.ZodIssue[];
      rawInput: unknown;
    };

export type ParseToolInputResult<T> = ParseToolInputSuccess<T> | ParseToolInputFailure;

export function parseToolInput<T>(input: unknown, schema: z.ZodSchema<T>): ParseToolInputResult<T> {
  let parsedInput = input;

  if (typeof input === 'string') {
    try {
      parsedInput = JSON.parse(input);
    } catch (error) {
      return {
        success: false,
        reason: 'malformed_json',
        message: error instanceof Error ? error.message : 'Invalid JSON string',
        rawInput: input,
      };
    }
  }

  const parsed = schema.safeParse(parsedInput);
  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
    };
  }

  return {
    success: false,
    reason: 'schema_mismatch',
    issues: parsed.error.issues,
    rawInput: input,
  };
}
