# STORY-152: Welcome Screen with Profile Selection

**Type**: short
**Date**: 2026-03-22
**Result**: WARN (1 finding)

## Goal
Verify welcome/profile selection after auth -- check for profile selector or welcome screen, navigate to chat view, check sidebar for profile-related UI.

## Steps Performed

### 1. Checked the Welcome Screen
- The welcome screen is displayed when no active chat session is selected.
- It shows: "What would you like to build?" with a large text composer and template suggestions.
- The composer has a model selector ("Sonnet 4.6") and project selector ("Select project").
- **No profile/agent profile selector is visible on the welcome screen.**

### 2. Inspected WelcomeScreen component code
- `apps/desktop/src/components/chat/WelcomeScreen.tsx` declares props for profile selection:
  - `agentProfiles?: unknown[]`
  - `selectedProfileId?: string | null`
  - `onSelectProfile?: (id: string | null) => void`
- **However, these props are destructured away and never used in the render output.**
- The component only uses `onNewChat`, `onSubmit`, and `modelDisplay`.

### 3. Checked Agent Profiles view
- Clicked "Agent Profiles" in the sidebar navigation.
- A dedicated Agent Profiles view opened with:
  - A profile list sidebar with search ("Search profiles...")
  - One existing profile: "Code Review Bot Changed Again" with description "Specialized code review agent with strict standards"
  - Empty state: "No profile selected - Select a profile from the sidebar or create a new one"
  - A "+" button to create new profiles
- This is a separate builder/management view, not a profile selector for the chat.

### 4. Checked for profile selection in chat context
- The welcome screen composer does NOT include a way to select an agent profile before starting a chat.
- The model selector shows "Sonnet 4.6" but there is no adjacent profile picker.
- The `WelcomeScreen` interface was designed to support profile selection (the props exist) but the feature was never implemented in the render.

## Assessment
- The welcome screen exists and works well as a chat launcher.
- Agent Profiles exist as a management/builder feature in the sidebar.
- **Profile selection on the welcome screen is stubbed but not implemented** -- the props are declared but unused. This means users cannot select an agent profile before starting a new chat from the welcome screen.
- This is a minor gap: the infrastructure is in place but the UI for profile selection at chat creation time is missing.

## Screenshots
- `screenshots/agent-profiles-view.png` -- Shows the Agent Profiles management view
- `screenshots/welcome-screen-chat.png` -- Shows the welcome screen without profile selector

## Findings
1. **F-152-001** (warn): WelcomeScreen declares profile selection props but does not render a profile picker. Users cannot choose an agent profile when starting a new chat from the welcome screen.
