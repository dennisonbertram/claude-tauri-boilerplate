import { Hono } from 'hono';
import { getAuthStatus } from '../services/auth';

const authRouter = new Hono();

authRouter.get('/status', async (c) => {
  const status = await getAuthStatus();
  return c.json(status);
});

export { authRouter };
