# STORY-147: App Launch & Window Initialization - Walk Report

**Date**: 2026-03-22
**Tester**: UX Walker (automated)
**App URL**: http://localhost:1927
**Session**: ux-walker-localhost

---

## Step 1: Main window appears with content

**Result: PASS**

The app loads at `http://localhost:1927` and renders a fully functional main window. The central area shows a welcome screen with the heading "What would you like to build?", a subtitle "Claude Code is your AI pair programmer. Learn how to use it.", a text input area, template suggestions, and a model/project selector in the bottom toolbar.

Screenshot: `screenshots/step-1-initial.png`

## Step 2: ErrorBoundary wraps the entire app

**Result: PASS**

Verified in source code (`apps/desktop/src/App.tsx`). The `<ErrorBoundary>` component wraps everything inside the render: `SettingsProvider`, `AuthGate`, `AppLayout`, and `ThemedToaster`. A `<LoadingScreen />` is shown if the server is not ready yet, which sits outside the ErrorBoundary.

## Step 3: Window title shows "Claude Code"

**Result: PASS**

`document.title` returns "Claude Code" as expected.

## Step 4: Activity Bar (left sidebar) with navigation

**Result: PASS**

The sidebar contains 6 navigation buttons:
1. New Chat (with + icon)
2. Search
3. Documents
4. Projects
5. Agent Profiles
6. Teams

Note: The story expected "Chat/Projects/Teams/Agents" but the actual navigation is richer with 6 items. "Agents" is labeled "Agent Profiles" in the actual UI.

Below the nav, a "RECENTS" section shows conversation history with a filter textbox and date-grouped entries (TODAY, YESTERDAY, THIS WEEK).

At the bottom of the sidebar: User avatar/name and Settings gear icon.

## Step 5: AuthGate proceeds directly to auth check

**Result: PASS**

The app loaded directly into the main interface without any auth prompt or onboarding screen, indicating the AuthGate resolved successfully (dev mode skips auth).

## Step 6: App shows main interface

**Result: PASS**

The main interface is displayed with the chat welcome screen, not the onboarding screen. This is expected since the server is running.

---

## Navigation Tab Testing

### Chat Tab
Displays the main chat interface with welcome message, input area, and template suggestions. Sidebar shows conversation history.
Screenshot: `screenshots/step-1-initial.png`

### Code Tab
Navigates to a Projects view showing project cards (e.g., "ai-domain-registration") with workspace info. The top tab bar (Chat/Code/Cowork) disappears and is replaced by a project-specific header.
Screenshot: `screenshots/step-2-code-tab.png`

### Cowork Tab
Shows "Agent Teams" page with a "New Team" button and empty state ("No teams yet - Create a team to coordinate multiple agents working together.").
Screenshot: `screenshots/step-4-cowork-tab.png`

### Documents
Shows a search/filter interface for documents with file results (e.g., middleware.ts, session-provider.tsx). Has "Recent Searches" sidebar.
Screenshot: `screenshots/step-5-documents.png`

### Agent Profiles
Shows a two-column layout: profile list on the left (with one profile "Code Review Bot Changed A...") and a detail pane on the right ("No profile selected").
Screenshot: `screenshots/step-6-agent-profiles.png`

### Search
Clicking Search navigates back to the Chat view with the recents sidebar visible. There is no dedicated search page; search appears to be integrated into the sidebar filter.
Screenshot: `screenshots/step-7-search.png`

---

## Sidebar Toggle

The sidebar toggles between expanded (with labels) and collapsed (icon-only) states. Both states render cleanly. The main content area adjusts width accordingly. The toggle button label changes from "Toggle sidebar" to "Expand sidebar" when collapsed.
Screenshot: `screenshots/step-8-sidebar-collapsed.png`

---

## UX Audit Checklist

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Simplicity** | PASS | Welcome screen is clean, not overwhelming. Three template suggestions provide gentle guidance. |
| **Progressive disclosure** | PASS | Templates and project selector appear only in the welcome state. |
| **Layout quality** | PASS | Content fills the viewport. No excess whitespace. Sidebar proportions are appropriate. |
| **Visual correctness** | PASS | No overflow, broken divs, or misalignment detected. Theme is consistent (warm neutral palette). |
| **Happy path clarity** | PASS | The input field with placeholder "How can I help you build today?" makes the primary action clear. |
| **Typography** | PASS | Large heading, readable body text, clear hierarchy. |
| **Interaction feedback** | PASS | All navigation clicks responded immediately. Active state highlighting visible on sidebar items. |

---

## Issues Found

### Low: Conversations displayed as timestamps only
Several conversation entries in the RECENTS sidebar show only timestamps (e.g., "Mar 21 at 9:15 PM", "Mar 21 at 2:53 PM") instead of meaningful titles. This occurs for ~15+ conversations. While not broken, it reduces scannability of the conversation history.

### Suggestion: Search nav item behavior unclear
Clicking "Search" in the sidebar navigation returns to the Chat view rather than opening a dedicated search interface. The filter textbox in the sidebar is the search mechanism, but this may not be obvious to users who expect a separate search page.

---

## Console Errors

None detected. Clean console output.

## Summary

All 6 story steps pass. The app launches cleanly, shows "Claude Code" as the window title, renders the ErrorBoundary-wrapped main interface, and provides a well-organized sidebar with navigation. The UI is visually clean, responsive to sidebar toggling, and free of console errors. Two minor observations were noted (timestamp-only conversation names, and search nav behavior).
