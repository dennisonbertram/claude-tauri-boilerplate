/**
 * IDE opener utility.
 *
 * Generates URL scheme URLs for opening files/directories in various IDEs.
 * Uses `window.open(url)` to trigger the OS URL handler which routes to the
 * appropriate installed application.
 */

export type IdeId =
  | 'vscode'
  | 'cursor'
  | 'zed'
  | 'intellij'
  | 'xcode'
  | 'fork'
  | 'sourcetree'
  | 'androidstudio'
  | 'custom';

export interface IdeConfig {
  label: string;
  /** Human-readable description for the settings UI. */
  description?: string;
}

export const IDE_CONFIGS: Record<IdeId, IdeConfig> = {
  vscode: { label: 'VS Code', description: 'Visual Studio Code' },
  cursor: { label: 'Cursor', description: 'Cursor AI editor' },
  zed: { label: 'Zed', description: 'Zed editor' },
  intellij: {
    label: 'IntelliJ IDEA',
    description: 'JetBrains IntelliJ IDEA (via Toolbox)',
  },
  xcode: { label: 'Xcode', description: 'Apple Xcode' },
  fork: { label: 'Fork', description: 'Fork git client' },
  sourcetree: { label: 'Sourcetree', description: 'Atlassian Sourcetree' },
  androidstudio: {
    label: 'Android Studio',
    description: 'Google Android Studio',
  },
  custom: {
    label: 'Custom',
    description: 'Custom URL scheme — use {path} as placeholder',
  },
};

/**
 * Build the IDE URL for a given path.
 *
 * @param ide - The IDE identifier.
 * @param path - Absolute filesystem path to open (file or directory).
 * @param customTemplate - Required when ide === 'custom'. Use `{path}` as the placeholder.
 * @returns The URL string, or empty string when a required parameter is missing.
 */
export function getIdeUrl(
  ide: IdeId,
  path: string,
  customTemplate?: string
): string {
  switch (ide) {
    case 'vscode':
      // vscode://file//absolute/path
      return `vscode://file/${path}`;

    case 'cursor':
      // cursor://file//absolute/path
      return `cursor://file/${path}`;

    case 'zed':
      // zed://file//absolute/path
      return `zed://file/${path}`;

    case 'intellij':
      // idea://open?file=/absolute/path
      return `idea://open?file=${path}`;

    case 'xcode':
      // xcode://open?url=file:///absolute/path
      return `xcode://open?url=file://${path}`;

    case 'fork':
      // fork://open?path=/absolute/path
      return `fork://open?path=${path}`;

    case 'sourcetree':
      // sourcetree://cloneRepo?type=local&cloneURL=/absolute/path
      return `sourcetree://cloneRepo?type=local&cloneURL=${path}`;

    case 'androidstudio':
      // studio://open?file=/absolute/path
      return `studio://open?file=${path}`;

    case 'custom': {
      const template = customTemplate;
      if (!template) return '';
      return template.split('{path}').join(path);
    }
  }
}

/**
 * Open a path in the specified IDE by triggering the OS URL handler.
 *
 * @param ide - The IDE identifier.
 * @param path - Absolute filesystem path to open (file or directory).
 * @param customTemplate - Required when ide === 'custom'.
 */
export function openInIde(
  ide: IdeId,
  path: string,
  customTemplate?: string
): void {
  const url = getIdeUrl(ide, path, customTemplate);
  if (!url) return;
  window.open(url, '_blank');
}
