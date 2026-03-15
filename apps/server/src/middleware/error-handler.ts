import type { ErrorHandler } from 'hono';

export interface AppError {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Centralized error handler for the Hono app.
 * Catches all unhandled errors and returns consistent JSON responses.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  // Log the full error to stderr for debugging
  console.error('[error-handler]', err);

  // Determine if this is actually an Error object
  if (!(err instanceof Error)) {
    return c.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      } satisfies AppError,
      500
    );
  }

  // JSON parse errors are client errors (bad request body), not server errors
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json(
      {
        error: err.message,
        code: 'VALIDATION_ERROR',
      } satisfies AppError,
      400
    );
  }

  // Extract status code and error code from the error if set
  const status = (err as any).status ?? 500;
  const code = (err as any).code ?? statusToCode(status);
  const details = (err as any).details;

  const body: AppError = {
    error: err.message,
    code,
  };

  if (details !== undefined) {
    body.details = details;
  }

  return c.json(body, status);
};

/**
 * Maps HTTP status codes to error code strings.
 */
function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'AUTH_ERROR';
    case 404:
      return 'NOT_FOUND';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}
