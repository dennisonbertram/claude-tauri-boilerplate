import { app } from './app';

const port = parseInt(process.env.PORT || '3131');
console.log(`Hono server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  // Disable socket idle timeout so SSE/streaming connections are not dropped
  // during tool-call pauses where no bytes are written to the client.
  idleTimeout: 0,
};
