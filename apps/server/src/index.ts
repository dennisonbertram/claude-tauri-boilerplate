import { app } from './app';

// Accept --port and --token from CLI args (passed by Tauri sidecar)
const portArgIndex = process.argv.indexOf('--port');
const tokenArgIndex = process.argv.indexOf('--token');

if (tokenArgIndex !== -1 && process.argv[tokenArgIndex + 1]) {
  process.env.SIDECAR_BEARER_TOKEN = process.argv[tokenArgIndex + 1];
}

const port =
  portArgIndex !== -1 && process.argv[portArgIndex + 1]
    ? parseInt(process.argv[portArgIndex + 1])
    : parseInt(process.env.PORT || '3131');
console.log(`Hono server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  // Disable socket idle timeout so SSE/streaming connections are not dropped
  // during tool-call pauses where no bytes are written to the client.
  idleTimeout: 0,
};
