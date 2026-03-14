import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: ['http://localhost:1420', 'tauri://localhost'],
    credentials: true,
  })
);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

export { app };
