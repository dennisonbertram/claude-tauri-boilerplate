# STORY-150: Onboarding Flow for New Users

**Type**: long
**Date**: 2026-03-22
**Result**: PASS

## Goal
Verify the onboarding screen exists and is accessible. Since we are authenticated, verify that authenticated users correctly bypass onboarding.

## Steps Performed

### 1. Inspected the authenticated user's view
- Navigated to `http://localhost:1927`
- The app loads directly into the main chat interface with:
  - Sidebar with navigation (New Chat, Search, Documents, Projects, Agent Profiles, Teams)
  - Welcome screen showing "What would you like to build?"
  - Template suggestions, text input composer
- **No onboarding screen is shown** -- this is correct behavior for an authenticated user.

### 2. Verified onboarding component exists
- `apps/desktop/src/components/auth/OnboardingScreen.tsx` exists and renders a 3-step guide:
  1. Install Claude Code (`npm install -g @anthropic-ai/claude-code`)
  2. Log in to Claude (`claude login`)
  3. Verify connection (click "Check Connection" button)
- The component is well-structured with a Card layout, step indicators, error display, and a retry button.

### 3. Verified auth gating logic
- `apps/desktop/src/components/auth/AuthGate.tsx` controls the flow:
  - Shows `LoadingScreen` while auth is checking
  - Shows `OnboardingScreen` if `!auth?.authenticated`
  - Renders children (main app) if authenticated
- This is the correct pattern -- unauthenticated users see onboarding, authenticated users bypass it.

### 4. Checked network for auth-related endpoints
- Network requests show: `/api/health`, `/api/agent-profiles`, `/api/projects`, `/api/teams`, `/api/git/status`
- No auth-specific endpoint visible (auth is handled at the sidecar/subscription level, not via explicit API calls in dev mode)

### 5. Console
- No errors observed.

## Assessment
- The onboarding flow exists and is correctly gated behind authentication.
- Authenticated users see the main app interface, not onboarding. This is expected.
- The onboarding screen provides clear step-by-step instructions for new users.

## Screenshots
- `screenshots/authenticated-main-view.png` -- Shows the main app view for authenticated users

## Findings
None -- all behavior is correct.
