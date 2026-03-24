import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { createGoogleOAuthRouter } from './oauth';
import { createGmailRouter } from './gmail';
import { createCalendarRouter } from './calendar';
import { createDriveRouter } from './drive';
import { createDocsRouter } from './docs';

export function createGoogleRouter(db: Database) {
  const router = new Hono();

  // OAuth routes at root level: /status, /oauth/*, /disconnect, /refresh
  router.route('/', createGoogleOAuthRouter(db));

  // Service-specific sub-routers
  router.route('/gmail', createGmailRouter(db));
  router.route('/calendar', createCalendarRouter(db));
  router.route('/drive', createDriveRouter(db));
  router.route('/docs', createDocsRouter(db));

  return router;
}
