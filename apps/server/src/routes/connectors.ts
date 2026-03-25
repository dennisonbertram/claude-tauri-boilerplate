import { Hono } from 'hono';
import { getAllConnectors } from '../connectors';

export function createConnectorsRouter() {
  const router = new Hono();

  /** GET / — list all available connectors (without tool implementations). */
  router.get('/', (c) => {
    return c.json(getAllConnectors());
  });

  return router;
}
