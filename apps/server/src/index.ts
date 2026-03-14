import { app } from './app';

const port = parseInt(process.env.PORT || '3131');
console.log(`Hono server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
