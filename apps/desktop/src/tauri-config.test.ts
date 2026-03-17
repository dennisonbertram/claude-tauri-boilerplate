import { describe, expect, test } from 'vitest';

import tauriConfig from '../src-tauri/tauri.conf.json';

describe('desktop window minimum size config', () => {
  test('pins minimum window width to 800 and minimum height to 600', () => {
    expect(tauriConfig).toMatchObject({
      app: {
        windows: [
          expect.objectContaining({
            minWidth: 800,
            minHeight: 600,
          }),
        ],
      },
    });
  });
});
