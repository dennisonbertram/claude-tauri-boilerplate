# UX Stories: Desktop App Shell & Sidecar

Topic: Desktop App Shell & Sidecar  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: App Launch & Window Initialization

**Type**: medium
**Topic**: Desktop App Shell & Sidecar
**Persona**: First-time user
**Goal**: Open the app and see a responsive window
**Preconditions**: Tauri app is built; desktop environment available

### Steps
1. User double-clicks the Claude Code application icon on desktop → Main window appears with 1200×800px dimensions (min 800×600px)
2. Tauri shell initializes with React frontend pointed at `localhost:1420` (dev) or bundled dist/ (production)
3. Window title shows "Claude Code"
4. Main UI renders inside the Tauri webview with ErrorBoundary wrapping the entire app
5. Activity Bar (left sidebar, 14px wide) appears with Chat/Projects/Teams/Agents navigation buttons
6. If server is already running, AuthGate proceeds directly to auth check

### Variations
- **Slow dev environment**: User sees blank window for 2-3 seconds while Vite dev server starts and hot-reloads the bundle
- **Server not running**: Frontend loads but useAuth hook gets "Server not reachable" error and renders OnboardingScreen
- **Tauri plugins missing**: Dialog/Shell/Opener plugins fail to initialize, app crashes to error screen

### Edge Cases
- **Window resize below minimum**: Tauri enforces minWidth (800px) and minHeight (600px), prevents further resize down
- **Multiple app instances**: Each instance opens a separate Tauri window; no singleton enforced at OS level
- **High DPI displays**: Tauri scales window based on device pixel ratio; content looks sharp on retina/4K
- **App backgrounded & resumed**: Window state restored from last session position/size

---

## STORY-002: Server Sidecar Startup & Lifecycle

**Type**: medium
**Topic**: Desktop App Shell & Sidecar
**Persona**: Developer/DevOps
**Goal**: Sidecar server starts automatically with the app
**Preconditions**: App launched; Hono backend configured

### Steps
1. Tauri app boots → Checks `tauri.conf.json` for `externalBin: ["binaries/server"]` declaration
2. Tauri CLI detects the bundled `server` binary in the external binaries path
3. On app startup, Tauri spawns the server process as a child of the main app process
4. Server listens on `http://localhost:3131` (port from `process.env.PORT` or default)
5. Server logs to console: `"Hono server running on http://localhost:3131"`
6. Frontend's useAuth hook calls `GET /api/auth/status` and receives response within 10 seconds
7. If server is slow to start, frontend shows "Connecting..." spinner in LoadingScreen
8. Once auth status received, AuthGate renders either OnboardingScreen or AppLayout

### Variations
- **Dev mode**: `bun --watch src/index.ts` runs the server separately in terminal; Tauri connects to existing process
- **Production build**: `bun build --compile` creates standalone binary bundled with the app
- **Server crashes**: Child process exits; subsequent API calls fail with "Server not reachable" error → user sees retry button
- **Port already in use**: Server fails to bind; error logged; AuthGate shows error state

### Edge Cases
- **Slow machine startup**: Server takes >10 seconds to initialize → AUTH_TIMEOUT_MS triggers, returns `{ authenticated: false, error: "Auth check timed out after 10s" }`
- **Race condition**: Frontend polls before server is ready → network error, but retry mechanism kicks in
- **Server config incomplete**: Missing `ANTHROPIC_API_KEY` or SDK credentials → auth detection fails but doesn't crash app
- **App quit while server running**: Tauri terminates server process automatically as child; no orphaned processes

---

## STORY-003: Authentication Gate & Subscription Check

**Type**: long
**Topic**: Desktop App Shell & Sidecar
**Persona**: Returning user with valid Claude subscription
**Goal**: Verify subscription status and unlock the full app
**Preconditions**: Hono server running; Claude Code CLI installed locally with valid auth token

### Steps
1. App launches → ErrorBoundary wraps App component → App renders AuthGate as root guard
2. AuthGate initializes useAuth hook → starts loading state (shows spinner)
3. useAuth calls `fetch('http://localhost:3131/api/auth/status')` on mount
4. Request handler calls `getAuthStatus()` in auth service
5. Service executes `query({ prompt: 'OK', options: { maxTurns: 1, env: buildSubscriptionSdkEnv() } })`
6. SDK queries Claude API with subscription credentials from environment (ANTHROPIC_API_KEY)
7. If credentials valid, SDK returns `system` event with `accountInfo` (email, plan)
8. Service extracts `email` and `plan` (e.g., "pro") and returns `{ authenticated: true, email, plan }`
9. Frontend receives response, exits loading state
10. AuthGate renders AppLayout component and passes `{ email, plan }` down as props
11. ActivityBar displays user initial in bottom avatar button (e.g., "J" for john@example.com)
12. User can now access Chat, Projects, Teams, Agents views

### Variations
- **Expired credentials**: getAuthStatus returns `{ authenticated: false, error: "Invalid API key" }` → OnboardingScreen shown
- **No subscription**: Plan detection succeeds but returns free-tier indicator (app may restrict features)
- **Offline mode**: Both SDK query and timeout fail → OnboardingScreen with generic "Server not reachable" error
- **Second authentication check**: User manually clicks "Check Connection" button → re-runs checkAuth callback

### Edge Cases
- **Race condition between renders**: AuthGate loading state flickers if auth resolves very quickly (< 100ms)
- **SDK hangs**: No response within AUTH_TIMEOUT_MS (10s) → returns timeout error instead of hanging forever
- **Malformed accountInfo**: SDK returns event with missing email field → defaults to undefined, avatar shows null
- **Multiple simultaneous checks**: useAuth on mount calls checkAuth, but if user clicks retry button simultaneously, two requests in flight (race handled by last-write-wins on state)

---

## STORY-004: Onboarding Flow for New Users

**Type**: long
**Topic**: Desktop App Shell & Sidecar
**Persona**: First-time user without Claude subscription
**Goal**: Set up Claude Code CLI and authenticate
**Preconditions**: App launched; no authentication detected; network available

### Steps
1. User sees LoadingScreen spinner → "Connecting..."
2. Server returns `{ authenticated: false, error: 'Server not reachable' }` or auth fails
3. AuthGate renders OnboardingScreen with centered Card
4. OnboardingScreen displays:
   - Title: "Welcome to Claude Tauri"
   - Description: "Get started by connecting your Claude account"
5. Three numbered steps shown:
   - **Step 1**: "Install Claude Code" → code snippet: `npm install -g @anthropic-ai/claude-code`
   - **Step 2**: "Log in to Claude" → code snippet: `claude login` with prompt to follow prompts
   - **Step 3**: "Verify connection" → explanation to click button below
6. If `error` prop is set, red error message displays (e.g., "Server not reachable")
7. Large "Check Connection" button at bottom of card
8. User opens terminal, runs steps 1–2 (authenticate via Claude CLI)
9. User returns to app window, clicks "Check Connection"
10. Button enters checking state → "Checking..."
11. useAuth's checkAuth callback re-fires, queries `/api/auth/status`
12. If auth now succeeds, AuthGate re-renders with AppLayout; user proceeds to welcome chat screen

### Variations
- **User closes terminal**: CLI login cached credentials locally; subsequent check still succeeds
- **Multiple retries**: Button can be clicked multiple times; each time re-runs checkAuth
- **Network restored**: User initially offline; later reconnects; "Check Connection" now succeeds
- **Invalid credentials**: User enters wrong API key in CLI → error persists; OnboardingScreen shows same error again

### Edge Cases
- **User minimizes app during login**: Credentials still cached; app continues when restored
- **Button disabled during check**: Prevents double-click submissions while async call in flight
- **Error message truncated**: Very long error text overflows card width → handled by text wrapping and max-width constraint
- **Dark mode**: Card background switches to dark theme automatically via SettingsProvider

---

## STORY-005: Platform Detection & OS-Specific Behaviors

**Type**: short
**Topic**: Desktop App Shell & Sidecar
**Persona**: User across macOS, Windows, Linux
**Goal**: App adapts to platform capabilities and UI patterns
**Preconditions**: App running on specific OS

### Steps
1. On startup, `isTauri()` checks `typeof window !== 'undefined' && '__TAURI__' in window`
2. If true, Tauri APIs are available; desktop features unlocked:
   - Subprocess spawning (git commands, shell scripts)
   - File dialogs (file picker, save dialog)
   - Launcher/opener plugins
3. If false (web or test), Tauri APIs skipped; graceful degradation
4. Platform-specific UI adjustments:
   - macOS: Keyboard shortcuts use `Cmd` key (⌘) in badge labels
   - Windows: Keyboard shortcuts use `Ctrl` key; window chrome follows Windows conventions
   - Linux: Keyboard shortcuts use `Ctrl`; minimal chrome (titlebar-less window possible)
5. Window initialization from `tauri.conf.json` applies platform defaults automatically

### Variations
- **Conditional rendering based on isTauri()**: Components needing Tauri APIs (e.g., file operations) only load if Tauri detected
- **Fallback for web**: Non-Tauri code paths provide API mocks or show error toast
- **Hot-reload in dev**: Vite detects changes; browser reload preserves Tauri window state

### Edge Cases
- **Vite preview mode**: HTML served without Tauri injected; isTauri() returns false initially, then true after Tauri init
- **Test environment**: Jest/Vitest mocks `window.__TAURI__`; tests can assert platform-specific behavior

---

## STORY-006: Welcome Screen with Profile Selection

**Type**: short
**Topic**: Desktop App Shell & Sidecar
**Persona**: Authenticated user starting first chat
**Goal**: See welcome prompt and optionally select an agent profile before chatting
**Preconditions**: Auth passed; no sessions exist or all sessions are empty

### Steps
1. AuthGate passes auth data to AppLayout
2. AppLayout initializes useSessions hook → returns empty sessions array
3. activeSessionId is null → ChatPage not rendered
4. WelcomeScreen renders in main area:
   - Diamond icon (◆) in primary/10 background
   - "Claude Code" heading
   - Help text: "Start a conversation to work with Claude on your code..."
5. If agentProfiles exist and length > 0, ProfileSelector renders below text
6. ProfileSelector shows dropdown or list of available profiles
7. User selects a profile (e.g., "Code Review Agent") → onSelectProfile callback fires → selectedProfileId updates
8. "New Conversation" button becomes enabled
9. User clicks button → createSession fires → new session created with selected profileId
10. ChatPage renders with empty message list
11. Chat input ready for user to type first prompt

### Variations
- **No profiles created**: ProfileSelector not rendered; "New Conversation" button creates session with null profileId
- **Multiple profiles**: Selector shows list or dropdown; first profile pre-selected by default
- **Profile with custom instructions**: Session inherits system prompt from selected profile
- **Session already exists but empty**: WelcomeScreen still shown; "New Conversation" creates additional session instead of reusing

### Edge Cases
- **Profile deleted**: onSelectProfile callback receives deleted profileId; session creation still succeeds but may fail at chat time
- **Keyboard shortcut ⌘N**: Fires handleNewChat even if WelcomeScreen focused
- **Dark mode**: Logo and background colors adjust; text remains readable

---

## STORY-007: Error Boundary Recovery & Crash Handling

**Type**: medium
**Topic**: Desktop App Shell & Sidecar
**Persona**: User experiencing rendering error
**Goal**: See error message and recover without restarting app
**Preconditions**: Child component throws error during render

### Steps
1. Child component throws error (e.g., null reference in ChatPage)
2. React error propagates → ErrorBoundary.componentDidCatch fires
3. Error logged to console: `"[ErrorBoundary] Caught error: ..."`
4. ErrorBoundary state updates: `{ hasError: true, error }`
5. Error boundary renders fallback UI:
   - Full-screen centered container
   - Red heading: "Something went wrong"
   - Description: "An unexpected error occurred. You can try again or reload the application."
   - "Try Again" button
6. User clicks "Try Again" → handleReset() → state resets to `{ hasError: false, error: null }`
7. Child components re-render; if error condition resolved, page displays normally
8. If error persists: error boundary catches again, fallback shown again (error message same)
9. User can reload app (Cmd+R or Ctrl+R) or close/reopen window

### Variations
- **Transient error**: Error caused by race condition; second render succeeds → "Try Again" works immediately
- **Persistent error**: Bug in code path always triggers error → "Try Again" shows same error indefinitely
- **Error in ErrorBoundary itself**: Boundary cannot catch own errors; app crashes to white screen or Tauri error dialog
- **Multiple nested boundaries**: Parent and child boundaries both active; child catches first, child's fallback shown

### Edge Cases
- **Error in error message display**: If fallback UI throws, Tauri shows window crash dialog
- **User clicks "Try Again" rapidly**: setState batches multiple resets; single re-render attempt
- **Error in Agentation system**: agentation-specific errors bubble up to top ErrorBoundary; same recovery flow

---

## STORY-008: Loading State During Server Startup Delay

**Type**: short
**Topic**: Desktop App Shell & Sidecar
**Persona**: User on slow machine or network
**Goal**: See loading indicator while server boots
**Preconditions**: App launched; server taking >1 second to start

### Steps
1. App boots → ErrorBoundary wraps App → App renders AuthGate
2. AuthGate initializes useAuth → loading state = true
3. useAuth schedules fetch('http://localhost:3131/api/auth/status') on mount
4. Server process still initializing; no HTTP listener yet
5. Fetch request hangs (connection refused or timeout)
6. LoadingScreen renders:
   - Centered spinner (8×8px, animated spin, 4px border)
   - "Connecting..." text below
7. User waits 2–5 seconds
8. Server finishes initialization, binds to port
9. Fetch request resolves → useAuth updates state with response
10. Loading state = false → AuthGate re-renders with OnboardingScreen or AppLayout
11. User sees authenticated content or onboarding

### Variations
- **Very slow server**: AUTH_TIMEOUT_MS (10s) elapses → timeout error returned → OnboardingScreen with "Auth check timed out after 10s"
- **Network connectivity issue**: Fetch fails before timeout → useAuth catches error → returns `{ authenticated: false, error: 'Server not reachable' }`
- **App backgrounded**: User switches apps during load → when app returns to focus, loading may still be in progress or complete

### Edge Cases
- **Multiple mounts**: If useAuth component remounts before first fetch completes, race condition; last response wins
- **Spinner CSS animation**: Reduced-motion preference respected via `@media (prefers-reduced-motion)`

---

## STORY-009: Multi-View Navigation & State Persistence

**Type**: medium
**Topic**: Desktop App Shell & Sidecar
**Persona**: Advanced user switching between Chat, Teams, and Workspaces
**Goal**: Switch views without losing current state
**Preconditions**: Authenticated; multiple views have data (sessions, profiles, projects, workspaces)

### Steps
1. User in Chat view (activeView = 'chat') with active session displayed
2. User clicks "Projects" icon in Activity Bar
3. onSelectView('workspaces') callback fires → setActiveView('workspaces')
4. App re-renders → ChatPage unmounts → ProjectSidebar and WorkspacePanel mount
5. useProjects hook loads projects from API
6. ProjectSidebar displays project list
7. User selects a project → setSelectedProjectId(projectId)
8. useWorkspaces hook loads workspaces for that project
9. WorkspacePanel displays workspace list and details
10. User clicks "Chat" icon → onSelectView('chat')
11. Chat view re-mounts with previousState:
    - activeSessionId preserved in state
    - useSessions returns same sessions as before
    - ChatPage renders with previous session active
12. Session message list and input restored

### Variations
- **Teams view**: Clicking Teams icon switches to TeamsView; team creation/editing UI shown; switching back to Chat preserves chat state
- **Agent Builder**: Clicking Agents opens AgentBuilderView (visual hook canvas); previous profile selection preserved
- **Sidebar collapse/expand**: Sidebar state tracked separately; persists across view switches

### Edge Cases
- **Session deleted while in Teams view**: User switches back to Chat → activeSessionId now invalid → ChatPage handles gracefully (shows WelcomeScreen or first valid session)
- **Project removed from backend**: ProjectSidebar re-renders with missing project; selectedProjectId may become null
- **Window closed during heavy load**: App state lost; on reopen, ActiveView defaults to Chat, activeSessionId lost

---

## STORY-010: Settings Panel Access & Quick Open

**Type**: short
**Topic**: Desktop App Shell & Sidecar
**Persona**: User adjusting app preferences
**Goal**: Open settings panel via keyboard or button
**Preconditions**: App authenticated; any view active

### Steps
1. User presses Cmd+, (macOS) or Ctrl+, (Windows/Linux) globally → Global keyboard handler fires
2. handleOpenSettings() callback invoked → setSettingsOpen(true)
3. SettingsPanel mounts as overlay/modal
4. SettingsPanel initializes with settingsInitialTab (defaults to undefined, shows first tab)
5. Tabs available: Appearance, Notifications, Workspace, MCP Servers, Memory, Instructions, Hooks, Privacy Mode
6. User adjusts settings (e.g., toggle dark theme)
7. useSettings hook pushes changes to API
8. UI updates immediately (optimistic update)
9. User closes panel (Esc key or close button) → setSettingsOpen(false)
10. Settings persisted in backend database

### Variations
- **Open settings to specific tab**: User clicks gear icon in Activity Bar → handleOpenSettings('notifications') → panel opens on Notifications tab
- **Settings on other views**: Shortcut works from Teams, Agents, Workspaces views equally
- **unsaved changes**: Changes auto-save; no "Save" button needed

### Edge Cases
- **Settings API slow**: User adjusts setting → optimistic update on UI; if API fails, change reverted
- **Multiple SettingsPanel mounts**: Only one instance open at a time (modal state)

---

## STORY-011: Quit Confirmation for Running Agents

**Type**: short
**Topic**: Desktop App Shell & Sidecar
**Persona**: User with active subagent tasks
**Goal**: Prevent accidental quit while agents working
**Preconditions**: App has subagent running (subagentActiveCount > 0)

### Steps
1. User starts a subagent task in workspace or chat (e.g., code review)
2. App tracks subagentActiveCount via ref variable in AppLayout
3. Subagent runs in parallel, status tracked in Teams/Workspaces view
4. User presses Cmd+Q (macOS) or tries to close window via OS button
5. beforeunload event fires on window
6. Handler checks `subagentActiveCountRef.current > 0`
7. If true: `e.preventDefault()` → OS shows "Are you sure?" confirmation
8. User confirms quit → browser/OS closes window → Tauri terminates app and child processes
9. Subagent task interrupted; workspace may end up in partial state

### Variations
- **No agents running**: beforeunload handler allows quit without confirmation
- **Quit via App menu**: Same beforeunload logic applies (browser-standard)
- **Force quit**: User can force-quit via Activity Monitor/Task Manager; subagent cleanup may be incomplete

### Edge Cases
- **Agent completes during quit flow**: subagentActiveCount decrements; if it reaches 0 before user confirms, quit is allowed
- **Multiple agents running**: Counter tracks total; quit blocked if any agent active

---

## STORY-012: App Startup Sequence & Initialization Order

**Type**: long
**Topic**: Desktop App Shell & Sidecar
**Persona**: DevOps/debugging engineer
**Goal**: Understand complete startup flow for troubleshooting
**Preconditions**: Fresh app launch

### Steps
1. **Tauri bootstrap** (rust):
   - Tauri spawns main process
   - Initializes plugins: Dialog, Shell, Opener
   - Reads `tauri.conf.json` → window size (1200×800), title ("Claude Code"), external bins
   - Spawns server child process: `./binaries/server` (or `bun src/index.ts` in dev)
   - Launches webview with dev URL or bundled HTML

2. **Frontend initialization** (React/TypeScript):
   - Vite loads `src/main.tsx` → ReactDOM.createRoot renders App component
   - App wrapped in ErrorBoundary at top level
   - App mounts → renders AuthGate immediately

3. **Auth check phase**:
   - AuthGate renders LoadingScreen with spinner
   - useAuth hook initializes, schedules checkAuth on mount
   - checkAuth fetches `/api/auth/status`
   - Server receives request, queries Claude API via SDK
   - Response includes `{ authenticated, email, plan }` or error

4. **Post-auth rendering**:
   - If authenticated: AuthGate renders AppLayout
   - AppLayout mounts hooks: useSessions, useProjects, useAgentProfiles, useWorkspaces, useTheme, useSettings, useUnread
   - All hooks fetch data in parallel from `/api/*` endpoints
   - Notification permission requested
   - Global keyboard listeners attached (Cmd+, for settings, Cmd+N for new chat, etc.)
   - Activity Bar, sidebars, main area render

5. **If not authenticated**:
   - AuthGate renders OnboardingScreen
   - User sees 3-step setup instructions
   - User can click "Check Connection" to retry auth

6. **Readiness**:
   - App fully interactive; user can chat, create projects, configure agents
   - Notification system armed
   - Unload handler registered (quit confirmation)

### Variations
- **Dev mode**: Hot reload on file change → Vite re-bundles frontend; Tauri webview refreshes instantly
- **Slow API responses**: Auth completes, but projects/sessions/profiles load asynchronously; UI shows partial state
- **Server crash during startup**: API calls fail; retry UI shown; user can trigger manual refresh

### Edge Cases
- **Auth succeeds but data fetch fails**: LoadingScreen may persist if data hooks hang
- **Multiple rapid refreshes**: React batches state updates; network requests may race
- **Browser dev tools open**: App initialization slower due to extra logging overhead

---

## STORY-013: Window State Recovery & Restore on Reopen

**Type**: short
**Topic**: Desktop App Shell & Sidecar
**Persona**: User reopening app after close
**Goal**: Window position/size restored; app state preserved
**Preconditions**: App previously closed normally

### Steps
1. User launches app again (double-click icon or via command line)
2. Tauri reads last stored window geometry (position, size)
3. Tauri restores window to previous location and dimensions
4. Frontend re-initializes → App mounts → ErrorBoundary → AuthGate
5. useAuth checks auth again (may succeed if credentials cached)
6. useSessions loads sessions from backend database (includes message count, timestamps)
7. activeSessionId state defaults to null → if no sticky storage, defaults to first session or WelcomeScreen
8. UI re-renders with same data as last closure

### Variations
- **Explicit session persistence**: Session ID stored in localStorage → on reopen, sets activeSessionId to previous session
- **First launch**: No window geometry stored; Tauri uses defaults (1200×800, centered on screen)
- **Monitor configuration changed**: Restored position may be off-screen; Tauri enforces minimum visible bounds

### Edge Cases
- **Database file corrupted**: Sessions fail to load → empty list; WelcomeScreen shown
- **Session deleted on backend**: activeSessionId points to non-existent session → handled gracefully (falls back to null or first session)

---

## STORY-014: Error Recovery & Graceful Degradation

**Type**: medium
**Topic**: Desktop App Shell & Sidecar
**Persona**: User with network issues or API failures
**Goal**: App remains usable despite partial failures
**Preconditions**: App launched; intermittent API failures

### Steps
1. **Phase 1: Auth succeeds**: User authenticated via `/api/auth/status`
2. **Phase 2: Data fetch fails**: useSessions calls `/api/sessions` → network timeout
3. ErrorBanner mounts in ChatPage: "Failed to load sessions. Retrying..."
4. useSessions enters error state; retry mechanism auto-triggers after backoff (3s, 6s, 12s...)
5. User can click "Retry" button to force immediate retry
6. If eventual success: ErrorBanner disappears, sessions list populates
7. If persistent failure: ErrorBanner persists, retry button visible
8. User can still navigate other views (Projects, Teams) which may succeed independently
9. Subagent conversation may proceed even if sessions list fails (optimistic rendering)

### Variations
- **API returns 500**: Error message displays (red text); suggests server restarted
- **Network fully down**: All API calls fail; "Server not reachable" error; retry button disabled until network restored
- **Partial data loss**: One sessions endpoint fails, but /api/projects succeeds; Projects view works, Chat shows error

### Edge Cases
- **Intermittent network**: Retry succeeds on 2nd or 3rd attempt → data populates after delay
- **User closes app during retry**: Pending fetch aborted; no error logged
- **Server restarted during session**: In-flight requests fail; user sees transient error; subsequent requests succeed

---

## STORY-015: Performance & Resource Cleanup on View Switch

**Type**: short
**Topic**: Desktop App Shell & Sidecar
**Persona**: User rapidly switching between Chat and Workspaces
**Goal**: App remains responsive; no memory leaks or orphaned processes
**Preconditions**: App running with multiple active hooks and listeners

### Steps
1. User in Chat view → useSessions hook running, keyboard listeners active, WebSocket connections open (if streaming)
2. User clicks "Projects" icon → setActiveView('workspaces')
3. ChatPage component unmounts:
   - useEffect cleanup functions run (remove keyboard listeners, abort in-flight fetches, close streams)
   - Event listeners detached
   - timers cleared
4. ProjectSidebar and WorkspacePanel mount:
   - useProjects and useWorkspaces hooks initialize
   - New API calls to `/api/projects` and `/api/workspaces`
5. User rapidly clicks "Chat" again:
   - Workspaces view cleanup begins
   - Chat view remounts immediately
   - Duplicate listeners prevented (ChatPage checks if already mounted)
6. App remains responsive; no lag or jank

### Variations
- **Streaming in progress**: User switches view mid-stream → fetch abort triggered; stream stops cleanly
- **Large project list**: View switch may take 200–500ms while new data fetches; spinner shown

### Edge Cases
- **Rapid spam-clicking**: React batches updates; only final view rendered (no wasted re-renders)
- **Memory profiler shows leak**: useCallback or useMemo missing → listeners not cleaned up; detected in testing
---
