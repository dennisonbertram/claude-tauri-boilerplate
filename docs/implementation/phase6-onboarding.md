# Phase 6: Onboarding Screen

## Summary

Implemented the onboarding screen that guides users through setting up their Claude Code authentication. This is shown automatically when the auth check fails.

## How It Works

1. `AuthGate` component wraps the entire app
2. On mount, `useAuth` calls `GET /api/auth/status`
3. If `authenticated: false`, the `OnboardingScreen` is shown
4. OnboardingScreen displays three setup steps:
   - Install Claude Code (`npm install -g @anthropic-ai/claude-code`)
   - Log in (`claude login`)
   - Click "Check Connection" to re-verify
5. The "Check Connection" button calls `checkAuth()` which re-fetches auth status
6. Once authenticated, AuthGate renders the main app layout

## Components

- **`AuthGate`** (`src/components/auth/AuthGate.tsx`) — Render-prop component. Shows loading spinner during initial check, OnboardingScreen if not authenticated, or children with auth data.
- **`OnboardingScreen`** (`src/components/auth/OnboardingScreen.tsx`) — Card with numbered steps. Shows error message from server if present. Loading state on "Check Connection" button.

## Error Handling

- If the server is not reachable, `useAuth` sets `error: 'Server not reachable'`
- If the server returns an auth error, it's displayed below the steps
- The "Check Connection" button shows "Checking..." state while verifying

## Design

- Centered card layout on dark background
- Uses shadcn/ui Card, Button components
- Numbered step indicators with primary-colored circles
- Code blocks for CLI commands
- Clean, focused design that doesn't overwhelm new users
