# STORY-159: Window State Recovery & Restore on Reopen

**Type**: short
**Goal**: Verify state persists across page refresh
**Result**: FAIL — state is not restored on refresh

## Steps Performed

1. **Navigated to the app** at `http://localhost:1927/` — loaded the default chat view with sidebar showing New Chat, Search, Documents, Projects, Agent Profiles, Teams, and conversation history.

2. **Noted the current URL**: `http://localhost:1927/` — the URL does not change regardless of which view is active (New Chat, Teams, Documents, etc.).

3. **Clicked on "Crispy Meadow" conversation** — the conversation loaded in the main pane. URL remained `http://localhost:1927/`.

4. **Refreshed the page** (`reload`) — the app returned to the default view (New Chat / empty state). The previously selected conversation was NOT restored.

5. **Tested Documents view** — navigated to Documents, URL still `http://localhost:1927/`. No route-based state management.

6. **Tested non-existent route** — navigating to `http://localhost:1927/does-not-exist` loads the main app with no 404 page.

## Findings

| ID | Severity | Description |
|----|----------|-------------|
| F-159-001 | medium | No URL-based routing — all views share the same URL `/`, making deep-linking and bookmarking impossible |
| F-159-002 | medium | No state recovery on page refresh — navigating to a conversation then refreshing returns to default empty state |
| F-159-003 | low | No 404 page for unknown routes — any path loads the main app |

## Screenshots

- `screenshots/01-initial-state.png` — Initial app load
- `screenshots/02-teams-view.png` — After clicking Teams (redirected to connection page)
- `screenshots/03-conversation-view.png` — After selecting a conversation
- `screenshots/04-after-reload.png` — After page refresh (state lost)
