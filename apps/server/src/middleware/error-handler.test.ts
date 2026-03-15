import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import { Hono } from 'hono';
import { errorHandler } from './error-handler';

describe('Error Handler Middleware', () => {
  let app: Hono;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    stderrSpy = spyOn(console, 'error').mockImplementation(() => {});
    app = new Hono();
    app.onError(errorHandler);
  });

  test('returns consistent JSON error shape for unhandled errors', async () => {
    app.get('/test', () => {
      throw new Error('Something went wrong');
    });

    const res = await app.request('/test');
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
    expect(body.error).toBe('Something went wrong');
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  test('logs errors to stderr', async () => {
    app.get('/test', () => {
      throw new Error('Log me');
    });

    await app.request('/test');
    expect(stderrSpy).toHaveBeenCalled();
  });

  test('returns 400 for validation errors', async () => {
    app.get('/test', () => {
      const err = new Error('Invalid input');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      throw err;
    });

    const res = await app.request('/test');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toBe('Invalid input');
  });

  test('returns 401 for auth errors', async () => {
    app.get('/test', () => {
      const err = new Error('Not authenticated');
      (err as any).status = 401;
      (err as any).code = 'AUTH_ERROR';
      throw err;
    });

    const res = await app.request('/test');
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.code).toBe('AUTH_ERROR');
  });

  test('returns 404 for not found errors', async () => {
    app.get('/test', () => {
      const err = new Error('Resource not found');
      (err as any).status = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    });

    const res = await app.request('/test');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 429 for rate limit errors', async () => {
    app.get('/test', () => {
      const err = new Error('Too many requests');
      (err as any).status = 429;
      (err as any).code = 'RATE_LIMITED';
      throw err;
    });

    const res = await app.request('/test');
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.code).toBe('RATE_LIMITED');
  });

  test('includes details when provided', async () => {
    app.get('/test', () => {
      const err = new Error('Validation failed');
      (err as any).status = 400;
      (err as any).code = 'VALIDATION_ERROR';
      (err as any).details = { field: 'title', issue: 'required' };
      throw err;
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.details).toEqual({ field: 'title', issue: 'required' });
  });

  test('handles errors with no custom status or code', async () => {
    app.get('/test', () => {
      throw new Error('generic error');
    });

    const res = await app.request('/test');
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe('generic error');
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  test('does not leak stack traces in error response', async () => {
    app.get('/test', () => {
      throw new Error('secret error');
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.stack).toBeUndefined();
  });

  test('returns JSON content type', async () => {
    app.get('/test', () => {
      throw new Error('fail');
    });

    const res = await app.request('/test');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
