import { parseToolInput as parseToolInputWithSchema } from '@/lib/parseToolInput';
import { z } from 'zod';

/** Maps file extensions to language names for display and syntax highlighting */
const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  xml: 'xml',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  mdx: 'markdown',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  ps1: 'powershell',
  dockerfile: 'dockerfile',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
  lua: 'lua',
  vim: 'vim',
  zig: 'zig',
  sol: 'solidity',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  ml: 'ocaml',
  r: 'r',
  dart: 'dart',
  vue: 'vue',
  svelte: 'svelte',
};

/**
 * Detects the programming language from a file path's extension.
 * Returns the language name for display, or 'text' if unknown.
 */
export function detectLanguage(filePath: string): string {
  const filename = filePath.split('/').pop() || '';
  const dotIndex = filename.lastIndexOf('.');

  if (dotIndex === -1 || dotIndex === 0) {
    return 'text';
  }

  const ext = filename.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_MAP[ext] || 'text';
}

/**
 * Extracts the directory from a file path.
 */
export function getDirectory(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) return '.';
  return filePath.slice(0, lastSlash) || '/';
}

/**
 * Safely parses JSON input from a tool call.
 * Returns an empty object if parsing fails.
 */
export function parseToolInput<T extends Record<string, unknown>>(input: string): Partial<T> {
  const parsedInput = parseToolInputWithSchema(input, z.any());

  if (parsedInput.success) {
    return parsedInput.data as Partial<T>;
  }

  return {};
}

/** Image file extensions supported for inline preview */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

/**
 * Checks whether a file path refers to an image file based on its extension.
 */
export function isImageFile(filePath: string): boolean {
  if (!filePath) return false;
  const filename = filePath.split('/').pop() || '';
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === 0) return false;
  const ext = filename.slice(dotIndex + 1).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}
