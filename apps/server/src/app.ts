import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { chatRouter } from './routes/chat';
import { createSessionsRouter } from './routes/sessions';
import { createDb } from './db';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: ['http://localhost:1420', 'tauri://localhost'],
    credentials: true,
  })
);

const db = createDb();

app.get('/api/health', (c) => c.json({ status: 'ok' }));
app.route('/api/auth', authRouter);
app.route('/api/chat', chatRouter);
app.route('/api/sessions', createSessionsRouter(db));

export { app };
