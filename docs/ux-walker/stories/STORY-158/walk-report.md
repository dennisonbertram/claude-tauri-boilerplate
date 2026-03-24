# STORY-158: App Startup Sequence & Initialization Order

**Type**: long
**Goal**: Verify the app initialization sequence works correctly
**Result**: PASS

## Steps Performed

### 1. App Initialization Sequence (Source Analysis)

The app follows a clear, logical initialization sequence:

```
1. useSidecarBoot()          -- If Tauri: start sidecar server, wait for health check
                             -- If web: skip (serverReady = true immediately)
2. ErrorScreen / LoadingScreen -- Shown during sidecar boot
3. ErrorBoundary             -- Catches render errors
4. SettingsProvider          -- Loads app settings from server
5. AuthGate                  -- Checks /api/auth/status
   - Loading: shows spinner with "Connecting..."
   - Not authenticated: shows OnboardingScreen
   - Authenticated: renders AppLayout with email/plan
6. AppLayout                 -- Main UI with all hooks:
   - useTheme()              -- Applies theme
   - useSessions()           -- Fetches sessions from /api/sessions
   - useAgentProfiles()      -- Loads agent profiles
   - useProjects()           -- Loads projects
   - useWorkspaces()         -- Loads workspaces (conditional on selectedProjectId)
   - useSettings()           -- Reads cached settings
   - useAppKeyboardShortcuts -- Registers Cmd+T, Ctrl+Tab, Cmd+, shortcuts
   - beforeunload handler    -- Registers quit confirmation
```

### 2. Page Load Timing

Tested by navigating to http://localhost:1927:

| Metric | Value |
|--------|-------|
| DOM Content Loaded | ~654ms |
| Load Complete | ~656ms |
| First Contentful Paint | ~688ms |
| Total Resources | 250 (Vite dev mode - unbundled modules) |
| Resource Load Window | 7.5ms to 44.4ms (all resources loaded in ~37ms) |

### 3. Auth Check Timing

- Auth check (`/api/auth/status`) happens BEFORE content loads (correct order)
- In dev mode, auth is skipped (no `SIDECAR_BEARER_TOKEN` set)
- The `AuthGate` shows a loading spinner while checking auth
- If auth fails, `OnboardingScreen` is shown (not the main UI)

### 4. Network Tab / API Calls Order

During initialization, the following API calls are made (in order):
1. `/api/auth/status` - Authentication check (from AuthGate/useAuth)
2. `/api/sessions` - Session list fetch (from useSessions)
3. `/api/settings` - Settings fetch (from useSettings/SettingsProvider)

All calls go to the backend server (localhost:3846 in this configuration).

### 5. Initial Load Time

- **Total load time**: ~688ms to first contentful paint
- This is in Vite dev mode with 250 unbundled modules; production builds would be significantly faster
- No console errors during initialization
- All resources loaded within a 37ms window (7.5ms to 44.4ms) indicating efficient parallel loading

## Findings

| ID | Severity | Description |
|----|----------|-------------|
| F-158-001 | info | Init sequence follows correct order: sidecar boot -> auth -> content. Auth gate prevents unauthorized access to app content. |
| F-158-002 | info | Dev mode loads 250 individual modules (Vite HMR). Production build would bundle these for faster load. |
| F-158-003 | low | The `useSidecarBoot` hook sets `serverReady = true` immediately for non-Tauri (web) mode, skipping health check. If the backend server is down, the app will render but API calls will fail silently. |

## Screenshots
- `01-loaded-state.png` - App fully loaded state
