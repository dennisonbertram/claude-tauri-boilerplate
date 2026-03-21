# Swarm: Light Mode Redesign

**Started:** 2026-03-20
**Spec:** docs/implementation/light-mode-redesign-spec-2026-03-20.md
**Design source:** docs/design-sprint/ (8 HTML files)

---

## Wave 1 — Foundations (tokens + fonts)

**Teammates:** tokens-agent (Claude), fonts-agent (Claude)
**Files changed:**
- `apps/desktop/src/index.css` — :root warm parchment tokens, semantic status vars, grid pattern, scrollbar
- `apps/desktop/index.html` — removed `class="dark"`
- `apps/desktop/package.json` / `pnpm-lock.yaml` — Inter, Newsreader, JetBrains Mono installed; Geist removed

**Review:** APPROVED (0 CRITICAL, 0 HIGH)
**Commit:** f29686c — `feat(design): Wave 1 — warm parchment tokens, fonts, remove dark activation`

---

## Wave 2 — Navigation Restructure

**Teammates:** sidebar-agent (Claude), apptsx-agent (Claude)
**Files changed:**
- `apps/desktop/src/components/AppSidebar.tsx` — NEW: unified 260px sidebar with text nav, recents, workspace tree, user footer, collapsible to 56px icon strip
- `apps/desktop/src/App.tsx` — removed ActivityBar + conditional SessionSidebar/ProjectSidebar; added AppSidebar with all props

**Review:** First pass FAILED (1 CRITICAL: sidebar toggle not wired; 2 HIGH: dead Search nav, workspace highlight)
**Fixes:** sidebar toggle wired with sidebarOpen state, Search nav removed, workspace highlight confirmed
**Re-review:** APPROVED (0 CRITICAL, 0 HIGH)
**Commit:** e8eab5b — `feat(design): Wave 2 — unified AppSidebar, remove ActivityBar`

---

## Wave 3 — Lucide → Phosphor Icon Swap

**Teammates:** iconswap-agent (Claude) — Codex delegators didn't execute, replaced with single agent
**Files changed:** 30 component files across chat/, workspaces/, agent-builder/, teams/, settings/, auth/, sessions/
**Notable fixes by agent:**
- `FolderNotch` doesn't exist in Phosphor → used `FolderOpen`
- Doubled names from prior agent edits fixed (TerminalWindowWindow, UsersThreeThree, PencilSimpleSimple)
- Type name collisions (GithubBranch → preserved correctly)
- SearchMatch type not renamed to MagnifyingGlassMatch

**Review:** APPROVED (sampled 5 key files, 0 CRITICAL, 0 HIGH)
**Commit:** bc3423f — `feat(design): Wave 3 — Lucide → Phosphor icon swap (30 files)`

---

## Wave 4 — Component Updates (IN PROGRESS)

Planned: update shadcn/ui components visually + implement 18 new components from component library

## Wave 5 — New Pages (PLANNED)

Planned: Projects card grid redesign, Search page

---

## Status

- [x] Wave 1 — Tokens + fonts
- [x] Wave 2 — Navigation restructure
- [x] Wave 3 — Icon swap
- [ ] Wave 4 — Component updates
- [ ] Wave 5 — New pages
- [ ] Ralph Loop (3 passes)
