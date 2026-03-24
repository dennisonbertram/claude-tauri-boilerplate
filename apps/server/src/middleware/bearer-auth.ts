import type { MiddlewareHandler } from 'hono';

export function bearerAuth(): MiddlewareHandler {
  return async (c, next) => {
    const expectedToken = process.env.SIDECAR_BEARER_TOKEN;

    // No token configured — dev mode, skip auth
    if (!expectedToken) {
      return next();
    }

    // Always allow health checks (used for startup polling before token is available)
    if (c.req.path === '/api/health') {
      return next();
    }

    // Allow Google OAuth callback — hit by user's browser (no bearer token available).
    // Safe: callback validates state parameter for CSRF protection.
    if (c.req.path === '/api/google/oauth/callback' && c.req.method === 'GET') {
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  };
}
