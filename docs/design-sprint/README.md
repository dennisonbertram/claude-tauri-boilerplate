# Design Sprint — Light Mode

**Date:** 2026-03-20
**Theme:** Light Mode (Warm Parchment)
**Status:** In Progress — dark mode and IDE layouts to follow

## Pages

| # | File | Page | Description |
|---|------|------|-------------|
| 01 | light-mode/01-home.html | Home / Welcome | Empty state with composer, template suggestions, community card |
| 02 | light-mode/02-active-session.html | Active Chat | Split view — chat thread left, live browser preview right |
| 03 | light-mode/03-projects.html | Projects | Card grid with filters, progress bars, tech tags |
| 04 | light-mode/04-agent-profiles.html | Agent Profile Editor | Form with system prompt, parameters panel, framework tags |
| 05 | light-mode/05-settings.html | Settings | Profile, billing/usage, model preferences, keyboard shortcuts |
| 06 | light-mode/06-teams.html | Teams | Member table, pending invitations, activity feed |
| 07 | light-mode/07-search.html | Search | Code search with file results grouped by project |
| 08 | light-mode/08-component-library.html | Component Library | All 18 missing components across 4 priority tiers |

## Design Decisions

- **Layout:** Fixed 260px sidebar + flex-1 main area. No activity bar icon strip (sidebar handles all navigation as a full list).
- **Navigation pattern:** Sidebar has nav links at top, recents list below, user badge at bottom. Floating pill switcher in header for sub-modes (Chat/Code/Cowork).
- **Composition:** Composer is a large rounded card (not an input bar) on the home screen; shrinks to a pill bar during active sessions.
- **Color philosophy:** Warm off-white backgrounds, not neutral gray. Text is warm black (#1a1816), not pure black.
- **Accent:** Orange (#f97316) used sparingly — for AI avatar/logo, live badges, and active highlights.
- **Code blocks:** Dark (#1e1e1e) even in light mode, with warm file headers.

## Component Library Status

All 18 missing components have been designed. See `light-mode/08-component-library.html`.

### Priority 1 — Core UI ✅
| # | Component | Status |
|---|-----------|--------|
| 1 | Modal / Dialog | ✅ Designed — 4 variants: confirm, create form, destructive, success |
| 2 | Dropdown / Context Menu | ✅ Designed — 3 variants: 3-dot actions, sort select, model picker |
| 3 | Toast / Notification | ✅ Designed — 5 variants: success, error, info, task complete, warning |
| 4 | Empty States | ✅ Designed — 4 variants: no projects, no results, no sessions, first-time welcome |
| 5 | Loading / Skeleton States | ✅ Designed — 4 variants: card skeleton, message skeleton, code skeleton, spinner |

### Priority 2 — Chat & Workspace ✅
| # | Component | Status |
|---|-----------|--------|
| 6 | Tool Call Card | ✅ Designed — 6 states: reading, running, writing (progress), complete, permission, error |
| 7 | Permission Dialog (Inline) | ✅ Designed — Risky action with command preview, Deny/Allow once |
| 8 | Diff View | ✅ Designed — File tree sidebar + unified diff with line numbers |
| 9 | Tab Strip | ✅ Designed — 2 variants: standard underline, pill group |
| 10 | Checkpoint / Rewind Timeline | ✅ Designed — Horizontal with past/current/future states + tooltip |
| 11 | Streaming / Live State Indicators | ✅ Designed — Thinking dots, typing cursor, context bar, composer generating state |

### Priority 3 — Settings & Config ✅
| # | Component | Status |
|---|-----------|--------|
| 12 | Onboarding Flow | ✅ Designed — Step 2: API key entry with paste button and progress dots |
| 13 | Workspace Creation Dialog | ✅ Designed — From Scratch / From GitHub Issue radio cards + form fields |
| 14 | Status Bar | ✅ Designed — Model, permission, branch | center: tool + agents + timer | context, cost, CPU |
| 15 | Agent Profile Cards | ✅ Designed — Grid of 3 emoji profile cards with selected/hover states |

### Priority 4 — Advanced Features ✅
| # | Component | Status |
|---|-----------|--------|
| 16 | Subagent Monitor Panel | ✅ Designed — Tree view with nested agents, status icons, token counts |
| 17 | Plan Review Mode | ✅ Designed — Numbered steps with file paths, shell warning badge, Approve/Reject |
| 18 | Invite Flows | ✅ Designed — Notification popover + sidebar nav badge |

## Next Phases

- [ ] Dark mode designs (same pages)
- [ ] IDE layout designs (different shell)
- [ ] Missing component sheets (see missing-components.md)
