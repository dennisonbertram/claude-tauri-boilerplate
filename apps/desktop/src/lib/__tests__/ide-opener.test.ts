import { describe, it, expect } from 'vitest';
import { getIdeUrl, IDE_CONFIGS, type IdeId } from '../ide-opener';

describe('getIdeUrl', () => {
  describe('VS Code', () => {
    it('returns vscode:// URL for a directory', () => {
      expect(getIdeUrl('vscode', '/path/to/project')).toBe(
        'vscode://file//path/to/project'
      );
    });

    it('returns vscode:// URL for a file', () => {
      expect(getIdeUrl('vscode', '/path/to/project/src/index.ts')).toBe(
        'vscode://file//path/to/project/src/index.ts'
      );
    });
  });

  describe('Cursor', () => {
    it('returns cursor:// URL for a directory', () => {
      expect(getIdeUrl('cursor', '/path/to/project')).toBe(
        'cursor://file//path/to/project'
      );
    });

    it('returns cursor:// URL for a file', () => {
      expect(getIdeUrl('cursor', '/path/to/file.ts')).toBe(
        'cursor://file//path/to/file.ts'
      );
    });
  });

  describe('Zed', () => {
    it('returns zed:// URL for a directory', () => {
      expect(getIdeUrl('zed', '/path/to/project')).toBe(
        'zed://file//path/to/project'
      );
    });
  });

  describe('IntelliJ', () => {
    it('returns idea:// URL for a directory', () => {
      expect(getIdeUrl('intellij', '/path/to/project')).toBe(
        'idea://open?file=/path/to/project'
      );
    });

    it('returns idea:// URL for a file', () => {
      expect(getIdeUrl('intellij', '/path/to/file.java')).toBe(
        'idea://open?file=/path/to/file.java'
      );
    });
  });

  describe('Xcode', () => {
    it('returns xcode:// URL for a path', () => {
      expect(getIdeUrl('xcode', '/path/to/project')).toBe(
        'xcode://open?url=file:///path/to/project'
      );
    });
  });

  describe('Fork', () => {
    it('returns fork:// URL for a directory', () => {
      expect(getIdeUrl('fork', '/path/to/project')).toBe(
        'fork://open?path=/path/to/project'
      );
    });
  });

  describe('Sourcetree', () => {
    it('returns sourcetree:// URL for a directory', () => {
      expect(getIdeUrl('sourcetree', '/path/to/project')).toBe(
        'sourcetree://cloneRepo?type=local&cloneURL=/path/to/project'
      );
    });
  });

  describe('Android Studio', () => {
    it('returns studio:// URL for a directory', () => {
      expect(getIdeUrl('androidstudio', '/path/to/project')).toBe(
        'studio://open?file=/path/to/project'
      );
    });
  });

  describe('Custom', () => {
    it('substitutes {path} in the custom template', () => {
      expect(
        getIdeUrl('custom', '/path/to/project', 'myide://open?path={path}')
      ).toBe('myide://open?path=/path/to/project');
    });

    it('substitutes {path} multiple times if present', () => {
      expect(
        getIdeUrl('custom', '/my/dir', 'foo://{path}?fallback={path}')
      ).toBe('foo:///my/dir?fallback=/my/dir');
    });

    it('returns empty string when custom is selected but no template provided', () => {
      expect(getIdeUrl('custom', '/path/to/project')).toBe('');
    });

    it('returns empty string when custom template is empty string', () => {
      expect(getIdeUrl('custom', '/path/to/project', '')).toBe('');
    });
  });

  describe('path encoding', () => {
    it('handles paths with spaces for vscode', () => {
      expect(getIdeUrl('vscode', '/path/to/my project')).toBe(
        'vscode://file//path/to/my project'
      );
    });

    it('handles paths with spaces for intellij', () => {
      expect(getIdeUrl('intellij', '/path/to/my project')).toBe(
        'idea://open?file=/path/to/my project'
      );
    });
  });
});

describe('IDE_CONFIGS', () => {
  it('has a config entry for each supported IDE', () => {
    const expectedIds: IdeId[] = [
      'vscode',
      'cursor',
      'zed',
      'intellij',
      'xcode',
      'fork',
      'sourcetree',
      'androidstudio',
      'custom',
    ];
    for (const id of expectedIds) {
      expect(IDE_CONFIGS[id], `Missing config for ${id}`).toBeDefined();
      expect(IDE_CONFIGS[id].label).toBeTruthy();
    }
  });

  it('each config has a non-empty label', () => {
    for (const [id, config] of Object.entries(IDE_CONFIGS)) {
      expect(config.label, `Empty label for ${id}`).toBeTruthy();
    }
  });
});
