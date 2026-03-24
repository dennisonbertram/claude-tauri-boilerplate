# STORY-015: Handle Session with Profile Badge

## Goal
Verify profile badges on sessions.

## Steps Taken
1. Inspected all visible sessions in sidebar for profile badges
2. Used JavaScript evaluation to check for profile badge elements in DOM
3. Analyzed source code for ProfileBadge component and its usage

## Findings

### Profile Badge Implementation: EXISTS but NOT VISIBLE
- The `ProfileBadge` component exists at `apps/desktop/src/components/agent-builder/shared/ProfileBadge.tsx`
- It renders: colored pill with optional icon emoji + profile name
- SessionItem conditionally renders `<ProfileBadge>` when `session.profile` is set
- **None of the current sessions have a profile assigned**, so no badges are visible

### ProfileBadge Component Details
- Accepts `AgentProfileSummary` with `name`, `icon`, and `color` properties
- Renders as an inline-flex pill: `px-1.5 py-0.5 rounded text-xs`
- Color is applied dynamically via inline styles when `profile.color` exists
- Icon is an emoji displayed to the left of the profile name
- Name is truncated at 80px max width

### SessionItem Integration
- Location: `apps/desktop/src/components/sidebar/SessionItem.tsx` line 204-208
- Badge renders below the session title in a `mt-0.5` wrapper
- Only shows when `session.profile` is truthy

### Gap
- No way to test badge rendering without creating a session with an agent profile
- Cannot verify visual appearance of badges in current state

## Severity
- **Info**: Feature implemented but not exercisable with current data

## Screenshots
- `01-no-profile-badges-visible.png` -- Session list with no profile badges (none have profiles assigned)
