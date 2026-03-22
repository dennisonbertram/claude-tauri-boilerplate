import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Force a single copy of React to avoid "Invalid hook call" errors caused
// by the bun/pnpm hoisted store creating duplicate React instances.
const rootModules = path.resolve(dirname, '../../node_modules');

export default defineConfig({
  cacheDir: '/tmp/claude-tauri-desktop-vitest-cache',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    server: {
      deps: {
        // Inline react and react-dom so Vitest bundles them through Vite's
        // resolver (which respects resolve.dedupe), instead of loading them
        // as external CJS from node_modules where duplicates arise.
        inline: [/react/, /react-dom/],
      },
    },
  },
});
