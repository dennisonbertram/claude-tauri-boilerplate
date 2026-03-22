import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const tauriDir = path.resolve(__dirname, '../../src-tauri');

describe('Tauri security configuration', () => {
  describe('tauri.conf.json', () => {
    const conf = JSON.parse(
      fs.readFileSync(path.join(tauriDir, 'tauri.conf.json'), 'utf-8'),
    );

    it('has a non-null CSP', () => {
      expect(conf.app.security.csp).not.toBeNull();
      expect(typeof conf.app.security.csp).toBe('string');
      expect(conf.app.security.csp.length).toBeGreaterThan(0);
    });
  });

  describe('capabilities/default.json', () => {
    const caps = JSON.parse(
      fs.readFileSync(
        path.join(tauriDir, 'capabilities/default.json'),
        'utf-8',
      ),
    );

    it('does not contain bare shell:allow-spawn string', () => {
      const bareSpawn = caps.permissions.filter(
        (p: unknown) => p === 'shell:allow-spawn',
      );
      expect(bareSpawn).toHaveLength(0);
    });

    it('has a scoped shell:allow-spawn object', () => {
      const scopedSpawn = caps.permissions.find(
        (p: unknown) =>
          typeof p === 'object' &&
          p !== null &&
          (p as Record<string, unknown>).identifier === 'shell:allow-spawn',
      );
      expect(scopedSpawn).toBeDefined();
      expect(scopedSpawn.allow).toBeDefined();
      expect(scopedSpawn.allow.length).toBeGreaterThan(0);
    });

    it('does not include shell:allow-stdin-write', () => {
      const hasStdin = caps.permissions.some((p: unknown) => {
        if (typeof p === 'string') return p === 'shell:allow-stdin-write';
        if (typeof p === 'object' && p !== null)
          return (
            (p as Record<string, unknown>).identifier ===
            'shell:allow-stdin-write'
          );
        return false;
      });
      expect(hasStdin).toBe(false);
    });

    it('does not include shell:allow-execute', () => {
      const hasExec = caps.permissions.some((p: unknown) => {
        if (typeof p === 'string') return p === 'shell:allow-execute';
        if (typeof p === 'object' && p !== null)
          return (
            (p as Record<string, unknown>).identifier ===
            'shell:allow-execute'
          );
        return false;
      });
      expect(hasExec).toBe(false);
    });
  });
});
