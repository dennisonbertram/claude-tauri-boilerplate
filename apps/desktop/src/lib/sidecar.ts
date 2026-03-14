import { Command, type Child } from '@tauri-apps/plugin-shell';

let sidecarProcess: Child | null = null;

export async function startSidecar(): Promise<void> {
  if (sidecarProcess) return;

  const command = Command.sidecar('binaries/server', ['--port', '3131']);

  command.on('error', (error) => {
    console.error('Sidecar error:', error);
  });

  command.on('close', (data) => {
    console.log('Sidecar closed with code:', data.code);
    sidecarProcess = null;
  });

  command.stdout.on('data', (line) => {
    console.log('[server]', line);
  });

  command.stderr.on('data', (line) => {
    console.error('[server]', line);
  });

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
      const res = await fetch('http://localhost:3131/api/health');
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
