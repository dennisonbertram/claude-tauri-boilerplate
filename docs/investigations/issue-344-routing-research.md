# Issue 344 — Routing Architecture Research

## Current Navigation State Machine

### Primary state variable

```ts
// apps/desktop/src/App.tsx, line 42
const [activeView, setActiveView] = useState<'chat' | 'teams' | 'workspaces' | 'agents' | 'documents' | 'tracker'>('chat');
```

There is **no router** — no `react-router`, no `HashRouter`, no URL-based routing at all. The entire app is a single-page state machine driven by `activeView` in `AppLayout`.

### View enum values and what they render (App.tsx lines 97-111)

| `activeView` | Component rendered | Notes |
|---|---|---|
| `'chat'` | `ChatPage` or `WelcomeScreen` | Depends on `activeSessionId \|\| pendingMessage` |
| `'workspaces'` | `WorkspacePanel` or `ProjectsGridView` | Depends on `selectedWorkspace` |
| `'tracker'` | `TrackerView` | No sub-states |
| `'documents'` | `DocumentsView` | No sub-states |
| `'agents'` | `AgentBuilderView` | No sub-states |
| `'teams'` | `TeamsView` | Fallback/default branch |

### Chat view sub-states

Within `activeView === 'chat'`, there is a secondary state machine:

```
activeSessionId  pendingMessage  => Renders
───────────────  ──────────────  ──────────
null             null            => WelcomeScreen
null             "some text"     => ChatPage (key='new-chat')
"abc-123"        any             => ChatPage (key='abc-123')
```

Key variables:
- `activeSessionId: string | null` — from `useSessions()` hook
- `pendingMessage: string | null` — set by WelcomeScreen submit
- `pendingWelcomeSessionId: string | null` — set when server responds with session ID
- `activeSessionHasMessages: boolean` — tracks whether the active session has content
- `openSessionIds: string[]` — tab bar state for multi-tab chat

### Workspaces view sub-states

```
selectedWorkspace  => Renders
─────────────────  ──────────
null               => ProjectsGridView (grid of all projects)
Workspace object   => WorkspacePanel (single workspace detail)
```

Key variables:
- `selectedProjectId: string | null`
- `selectedWorkspace: Workspace | null`

---

## Navigation Triggers

### 1. AppSidebar (apps/desktop/src/components/AppSidebar.tsx)

The sidebar has two modes: **expanded** (`sidebarOpen=true`, 260px) and **collapsed** (56px icon strip).

**Nav items defined at line 56-61:**
```ts
const navItems = [
  { view: 'documents', icon: FileText, label: 'Documents' },
  { view: 'workspaces', icon: FolderOpen, label: 'Projects' },
  { view: 'agents', icon: Robot, label: 'Agent Profiles' },
  { view: 'teams', icon: UsersThree, label: 'Teams' },
];
```

**Navigation actions:**
- `onSelectView(view)` — calls `handleSwitchView` in App.tsx
- `onNewChat()` — calls `handleNewChat`: resets to chat view + null session
- `onSelectSession(id)` — sets `activeView='chat'` + `setActiveSessionId(id)`
- `onOpenSettings()` — opens settings overlay (not a view change)
- `onSelectWorkspace(ws)` — selects a workspace (stays in workspaces view)
- Search button / Cmd+K — switches to chat view + focuses search input

Note: There is **no 'chat' entry in `navItems`**. The "New Chat" button serves as the chat nav. The "Recents" session list only shows when `activeView === 'chat'`.

### 2. ViewSwitcherHeader (apps/desktop/src/app/ViewSwitcherHeader.tsx)

A floating pill-shaped tab bar that **only renders when `activeView === 'chat'`** (line 7). Shows 4 quick-switch tabs:

| Tab label | View value |
|---|---|
| Chat | `'chat'` |
| Code | `'workspaces'` |
| Cowork | `'teams'` |
| Tracker | `'tracker'` |

### 3. Keyboard shortcuts (apps/desktop/src/app/useAppKeyboardShortcuts.ts)

| Shortcut | Action |
|---|---|
| `Cmd+T` | New chat (only when `activeView === 'chat'`) |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cycle through open session tabs |
| `Cmd+,` | Open settings |
| `Cmd+K` | Focus search (in AppSidebar's own keydown handler) |

### 4. ChatPage internal navigation callbacks

ChatPage receives callbacks that trigger view changes:
- `onOpenSessions()` — `setActiveView('chat'); setSidebarOpen(true)`
- `onOpenPullRequests()` — `setActiveView('teams')`
- `onCreateSession` / `onToggleSidebar` / `onOpenSettings` — various actions

---

## Settings Modal Pattern

**File:** `apps/desktop/src/components/settings/SettingsPanel.tsx`

The settings panel is **not a view** — it is a **fixed-position overlay** controlled by:

```ts
const [settingsOpen, setSettingsOpen] = useState(false);
const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>();
```

### Rendering (App.tsx line 114-116)
```tsx
<SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsInitialTab} ... />
```

### Panel structure
- Full-screen semi-transparent backdrop (`fixed inset-0 z-40 bg-black/50`)
- Right-side slide panel (`fixed right-0 top-0 z-50 w-[560px]`)
- Internal left sidebar with 5 groups: General, AI & Model, Data & Context, Integrations, Status
- 13 tab IDs total mapped to groups via `tabToGroup()`

### Deep-link support
`handleOpenSettings(tab?: string)` accepts an optional tab string to jump directly to a specific settings section. Used from ChatPage, StatusBar, and keyboard shortcut.

**Key point for routing:** Settings is an overlay that sits **on top of** the current view. Opening settings does NOT change `activeView`. It should remain an overlay in a routed architecture (not its own route).

---

## State That Would Be Lost on Route Changes

### Critical state to preserve

| State | Location | Risk |
|---|---|---|
| `activeSessionId` | `useSessions()` in AppLayout | Lost if AppLayout unmounts |
| `openSessionIds` | `useState` in AppLayout | Tab bar state lost |
| `pendingMessage` / `pendingWelcomeSessionId` | `useState` in AppLayout | In-flight new chat lost |
| `activeSessionHasMessages` | `useState` in AppLayout | UI state lost |
| `selectedProjectId` | `useState` in AppLayout | Project context lost |
| `selectedWorkspace` | `useState` in AppLayout | Workspace context lost |
| `sessions` (fetched list) | `useSessions()` | Re-fetched (acceptable) |
| `settingsOpen` / `settingsInitialTab` | `useState` in AppLayout | Minor — modal would close |
| `sidebarOpen` | `useState` in AppLayout | Layout preference lost |
| `sessionSearchQuery` | `useState` in AppLayout | Minor |
| `selectedProfileId` | `useState` in AppLayout | Agent profile selection lost |
| `statusData` | `useState` in AppLayout | Streaming status lost |
| `subagentActiveCountRef` | `useRef` in AppLayout | Active count lost |
| ChatPage internal state | Inside ChatPage component | **Messages in textarea, scroll position, streaming state** |

### What is safe to lose
- `sessions` list — re-fetched from API on mount
- `statusData` — rebuilt on next streaming event
- `settingsOpen` — acceptable to close on navigate

### What MUST be preserved
- `activeSessionId` + `openSessionIds` — core tab state
- `pendingMessage` flow — in-progress new chat creation
- `selectedWorkspace` — user's selected workspace context
- ChatPage mount stability — **ChatPage uses `key={activeSessionId}` so it already remounts on session switch; the concern is that parent unmount kills streaming WebSocket connections**

---

## Minimal Diff Strategy for HashRouter Migration

### Recommended approach: Layout Route with persisted state

The key insight is that **AppLayout is a single component that holds ALL state**. A HashRouter migration should keep AppLayout as a persistent layout wrapper, not re-render it per route.

### Architecture

```
<HashRouter>
  <SettingsProvider>
    <AuthGate>
      <Routes>
        <Route element={<AppLayout />}>       {/* persistent layout */}
          <Route path="/" element={<ChatOutlet />} />
          <Route path="/chat" element={<ChatOutlet />} />
          <Route path="/chat/:sessionId" element={<ChatOutlet />} />
          <Route path="/workspaces" element={<WorkspacesOutlet />} />
          <Route path="/workspaces/:projectId" element={<WorkspacesOutlet />} />
          <Route path="/workspaces/:projectId/:workspaceId" element={<WorkspacesOutlet />} />
          <Route path="/teams" element={<TeamsView />} />
          <Route path="/agents" element={<AgentBuilderView />} />
          <Route path="/documents" element={<DocumentsView />} />
          <Route path="/tracker" element={<TrackerView />} />
        </Route>
      </Routes>
    </AuthGate>
  </SettingsProvider>
</HashRouter>
```

### Changes needed

1. **App.tsx** — Wrap with `<HashRouter>`, convert `AppLayout` to use `<Outlet />` instead of the `activeView` conditional block.

2. **Replace `activeView` state with route** — Delete the `useState<ActiveView>` and derive it from `useLocation().pathname`. The `handleSwitchView` callback becomes `navigate('/chat')`, `navigate('/workspaces')`, etc.

3. **AppSidebar** — Change `onSelectView` calls to use `navigate()` (or keep callback pattern but have parent call `navigate`).

4. **ViewSwitcherHeader** — Same: swap `onSwitchView` to navigate calls.

5. **Settings stays as overlay** — No route change needed. Keep `settingsOpen` state as-is. Optionally add `?settings=model` query param for deep-linking.

6. **Session ID in URL** — `activeSessionId` can be synced to `/chat/:sessionId` route param. On session select, `navigate(`/chat/${id}`)`. On new chat, `navigate('/chat')`.

7. **Workspace in URL** — `/workspaces/:projectId/:workspaceId` params replace `selectedProjectId` and `selectedWorkspace` state.

### Files to change (estimated)

| File | Change type | Complexity |
|---|---|---|
| `apps/desktop/src/App.tsx` | Major refactor — add HashRouter, convert to layout route | High |
| `apps/desktop/src/components/AppSidebar.tsx` | Replace `onSelectView` with navigate | Low |
| `apps/desktop/src/app/ViewSwitcherHeader.tsx` | Replace `onSwitchView` with navigate | Low |
| `apps/desktop/src/app/useAppKeyboardShortcuts.ts` | Add `useNavigate()` | Low |
| `package.json` | Add `react-router-dom` dependency | Trivial |

### What NOT to change
- `SettingsPanel` — stays as overlay, no route
- `useSessions` hook — internal API, no changes
- `SettingsContext` — no changes
- ChatPage / WorkspacePanel — receive same props, no changes needed
- StatusBar — no changes

### Risk areas
- **ChatPage streaming stability** — ChatPage already remounts on key change. As long as AppLayout stays mounted (layout route pattern), streaming connections survive view switches.
- **Back/forward button behavior** — Need to handle browser back navigating between views correctly, especially within chat sessions.
- **pendingMessage flow** — The new-chat-with-message flow uses ephemeral state (`pendingMessage`). This could become a query param (`/chat?msg=...`) or remain as component state since it is transient.
