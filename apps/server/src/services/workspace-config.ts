import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkspaceRepoConfig } from '@claude-tauri/shared';

const CONFIG_PATH = '.claude/workspace.toml';

/**
 * Load workspace repo config from .claude/workspace.toml in the given repo root.
 * Returns null if the file does not exist or if the TOML is malformed.
 * Returns a (possibly empty) WorkspaceRepoConfig object if the file parses successfully.
 */
export async function loadWorkspaceConfig(repoPath: string): Promise<WorkspaceRepoConfig | null> {
  const configPath = join(repoPath, CONFIG_PATH);

  if (!existsSync(configPath)) {
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = Bun.TOML.parse(raw) as Record<string, unknown>;
  } catch {
    // Malformed TOML — return null rather than throwing
    return null;
  }

  const config: WorkspaceRepoConfig = {};

  // Parse [lifecycle] section
  if (parsed.lifecycle && typeof parsed.lifecycle === 'object' && !Array.isArray(parsed.lifecycle)) {
    const lc = parsed.lifecycle as Record<string, unknown>;
    config.lifecycle = {};
    if (typeof lc.setup === 'string') {
      config.lifecycle.setup = lc.setup;
    }
    if (typeof lc.teardown === 'string') {
      config.lifecycle.teardown = lc.teardown;
    }
  }

  // Parse [env] section
  if (parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)) {
    const envRaw = parsed.env as Record<string, unknown>;
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(envRaw)) {
      if (typeof value === 'string') {
        env[key] = value;
      }
    }
    config.env = env;
  }

  // Parse [preserve] section
  if (parsed.preserve && typeof parsed.preserve === 'object' && !Array.isArray(parsed.preserve)) {
    const pres = parsed.preserve as Record<string, unknown>;
    config.preserve = {};
    if (Array.isArray(pres.files)) {
      config.preserve.files = pres.files.filter((f): f is string => typeof f === 'string');
    }
  }

  return config;
}
