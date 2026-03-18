import { Hono } from 'hono';
import os from 'node:os';

const systemRouter = new Hono();

interface SystemDiagnostics {
  cpuUsagePercent: number;
  memoryUsageMb: number;
  memoryUsagePercent: number;
}

let previousCpuUsage: { usage: NodeJS.CpuUsage; timestamp: number } | null = null;

function getCpuUsagePercent(): number {
  const nowUsage = process.cpuUsage();
  const now = Date.now();

  if (!previousCpuUsage) {
    previousCpuUsage = { usage: nowUsage, timestamp: now };
    return 0;
  }

  const elapsedMs = now - previousCpuUsage.timestamp;
  const diff = process.cpuUsage(previousCpuUsage.usage);
  const usedMs = (diff.user + diff.system) / 1000;
  const cores = Math.max(os.cpus().length, 1);

  const percent = elapsedMs > 0 ? (usedMs / (elapsedMs * cores)) * 100 : 0;
  previousCpuUsage = { usage: nowUsage, timestamp: now };

  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

function getSystemDiagnostics(): SystemDiagnostics {
  const memoryUsage = process.memoryUsage();
  const memoryTotal = os.totalmem();
  const memoryUsagePercent = memoryTotal > 0 ? (memoryUsage.rss / memoryTotal) * 100 : 0;

  return {
    cpuUsagePercent: getCpuUsagePercent(),
    memoryUsageMb: Math.round(memoryUsage.rss / 1024 / 1024),
    memoryUsagePercent,
  };
}

systemRouter.get('/diagnostics', (c) => {
  return c.json(getSystemDiagnostics());
});

export function createSystemRouter() {
  return systemRouter;
}
