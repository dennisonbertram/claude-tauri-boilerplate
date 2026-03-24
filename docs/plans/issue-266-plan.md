# Issue #266: Secure Credential Storage Plan

## Current Credential Storage Locations

### 1. Desktop App - localStorage (plaintext JSON)

| Credential | File | Line | Mechanism |
|---|---|---|---|
| `apiKey` (Anthropic API key) | `apps/desktop/src/hooks/useSettings.ts` | L17, L80, L148, L164 | `localStorage.getItem/setItem('claude-tauri-settings')` — stored as plaintext JSON blob alongside all other settings |
| `githubToken` | `apps/desktop/src/hooks/useSettings.ts` | L64, L127 | Same `localStorage` blob as above |

- **Storage key:** `claude-tauri-settings`
- **Load:** `loadSettings()` at L146-160 reads from `localStorage`, merges with `DEFAULT_SETTINGS`
- **Save:** `saveSettings()` at L162-165 serializes entire settings object (minus `workflowPrompts`) and writes to `localStorage`
- **Context:** `SettingsContext.tsx` wraps this in React context; `updateSettings()` calls `saveSettings()` on every change

### 2. Server SQLite - linear_oauth table (plaintext in DB file)

| Credential | File | Line | Mechanism |
|---|---|---|---|
| Linear `access_token` | `apps/server/src/db/schema.ts` | L81-90 | `linear_oauth` table with `access_token TEXT NOT NULL` |
| Linear `refresh_token` | `apps/server/src/db/schema.ts` | L83 | Same table, `refresh_token TEXT` |

- **Read:** `apps/server/src/db/index.ts` L829-844 — `SELECT access_token, refresh_token ... FROM linear_oauth WHERE id = 1`
- **Write:** `apps/server/src/db/index.ts` L858-861 — `INSERT ... ON CONFLICT ... UPDATE`
- **Delete:** `apps/server/src/db/index.ts` L879 — `DELETE FROM linear_oauth WHERE id = 1`

### 3. Server SQLite - deployment_settings table (plaintext in DB file)

| Credential | File | Line | Mechanism |
|---|---|---|---|
| `railway_api_token` | `apps/server/src/db/schema.ts` | L506-514 | `deployment_settings` table with `railway_api_token TEXT` |

- **Read:** `apps/server/src/db/index.ts` L2094-2095
- **Write:** `apps/server/src/db/index.ts` L2100-2103

### 4. No Existing Secure Storage

- `tauri-plugin-store` is **NOT installed** (not in `Cargo.toml` or any `package.json`)
- `tauri-plugin-stronghold` is **NOT installed**
- No keychain/keyring usage exists in the codebase
- Current Tauri plugins (from `apps/desktop/src-tauri/Cargo.toml`): `tauri-plugin-dialog`, `tauri-plugin-opener`, `tauri-plugin-shell`
- The MPP marketplace plan (`docs/plans/mpp-marketplace-integration.md`) references `tauri-plugin-keyring` for wallet keys but is not yet implemented

---

## Recommended Secure Storage Plugin

### Use `tauri-plugin-stronghold` (recommended over `tauri-plugin-store`)

**Why Stronghold over Store:**
- `tauri-plugin-store` is a key-value store but stores data as **unencrypted JSON files** on disk — not meaningfully better than localStorage for secrets
- `tauri-plugin-stronghold` uses the IOTA Stronghold library: encrypted vault files, memory-guarded secrets, snapshot encryption with a password/key
- Stronghold is purpose-built for secret storage; Store is for general app preferences

**Why Stronghold over `tauri-plugin-keyring` (OS keychain):**
- Keyring is good for single secrets but awkward for structured data (multiple tokens, metadata)
- Stronghold works cross-platform without OS-specific keychain quirks
- Keyring may be better suited for the wallet key case (MPP plan) where OS-level isolation matters; credentials like API keys fit Stronghold better
- Can use both: Stronghold for API keys/tokens, Keyring later for wallet private keys

**Alternative considered:** A simpler approach would be `tauri-plugin-store` with the app's unique machine ID as an encryption key passed to a custom encryption layer. However, this is DIY crypto and Stronghold handles this properly out of the box.

---

## Implementation Plan

### Phase 1: Add Stronghold Plugin

1. Add `tauri-plugin-stronghold` to `apps/desktop/src-tauri/Cargo.toml`
2. Add `@tauri-apps/plugin-stronghold` to `apps/desktop/package.json`
3. Register the plugin in `apps/desktop/src-tauri/src/lib.rs`
4. Initialize Stronghold with a deterministic key derived from machine identity (or prompt user for a vault password on first run)

### Phase 2: Create Secure Credentials Service

Create `apps/desktop/src/services/secure-credentials.ts`:

```typescript
interface SecureCredentialStore {
  getApiKey(): Promise<string | null>;
  setApiKey(key: string): Promise<void>;
  getGithubToken(): Promise<string | null>;
  setGithubToken(token: string): Promise<void>;
  clearAll(): Promise<void>;
}
```

This service wraps Tauri `invoke()` calls to Rust-side Stronghold operations.

### Phase 3: Create Tauri Commands (Rust Side)

Add Rust commands in `apps/desktop/src-tauri/src/lib.rs` (or a new `credentials.rs` module):
- `credential_get(key: String) -> Option<String>`
- `credential_set(key: String, value: String)`
- `credential_delete(key: String)`
- `credential_clear_all()`

### Phase 4: Migrate Desktop Credentials from localStorage

1. **Modify `useSettings.ts`:** Remove `apiKey` and `githubToken` from the localStorage-persisted settings blob
2. **Add migration logic:** On app start, check if `apiKey`/`githubToken` exist in localStorage settings; if so, move them to Stronghold and clear from localStorage
3. **Update `SettingsContext.tsx`:** Load credentials from Stronghold (async) and merge into settings state
4. **Update settings UI:** Settings panel inputs for API key and GitHub token should read/write through the secure credential service

### Phase 5: Migrate Server-Side Tokens

For Linear OAuth and Railway tokens stored in SQLite:
- **Option A (recommended for now):** Keep in SQLite but encrypt the token values before storage using a key from the Stronghold vault. The Bun sidecar would call back to the Tauri shell to decrypt.
- **Option B (simpler):** Accept SQLite storage for server-side tokens since the DB file has filesystem permissions. Focus Phase 1 on the frontend credentials that are most exposed (localStorage is readable by any JS).

### Phase 6: Update Tests

- Update `useSettings.test.ts` — remove localStorage credential persistence tests, add Stronghold mock tests
- Update `SettingsPanel.test.tsx` — same
- Add integration tests for the migration path

---

## Risk Areas

1. **Async initialization:** Stronghold reads are async; current `loadSettings()` is synchronous. The settings context will need a loading state, which could cause UI flicker on startup.

2. **Migration race condition:** If the app crashes between reading credentials from localStorage and writing to Stronghold, data could be lost. Use a two-phase commit: write to Stronghold first, then delete from localStorage.

3. **Vault password UX:** Stronghold requires a password/key to open the vault. Options:
   - Derive from machine identity (less secure but invisible to user)
   - Prompt user on first launch (more secure but adds friction)
   - Use a hardcoded salt + machine-specific entropy (reasonable middle ground)

4. **Sidecar access:** The Bun server sidecar cannot directly access Stronghold (it runs outside the Tauri Rust shell). Server-side credentials (Linear OAuth, Railway token) need a bridge or must stay in SQLite.

5. **Test mocking:** Stronghold is a Tauri plugin — tests running in Node/Bun need a mock. The `@tauri-apps/api/core` invoke calls must be mockable.

6. **Existing MPP keyring plan:** The `docs/plans/mpp-marketplace-integration.md` already plans to use `tauri-plugin-keyring` for wallet keys. Ensure the credential storage approach here is compatible (both plugins can coexist).

---

## Files to Modify

### New Files
- `apps/desktop/src/services/secure-credentials.ts` — Stronghold wrapper service
- `apps/desktop/src-tauri/src/credentials.rs` — Rust Tauri commands for credential CRUD

### Modified Files
- `apps/desktop/src-tauri/Cargo.toml` — add `tauri-plugin-stronghold`
- `apps/desktop/src-tauri/src/lib.rs` — register Stronghold plugin + credential commands
- `apps/desktop/package.json` — add `@tauri-apps/plugin-stronghold`
- `apps/desktop/src/hooks/useSettings.ts` — remove credentials from localStorage blob, add async credential loading
- `apps/desktop/src/contexts/SettingsContext.tsx` — async initialization for credentials, loading state
- `apps/desktop/src/hooks/useSettings.test.ts` — update tests
- `apps/desktop/src/components/settings/SettingsPanel.test.tsx` — update tests
- `apps/desktop/src/components/settings/` — any settings UI components that read/write apiKey or githubToken

### Potentially Modified (Phase 5, server-side)
- `apps/server/src/db/schema.ts` — if adding encryption columns
- `apps/server/src/db/index.ts` — if adding encrypt/decrypt wrappers for Linear/Railway tokens
