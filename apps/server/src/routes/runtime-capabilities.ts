import { Hono } from 'hono';
import { getRuntimeCapabilitiesSnapshot } from '@claude-tauri/shared';

export function createRuntimeCapabilitiesRouter() {
  const router = new Hono();

  router.get('/', (c) => c.json(getRuntimeCapabilitiesSnapshot()));

  return router;
}
