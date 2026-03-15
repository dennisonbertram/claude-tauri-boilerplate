import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { createChatRouter } from './routes/chat';
import { createPermissionRouter } from './routes/permission';
import { createPlanRouter } from './routes/plan';
import { createSessionsRouter } from './routes/sessions';
import { createGitRouter } from './routes/git';
import { createInstructionsRouter } from './routes/instructions';
import { createMemoryRouter } from './routes/memory';
import { createDb } from './db';
import { errorHandler } from './middleware/error-handler';

const app = new Hono();

// Centralized error handler -- catches all unhandled errors and returns
// consistent JSON responses: { error, code, details? }
app.onError(errorHandler);

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
app.route('/api/chat', createChatRouter(db));
app.route('/api/chat/permission', createPermissionRouter(db));
app.route('/api/chat/plan', createPlanRouter(db));
app.route('/api/sessions', createSessionsRouter(db));
app.route('/api/git', createGitRouter());
app.route('/api/instructions', createInstructionsRouter());
app.route('/api/memory', createMemoryRouter());

export { app };
