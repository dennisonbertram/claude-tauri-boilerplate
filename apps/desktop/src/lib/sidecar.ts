import { Command, type Child } from '@tauri-apps/plugin-shell';
import { setSidecarConfig, getApiBase, getAuthHeaders } from './api-config';

let sidecarProcess: Child | null = null;
const SIDECAR_DEBUG_LOGS_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_SIDECAR_LOGS === '1';

function redactSidecarLogLine(line: string): string {
  return line
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_API_KEY]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/g, 'Bearer [REDACTED]')
    .replace(
      /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)=([^\s]+)/g,
      '$1=[REDACTED]'
    );
}

/** Pick a random port in the ephemeral range (49152-65535). */
function randomPort(): number {
  return 49152 + Math.floor(Math.random() * (65535 - 49152 + 1));
}

export async function startSidecar(): Promise<void> {
  if (sidecarProcess) return;

  const port = randomPort();
  const token = crypto.randomUUID();

  // Configure the client-side singleton BEFORE launching so waitForServer()
  // and all subsequent fetch calls use the correct base URL and auth header.
  setSidecarConfig(port, token);

  // Token is passed as a CLI arg because Tauri v2's Command.sidecar() does
  // not expose an env-var option. The server reads --token from argv and sets
  // process.env.SIDECAR_BEARER_TOKEN internally. The token is ephemeral and
  // random per launch, limiting the exposure window.
  const command = Command.sidecar('binaries/server', [
    '--port',
    String(port),
    '--token',
    token,
  ]);

  command.on('error', (error) => {
    console.error('Sidecar error:', error);
  });

  command.on('close', (data) => {
    console.log('Sidecar closed with code:', data.code);
    sidecarProcess = null;
  });

  // Default desktop logging keeps only lifecycle events. Raw sidecar output is
  // opt-in and redacted so prompt/config payloads do not leak to devtools.
  if (SIDECAR_DEBUG_LOGS_ENABLED) {
    command.stdout.on('data', (line) => {
      console.log('[server]', redactSidecarLogLine(String(line)));
    });

    command.stderr.on('data', (line) => {
      console.error('[server]', redactSidecarLogLine(String(line)));
    });
  }

  sidecarProcess = await command.spawn();
}

export async function stopSidecar(): Promise<void> {
  if (sidecarProcess) {
    await sidecarProcess.kill();
    sidecarProcess = null;
  }
}

export async function waitForServer(
  maxRetries = 30,
  intervalMs = 200
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Health endpoint is exempt from bearer auth so we don't send the token
      // here — this avoids a chicken-and-egg problem during startup polling.
      const res = await fetch(`${getApiBase()}/api/health`);
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
