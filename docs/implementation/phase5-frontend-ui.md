# Phase 5: Frontend Chat UI

## Summary

Built the complete frontend chat interface for the desktop app using React 19, Tailwind v4, shadcn/ui, and the Vercel AI SDK v6 `useChat` hook.

## Dependencies Added

- `@ai-sdk/react` v3 — React hooks for AI chat streaming
- `ai` v6 — Core AI SDK, provides `DefaultChatTransport`
- shadcn/ui components: `button`, `input`, `card`, `scroll-area`, `separator`, `avatar`
- `@base-ui/react`, `@fontsource-variable/geist`, `tw-animate-css` (shadcn deps)

## Architecture

### Hooks

- **`useAuth`** (`src/hooks/useAuth.ts`) — Checks authentication status via `GET /api/auth/status`. Returns `{ auth, loading, checkAuth }`.
- **`useSessions`** (`src/hooks/useSessions.ts`) — Manages session CRUD via the sessions API. Returns sessions list, active session, and mutation functions.

### Components

#### Auth Components (`src/components/auth/`)
- **`AuthGate`** — Render-prop wrapper. Shows loading spinner, then onboarding screen (if not authenticated), then children with auth data.
- **`OnboardingScreen`** — Step-by-step setup instructions (install Claude Code, login, verify).
- **`UserBadge`** — Avatar + email + plan display for the sidebar.

#### Session Components (`src/components/sessions/`)
- **`SessionSidebar`** — Fixed 280px sidebar with user badge, "New Chat" button, and scrollable session list. Hover reveals delete button.

#### Chat Components (`src/components/chat/`)
- **`ChatPage`** — Main chat view. Uses `useChat` with `DefaultChatTransport` pointed at `http://localhost:3131/api/chat`. Manages input state locally and calls `sendMessage({ text })`.
- **`MessageList`** — Renders messages with user messages right-aligned (primary color) and assistant messages left-aligned (muted). Auto-scrolls to bottom. Shows bouncing dots while waiting for assistant response.
- **`ChatInput`** — Auto-resizing textarea with send button. Enter to send, Shift+Enter for newline. Disabled during streaming.

### App Layout (`src/App.tsx`)

Preserves existing sidecar boot logic (Tauri-only). Once server is ready, wraps in `AuthGate` which shows onboarding or the main layout. Main layout is `SessionSidebar` + `ChatPage` in a flex row.

## Configuration

- Dark mode enabled via `class="dark"` on `<html>` in `index.html`
- shadcn/ui CSS variables in `src/index.css` (auto-generated)
- Path alias `@/` mapped to `src/` in both `tsconfig.json` and `vite.config.ts`
- API base URL hardcoded to `http://localhost:3131` (the Hono server)

## AI SDK v6 Changes

The `useChat` hook in `@ai-sdk/react` v3 uses a new API:
- No `input`/`handleInputChange`/`handleSubmit` — instead use `sendMessage({ text })`
- No `isLoading` — instead use `status` which is `'ready' | 'submitted' | 'streaming' | 'error'`
- Transport-based config: `DefaultChatTransport({ api, body })` instead of direct `api`/`body` props

## Files Changed

| File | Change |
|------|--------|
| `apps/desktop/package.json` | Added `@ai-sdk/react`, `ai`, shadcn deps |
| `apps/desktop/index.html` | Added `class="dark"` to `<html>` |
| `apps/desktop/tsconfig.json` | Added `baseUrl` and `paths` for `@/` alias |
| `apps/desktop/vite.config.ts` | Added resolve alias for `@/` |
| `apps/desktop/src/index.css` | shadcn theme variables (auto-generated) |
| `apps/desktop/src/App.tsx` | AuthGate + sidebar/chat layout |
| `apps/desktop/src/hooks/useAuth.ts` | New — auth status hook |
| `apps/desktop/src/hooks/useSessions.ts` | New — session management hook |
| `apps/desktop/src/components/auth/AuthGate.tsx` | New — auth gating component |
| `apps/desktop/src/components/auth/OnboardingScreen.tsx` | New — onboarding UI |
| `apps/desktop/src/components/auth/UserBadge.tsx` | New — user info display |
| `apps/desktop/src/components/sessions/SessionSidebar.tsx` | New — session sidebar |
| `apps/desktop/src/components/chat/ChatPage.tsx` | New — main chat view |
| `apps/desktop/src/components/chat/MessageList.tsx` | New — message display |
| `apps/desktop/src/components/chat/ChatInput.tsx` | New — message input |
| `apps/desktop/src/components/ui/*.tsx` | New — shadcn components |
| `apps/desktop/src/lib/utils.ts` | New — shadcn utility (cn) |
