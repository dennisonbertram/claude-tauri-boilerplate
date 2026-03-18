import { describe, test, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';

const { createSystemRouter } = await import('./system');

describe('System Routes', () => {
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    testApp = new Hono();
    testApp.route('/api/system', createSystemRouter());
  });

  describe('GET /api/system/diagnostics', () => {
    test('returns diagnostic data with expected fields', async () => {
      const res = await testApp.request('/api/system/diagnostics');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('cpuUsagePercent');
      expect(body).toHaveProperty('memoryUsageMb');
      expect(body).toHaveProperty('memoryUsagePercent');
      expect(typeof body.cpuUsagePercent).toBe('number');
      expect(typeof body.memoryUsageMb).toBe('number');
      expect(typeof body.memoryUsagePercent).toBe('number');
      expect(body.cpuUsagePercent).toBeGreaterThanOrEqual(0);
      expect(body.memoryUsagePercent).toBeGreaterThanOrEqual(0);
      expect(body.memoryUsagePercent).toBeLessThanOrEqual(100);
    });
  });
});
