import { describe, test, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';

const { createRuntimeCapabilitiesRouter } = await import('./runtime-capabilities');

describe('Runtime Capabilities Routes', () => {
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    testApp = new Hono();
    testApp.route('/api/runtime-capabilities', createRuntimeCapabilitiesRouter());
  });

  test('GET /api/runtime-capabilities returns shared provider capability metadata', async () => {
    const res = await testApp.request('/api/runtime-capabilities');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      providers: expect.arrayContaining([
        expect.objectContaining({
          id: 'anthropic',
          label: 'Anthropic',
          settingsFields: [],
        }),
        expect.objectContaining({
          id: 'bedrock',
          label: 'AWS Bedrock',
          settingsFields: expect.arrayContaining([
            expect.objectContaining({ key: 'bedrockBaseUrl' }),
            expect.objectContaining({ key: 'bedrockProjectId' }),
          ]),
        }),
        expect.objectContaining({
          id: 'vertex',
          label: 'Google Vertex',
          settingsFields: expect.arrayContaining([
            expect.objectContaining({ key: 'vertexProjectId' }),
            expect.objectContaining({ key: 'vertexBaseUrl' }),
          ]),
        }),
        expect.objectContaining({
          id: 'custom',
          label: 'Custom Base URL',
          settingsFields: expect.arrayContaining([
            expect.objectContaining({ key: 'customBaseUrl' }),
          ]),
        }),
      ]),
    });
  });
});
