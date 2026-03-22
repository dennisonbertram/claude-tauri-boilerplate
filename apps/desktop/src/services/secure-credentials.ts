/**
 * Secure credential storage abstraction.
 *
 * Current implementation:
 *   - Tauri desktop mode: credentials are stored in a dedicated, isolated
 *     localStorage key (`__credential_store`), separate from general app
 *     settings. This prevents accidental serialization/logging of secrets
 *     alongside non-sensitive preferences.
 *   - Browser dev mode: same localStorage backend with a console warning.
 *
 * Future improvement:
 *   When `tauri-plugin-keyring` is added to the Rust side, the Tauri code
 *   path will switch to OS keychain (macOS Keychain, Windows Credential
 *   Manager, Linux Secret Service) via:
 *     invoke('plugin:keyring|set', { service, name, password })
 *   The public API below will not change.
 *
 * Usage:
 *   await setCredential('anthropic-api-key', apiKey);
 *   const key = await getCredential('anthropic-api-key');
 *   await deleteCredential('anthropic-api-key');
 *   const all = await getAllCredentials();
 */

const CREDENTIAL_STORE_KEY = '__credential_store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/** Read the entire credential map from storage. */
function readStore(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CREDENTIAL_STORE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Persist the entire credential map to storage. */
function writeStore(store: Record<string, string>): void {
  localStorage.setItem(CREDENTIAL_STORE_KEY, JSON.stringify(store));
}

// ---------------------------------------------------------------------------
// Public API (all async to allow future keychain migration)
// ---------------------------------------------------------------------------

/**
 * Store a credential. Empty/null values are treated as deletions.
 */
export async function setCredential(key: string, value: string): Promise<void> {
  if (!isTauri()) {
    console.warn(
      '[secure-credentials] Not running in Tauri \u2014 credentials stored in localStorage (dev only).',
    );
  }

  if (!value) {
    return deleteCredential(key);
  }

  const store = readStore();
  store[key] = value;
  writeStore(store);
}

/**
 * Retrieve a credential by key. Returns `null` when not found.
 */
export async function getCredential(key: string): Promise<string | null> {
  const store = readStore();
  return store[key] ?? null;
}

/**
 * Delete a single credential.
 */
export async function deleteCredential(key: string): Promise<void> {
  const store = readStore();
  delete store[key];
  writeStore(store);
}

/**
 * Return all stored credentials (useful for migration/debugging).
 */
export async function getAllCredentials(): Promise<Record<string, string>> {
  return readStore();
}

// ---------------------------------------------------------------------------
// Well-known credential keys
// ---------------------------------------------------------------------------

/** Canonical keys used by the app. Consumers should import these instead of
 *  using raw strings so renaming is a single-point change. */
export const CredentialKeys = {
  API_KEY: 'api-key',
  GITHUB_TOKEN: 'github-token',
} as const;

export type CredentialKey = (typeof CredentialKeys)[keyof typeof CredentialKeys];
