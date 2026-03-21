# Light Mode Redesign Spec

**Date:** 2026-03-20
**Design source:** `docs/design-sprint/` (8 files)
**Token source:** `docs/design-sprint/design-system.md`
**Component source:** `docs/design-sprint/light-mode/08-component-library.html`

---

## Objective

Migrate the Claude Code desktop app from its current neutral dark/light theme to the warm parchment light-mode design system extracted from the design sprint. Dark mode token block is preserved but never activated.

---

## Current State

| Dimension | Current |
|-----------|---------|
| Theme | Dark (`.dark` on `<html>`) |
| Colors | Neutral OKLCh in `index.css` `:root` + `.dark` |
| Fonts | Geist Variable (single font) |
| Icons | Lucide React v0.577.0 |
| Layout | ActivityBar (56px icon strip) + context sidebar + main |
| Components | shadcn/ui: Button, Card, Input, Avatar, ScrollArea, Separator |

---

## Target State

| Dimension | Target |
|-----------|--------|
| Theme | Light always (`class="dark"` removed from `index.html`) |
| Colors | Warm parchment (see token table below) |
| Fonts | Inter (body) + Newsreader (display) + JetBrains Mono (code) |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Layout | Single 260px sidebar with text nav links + main |
| Components | shadcn/ui updated visually + 18 new components |

---

## Token Mapping

### CSS Variable Updates (`:root` block in `index.css`)

Map current shadcn tokens to warm parchment values:

```css
:root {
  /* Backgrounds */
  --background:          oklch(0.991 0.003 80);    /* #fcfbf8 — main bg */
  --card:                oklch(1 0 0);              /* #ffffff — card/surface */
  --popover:             oklch(1 0 0);              /* #ffffff */

  /* Foregrounds */
  --foreground:          oklch(0.165 0.008 50);     /* #1a1816 — textPrimary */
  --card-foreground:     oklch(0.165 0.008 50);
  --popover-foreground:  oklch(0.165 0.008 50);

  /* Brand */
  --primary:             oklch(0.165 0.008 50);     /* #1a1816 — CTAs */
  --primary-foreground:  oklch(0.991 0.003 80);     /* #fcfbf8 */

  /* Secondary / muted */
  --secondary:           oklch(0.965 0.006 75);     /* #efeee9 — hover */
  --secondary-foreground:oklch(0.165 0.008 50);
  --muted:               oklch(0.965 0.006 75);     /* #efeee9 */
  --muted-foreground:    oklch(0.46 0.01 55);       /* #66635e — textSecondary */

  /* Accent */
  --accent:              oklch(0.965 0.006 75);     /* #efeee9 */
  --accent-foreground:   oklch(0.165 0.008 50);

  /* Destructive */
  --destructive:         oklch(0.58 0.19 27);       /* #e04f4f */

  /* Border / Input */
  --border:              oklch(0.925 0.009 75);     /* #e8e6df */
  --input:               oklch(0.925 0.009 75);
  --ring:                oklch(0.925 0.009 75);

  /* Border radius — keep scale, increase base slightly */
  --radius: 0.5rem;

  /* Sidebar */
  --sidebar:             oklch(0.972 0.005 78);     /* #f7f6f2 */
  --sidebar-foreground:  oklch(0.165 0.008 50);
  --sidebar-primary:     oklch(0.165 0.008 50);
  --sidebar-primary-foreground: oklch(0.991 0.003 80);
  --sidebar-accent:      oklch(0.965 0.006 75);     /* #efeee9 */
  --sidebar-accent-foreground: oklch(0.165 0.008 50);
  --sidebar-border:      oklch(0.925 0.009 75);     /* #e8e6df */
  --sidebar-ring:        oklch(0.925 0.009 75);
}
```

### Additional CSS Variables to Add

```css
:root {
  /* Design sprint extras */
  --app-cta:             #2d2a26;   /* warm black for primary buttons */
  --app-code-bg:         #1e1e1e;   /* dark code blocks */
  --app-code-bg-light:   #f5f4f1;   /* inline code bg */
  --app-accent-orange:   #ed702d;   /* AI sparkle accent */

  /* Semantic status */
  --app-success:         #22a04c;
  --app-success-bg:      #eefcf1;
  --app-error:           #e04f4f;
  --app-error-bg:        #fceeee;
  --app-warning:         #d97706;
  --app-warning-bg:      #fffbeb;

  /* Shadows */
  --shadow-soft:  0 2px 8px -2px rgba(26,24,22,0.05), 0 4px 16px -4px rgba(26,24,22,0.02);
  --shadow-modal: 0 8px 32px -8px rgba(26,24,22,0.1), 0 16px 48px -12px rgba(26,24,22,0.05);
  --shadow-inner: inset 0 2px 4px 0 rgba(26,24,22,0.02);
}
```

### `.dark` block — Keep unchanged, never activated

Remove `class="dark"` from `apps/desktop/index.html`. The `.dark` CSS block in `index.css` stays exactly as-is (preserved for future use), but it will never apply because no element ever has the class.

---

## Font Setup

### Install packages
```bash
cd apps/desktop
npm install @fontsource-variable/inter @fontsource/newsreader @fontsource-variable/jetbrains-mono
```

### Update `index.css` imports
```css
@import "@fontsource-variable/inter";
@import "@fontsource/newsreader/400.css";
@import "@fontsource/newsreader/500.css";
@import "@fontsource/newsreader/400-italic.css";
@import "@fontsource-variable/jetbrains-mono";
/* Remove: @import "@fontsource-variable/geist"; */
```

### Update `@theme` block
```css
@theme inline {
  --font-sans: 'Inter Variable', sans-serif;
  --font-serif: 'Newsreader', serif;
  --font-mono: 'JetBrains Mono Variable', monospace;
  /* ... rest unchanged */
}
```

---

## Navigation Restructure

### Current (remove)
- `ActivityBar.tsx` — 56px icon-only strip on far left
- Dynamic context sidebars: `SessionSidebar`, `ProjectSidebar`

### Target (create)
- Single `AppSidebar.tsx` — 260px wide, contains:
  - **Header** (h-14): collapse button + back/forward navigation buttons
  - **Nav links** (top): New Chat, Search, Projects, Agent Profiles, Teams — each with Phosphor icon + text label
  - **Recents section**: section header "RECENTS" + date-grouped session list
  - **Footer** (pinned bottom): user avatar (initials) + name + plan label + settings gear icon
- `ActivityBar.tsx` is **deleted**

### App.tsx layout change
```tsx
// Before:
<ActivityBar ... />
{activeView === 'chat' && sidebarOpen && <SessionSidebar ... />}
{activeView === 'workspaces' && <ProjectSidebar ... />}

// After:
<AppSidebar
  activeView={activeView}
  onSelectView={handleSwitchView}
  sessions={sessions}
  onSelectSession={...}
  projects={projects}
  workspaces={workspacesByProject}
  selectedWorkspaceId={...}
  onSelectWorkspace={...}
  email={email}
  plan={plan}
  onOpenSettings={handleOpenSettings}
  onNewChat={handleNewChat}
/>
```

### Nav item active states
- Active: `bg-white shadow-sm border border-black/5 font-medium text-foreground`
- Default: `text-muted-foreground hover:bg-sidebar-accent/50`

---

## Icon Mapping (Lucide → Phosphor)

Install: `npm install @phosphor-icons/react`

| Lucide | Phosphor | Usage |
|--------|----------|-------|
| `MessageSquare` | `ChatCircle` | Chat nav |
| `FolderOpen` | `FolderNotch` | Projects nav |
| `Users` | `UsersThree` | Teams nav |
| `Bot` | `UserCircleGear` | Agents nav |
| `Settings` | `Gear` | Settings |
| `User` | `User` | User avatar fallback |
| `Plus` | `Plus` | New / add actions |
| `Search` | `MagnifyingGlass` | Search |
| `GitBranch` | `GitBranch` | Branch display |
| `Copy` | `Copy` | Copy branch |
| `Check` | `Check` | Checkmarks |
| `X` | `X` | Close / dismiss |
| `ChevronDown` | `CaretDown` | Dropdowns |
| `ChevronRight` | `CaretRight` | Expand |
| `ArrowUp` | `ArrowUp` | Submit |
| `Trash2` | `Trash` | Delete |
| `Pencil` | `PencilSimple` | Edit/rename |
| `Clipboard` | `Clipboard` | Copy action |
| `Loader2` | `SpinnerGap` | Loading spinner |
| `AlertCircle` | `WarningCircle` | Error states |
| `Info` | `Info` | Info states |
| `CheckCircle` | `CheckCircle` | Success states |
| `XCircle` | `XCircle` | Error states |
| `Terminal` | `TerminalWindow` | Bash/shell |
| `FileText` | `FileText` | File reading |
| `Merge` | `GitMerge` | Merge workspace |
| `ExternalLink` | `ArrowSquareOut` | Open external |

---

## New Utility CSS Classes

Add to `index.css`:

```css
/* Subtle grid pattern for main areas */
.bg-grid-pattern {
  background-size: 32px 32px;
  background-image:
    linear-gradient(to right, rgba(26,24,22,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(26,24,22,0.03) 1px, transparent 1px);
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d4d2cc; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #b5b3ad; }
```

---

## Wave Plan

### Wave 1 — Foundations (parallel, ~1h)
| Task | Files | Agent |
|------|-------|-------|
| 1A: CSS tokens + dark class removal | `index.css`, `index.html` | Claude |
| 1B: Font installation + @theme update | `index.css`, `package.json` | Codex |
| 1C: Utility CSS (grid pattern, scrollbar) | `index.css` | Codex |

**Repomix scope:** `apps/desktop/src/index.css,apps/desktop/index.html`

### Wave 2 — Navigation (sequential, ~3h)
| Task | Files | Agent |
|------|-------|-------|
| 2A: Create AppSidebar.tsx | `src/components/AppSidebar.tsx` (new) | Claude |
| 2B: Update App.tsx layout | `src/App.tsx` | Claude |
| 2C: Delete ActivityBar.tsx | `src/components/ActivityBar.tsx` | Codex |

**Repomix scope:** `apps/desktop/src/components/AppSidebar.tsx,apps/desktop/src/App.tsx`

### Wave 3 — Icons (parallel, ~2h)
| Task | Files | Agent |
|------|-------|-------|
| 3A: Install Phosphor + swap chat components | Chat dir | Codex |
| 3B: Swap workspace components | Workspace dir | Codex |
| 3C: Swap remaining (agents, teams, settings, status) | Various | Codex |

**Repomix scope:** `apps/desktop/src/components/**`

### Wave 4 — Components (parallel, ~4h)
| Task | Files | Agent |
|------|-------|-------|
| 4A: Update existing shadcn components | `src/components/ui/` | Claude |
| 4B: P1 components (Modal, Dropdown, Toast, EmptyState, Skeleton) | `src/components/ui/` | Claude |
| 4C: P2 components (ToolCallCard, PermissionDialog, DiffView, TabStrip, etc.) | `src/components/` | Claude |
| 4D: P3/P4 components (StatusBar redesign, AgentCards, SubagentMonitor, PlanReview) | `src/components/` | Claude |

### Wave 5 — Pages (parallel, ~2h)
| Task | Files | Agent |
|------|-------|-------|
| 5A: Projects page redesign (card grid) | `WorkspaceDashboardsView` / new Projects view | Claude |
| 5B: Search page (new) | `src/components/search/` | Claude |

---

## Repomix Include Pattern

```
apps/desktop/src/index.css,apps/desktop/index.html,apps/desktop/src/App.tsx,apps/desktop/src/components/AppSidebar.tsx,apps/desktop/src/components/ui/**,apps/desktop/src/components/chat/**,apps/desktop/src/components/workspaces/**
```
