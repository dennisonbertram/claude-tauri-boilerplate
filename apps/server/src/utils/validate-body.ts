import type { Context } from 'hono';
import type { ZodSchema } from 'zod';

/**
 * Parse the JSON request body and validate it against a Zod schema.
 *
 * Returns the validated data on success, or a 400 Response on failure.
 * Callers should check:
 *
 *   const data = await validateBody(c, schema);
 *   if (data instanceof Response) return data;
 */
export async function validateBody<T>(
  c: Context,
  schema: ZodSchema<T>,
): Promise<T | Response> {
  const body = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      400,
    );
  }
  return parsed.data;
}
