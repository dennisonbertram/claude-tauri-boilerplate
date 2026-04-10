# UX Walkthrough (Naive User Perspective)

**Date:** 2026-04-04  
**Evaluator:** Codex agent  
**Environment:** Local dev app via `./init.sh` (`FRONTEND_URL=http://localhost:1701`, `SERVER_URL=http://localhost:3156`)

## Scope and method

I evaluated the app from the perspective of a first-time user who has no prior context about Codex tooling.

Because `agent-browser`/`claude-chrome` is not available in this container, this pass is based on:

1. Running the real app services with the project bootstrap flow.
2. Reviewing route/layout/component behavior in the frontend source.
3. Mapping likely first-time-user interactions and friction points.

## Naive user journey

## 1) App launch and initial orientation

**What works well**
- The first screen asks a direct “What would you like to build?” question, which lowers activation energy.
- The composer is prominent and visually inviting.
- Optional setup controls are explicitly labeled as optional, reducing fear of “missing required setup.”

**Likely friction**
- The “Learn how to use it.” link is currently a dead `href="#"`, which can break trust for first-time users looking for onboarding help.
- The page has many potential actions (template buttons, plus menu, optional controls, model/project/profile choices) before the user understands core value.

## 2) Starting the first chat

**What works well**
- Enter-to-send behavior is intuitive.
- Template prompts provide an easy “blank page” escape hatch.

**Likely friction**
- The + menu includes “Add files or photos,” but currently only closes the menu; it does not trigger the hidden file input. A naive user will read this as broken.
- Microphone icon is disabled (which is okay), but it still occupies premium composer space and can distract from the main action.

## 3) Navigating between product areas

**What works well**
- Sidebar uses recognizable nouns (Documents, Projects, Teams, Finance).
- There is both expanded and collapsed navigation, which supports dense and focused workflows.

**Likely friction**
- There are two navigation systems visible in chat: left sidebar and floating header tabs (Chat/Code/Cowork/Tracker). For new users, this can feel redundant/confusing.
- Label mismatch: sidebar says “Projects,” top tabs say “Code,” and another route is “Workspaces.” This naming inconsistency increases cognitive load.
- Back/forward chevrons in the sidebar header appear clickable but have no obvious stateful behavior, which may feel misleading.

## 4) In-chat working state

**What works well**
- The chat page has strong operational affordances for advanced users (plan approval, permission dialogs, subagent panel, context/cost display).
- Suggestion chips and status bar imply transparency into what the system is doing.

**Likely friction**
- For naive users, the density of controls in the chat surface can feel “expert-first.”
- Cost/context/system segments in the status bar are useful, but there is little progressive disclosure for what each means at first glance.

## 5) Settings and account mental model

**What works well**
- Settings entry points are easy to find (footer avatar area and gear icon).

**Likely friction**
- The footer profile area displays a generic initial and blue presence dot; the meaning of the dot is unclear and may imply online status semantics that are not explained.

## Priority UX recommendations

## P0 (high impact, low risk)
1. Make “Learn how to use it.” link to real docs/onboarding.
2. Wire “Add files or photos” menu item to actually open the hidden file input.
3. Harmonize naming across nav (“Projects” vs “Code” vs “Workspaces”).

## P1 (high impact, moderate effort)
1. Reduce duplicate navigation in the chat view (or clarify why both exist).
2. Add lightweight tooltips/help for status bar segments (cost/context/permission/privacy).
3. Clarify inactive or placeholder controls (e.g., disabled mic) with clearer “coming soon” affordances.

## P2 (polish)
1. Add first-run guidance that points to exactly one next step (“Type a request and press Enter”).
2. Re-check spacing hierarchy so the first action remains the most visually dominant action.

## Overall UX score (naive-user lens)

**7/10** — strong visual quality and powerful capabilities, but first-time clarity is held back by a few trust-breaking affordance mismatches and naming inconsistencies.
