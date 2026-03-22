# Credential Storage Model

## Overview

Sensitive credentials (API keys, tokens) are stored **separately** from
general application settings. This prevents secrets from leaking through
settings export, debug logging, or casual `localStorage` inspection.

## Architecture

```
AppSettings (localStorage "claude-tauri-settings")
  +-- model, theme, fontSize, ...     <-- non-sensitive prefs
  +-- apiKey: ""                       <-- always empty in blob
  +-- githubToken: ""                  <-- always empty in blob

Secure Credential Store (localStorage "__credential_store")
  +-- "api-key": "sk-ant-..."
  +-- "github-token": "ghp_..."
```

### Why two stores?

| Concern | Settings blob | Credential store |
|---|---|---|
| Serialised to JSON | Yes | Yes (separate key) |
| Exposed in DevTools | Yes | Yes (dev only) |
| Logged by telemetry | Possibly | No (isolated key) |
| Included in export | Likely | No |
| Migration to OS keychain | N/A | Drop-in via abstraction |

The credential store is accessed exclusively through an async abstraction
(`apps/desktop/src/services/secure-credentials.ts`), so the move to true
OS keychain storage requires zero changes to consuming code.

## Current Implementation

All credential operations go through:

```ts
import { setCredential, getCredential, deleteCredential } from '@/services/secure-credentials';
```

These functions are `async` even though the current backend is synchronous
localStorage. This ensures callers are already compatible when the backend
switches to an async OS keychain API.

### Well-known keys

Import `CredentialKeys` from the service to avoid magic strings:

```ts
import { CredentialKeys } from '@/services/secure-credentials';

await setCredential(CredentialKeys.API_KEY, value);
```

## Migration

On first load after this change, the `SettingsContext` runs a one-time
migration that:

1. Reads the old settings blob from localStorage.
2. Extracts `apiKey` and `githubToken` if present.
3. Writes them to the credential store.
4. Removes them from the settings blob.

No user action is required.

## Future: OS Keychain Integration

To upgrade to true OS-level secure storage:

1. Add `tauri-plugin-keyring` to `apps/desktop/src-tauri/Cargo.toml`.
2. Register the plugin in `lib.rs`.
3. Add `keyring:default` to `capabilities/default.json`.
4. Update `secure-credentials.ts` to call `invoke('plugin:keyring|set', ...)`
   when `isTauri()` is true; fall back to localStorage otherwise.

The public API (`setCredential`, `getCredential`, `deleteCredential`) and
the `CredentialKeys` constants remain unchanged.

## Server-side tokens (known limitation)

Linear and Railway tokens stored in the server-side SQLite database are
**not** covered by this abstraction. They remain as plaintext columns.
A future iteration should add column-level encryption or move them behind
an OS keychain lookup on the server process.
