import { describe, expect, test } from 'bun:test';

describe('Bun server config', () => {
  test('disables idle timeout for SSE streaming stability', async () => {
    const fileUrl = new URL('./index.ts', import.meta.url);
    const text = await Bun.file(fileUrl).text();

    expect(text).toMatch(/idleTimeout:\s*0/);
  });
});
