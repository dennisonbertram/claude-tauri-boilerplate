# Design System — Light Mode Extract

Extracted from the 7 light-mode design files. This is the source of truth for the light theme tokens and component inventory.

---

## 1. Design Tokens

### Colors

```js
// Tailwind config — app namespace
colors: {
  app: {
    sidebar:       '#f7f6f2',  // Left sidebar bg (warm off-white)
    main:          '#fcfbf8',  // Main content bg (lightest warm white)
    textPrimary:   '#1a1816',  // Near-black, warm undertone
    textSecondary: '#66635e',  // Mid gray, warm
    textTertiary:  '#99958f',  // Light gray, warm (labels, placeholders)
    border:        '#e8e6df',  // Dividers, card borders
    hover:         '#efeee9',  // Hover bg for list items
    inputBg:       '#ffffff',  // Input field backgrounds
    codeBg:        '#1e1e1e',  // Dark code block bg (chat view)
  }
}
// Additional named values used directly:
// Warm black for CTAs:  #2d2a26
// Code bg light:        #f9f8f4 (search page code snippets)
// Accent orange:        #f97316 / orange-50 / orange-100
// Online green:         green-500
// Pending/info blue:    blue-500
```

### Typography

```js
fontFamily: {
  sans:  ['Inter', 'sans-serif'],          // Body, UI, labels
  serif: ['Newsreader', 'serif'],          // Display headlines, page titles
  mono:  ['JetBrains Mono', 'monospace'], // Code, file names, kbd
}
// Font sizes:
// Display: font-serif text-4xl / text-5xl (settings, home)
// Section: text-lg / text-xl font-medium (page headers)
// Body:    text-[15px] / text-sm (chat messages, descriptions)
// Label:   text-xs font-semibold uppercase tracking-wider
// Meta:    text-[11px] (timestamps, tags, counts)
// Base:    text-[14px] on body
```

### Shadows

```js
boxShadow: {
  soft:       '0 8px 30px -6px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.02)',
  'inner-soft': 'inset 0 2px 4px 0 rgba(0,0,0,0.02)',
  modal:      '0 20px 50px -12px rgba(0,0,0,0.15)',
}
// Also used: shadow-sm (native Tailwind), shadow-lg (code blocks)
```

### Border Radius Scale

| Token | Value | Used On |
|-------|-------|---------|
| rounded-md | 6px | Small buttons, nav items |
| rounded-lg | 8px | Inputs, filter chips, settings rows |
| rounded-xl | 12px | Selects, toggles, medium cards |
| rounded-2xl | 16px | Main cards, panels, code blocks |
| rounded-3xl | 24px | Large icon containers (agent avatar) |
| rounded-[28px] | 28px | Large composer card |
| rounded-full | 9999px | Pills, avatars, send button |

### Background Pattern

```css
/* Subtle grid — used on all main content areas */
.bg-grid-pattern {
  background-size: 32px 32px;
  background-image:
    linear-gradient(to right, rgba(26,24,22,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(26,24,22,0.03) 1px, transparent 1px);
}
/* Applied with opacity-40 or opacity-60 on main areas */
```

### Scrollbar

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d4d2cc; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #b5b3ad; }
```

---

## 2. Layout System

### App Shell

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (260px fixed)  │  Main Area (flex-1)        │
│  ┌─────────────────┐    │  ┌─────────────────────┐  │
│  │ Sidebar Header  │    │  │ Page Header (h-14)  │  │
│  │ (h-14, nav btns)│    │  │─────────────────────│  │
│  │─────────────────│    │  │                     │  │
│  │ Nav Links       │    │  │  Content Area       │  │
│  │ Recents Section │    │  │  (overflow-y-auto)  │  │
│  │ (overflow-y-auto│    │  │                     │  │
│  │─────────────────│    │  └─────────────────────┘  │
│  │ User Badge      │    │                            │
│  └─────────────────┘    │                            │
└─────────────────────────────────────────────────────┘
```

### Content Width Constraints

| Context | Max Width |
|---------|-----------|
| Home composer + suggestions | max-w-3xl (768px) |
| Active chat messages | 50% of split view |
| Agent profile editor | max-w-4xl (896px) |
| Settings content | max-w-4xl (896px) |
| Search results | max-w-4xl (896px) |
| Teams content | max-w-6xl (1152px) |

### Split View Layout (Active Session)

- Left 50%: Chat thread (scrollable, px-8 py-10)
- Right 50%: Browser preview panel (white bg, browser chrome + scaled preview)
- Resizable (implied, not yet designed)

---

## 3. Component Inventory

### 3.1 Layout Components

**AppSidebar**
- Fixed 260px width, bg-app-sidebar, border-r
- Contains: SidebarHeader, SidebarNav, SidebarRecents, SidebarFooter

**SidebarHeader**
- h-14, icons: collapse sidebar, back/forward navigation
- Back/forward dims when disabled (opacity-50)

**SidebarNav**
- Vertical list of NavItem links (icon + label)
- Active state: bg-white shadow-sm border font-medium
- Hover state: bg-app-hover

**SidebarSection**
- Label: text-xs uppercase tracking-wider text-app-textTertiary
- Optional hover-reveal action button (+ icon, opacity-0 group-hover:opacity-100)

**SidebarRecents**
- Date group headers: text-[11px] font-medium text-app-textTertiary
- Session items: truncated text links with hover

**SidebarFooter**
- Border-top, user avatar + name + plan + settings icon
- p-3 padding

**PageHeader**
- h-14, flex items-center justify-between, px-6 or px-8
- bg-app-main/80 backdrop-blur-md, border-b border-app-border
- Left: title (+ breadcrumb or badge), Right: actions

**FloatingNavPill**
- Absolute top-0 centered in main area
- bg-app-sidebar/80 backdrop-blur-md border rounded-full p-1
- Children: pill toggle buttons (active = bg-white shadow-sm border)

---

### 3.2 Composer Components

**HomeComposer** (large)
- bg-white rounded-[28px] shadow-soft border
- Contenteditable textarea (min-h-[120px], text-lg)
- Toolbar: ProjectSelector | Divider | AttachButton || ModelSelector | MicButton | SendButton
- Focus: enhanced shadow + border tightening

**SessionComposer** (compact)
- Full-width pill (rounded-full)
- Left: AttachButton (+)
- Center: text input (text-[15px])
- Right: Send button (rounded-full bg-textPrimary text-white)

**ProjectSelector** (in composer)
- Button: folder icon + project name + caret
- Hover: bg-app-hover + border

**ModelSelector** (in composer)
- Button: model name + caret
- No icon

**SendButton**
- Sizes: 8x8 (home, rounded-lg bg-black) / pill (session, px-5 py-2 rounded-full)
- Icon: ph-arrow-up-right (home) / ph-paper-plane-right (session)

---

### 3.3 Card Components

**ProjectCard**
- bg-white border rounded-2xl p-5 shadow-soft on hover
- IconBadge (colored bg + icon, 10x10 rounded-xl)
- Title + timestamp
- TechTags (flex-wrap, small rounded-md bg-app-sidebar)
- ProgressBar (label + % + thin bar)
- 3-dot menu: opacity-0 group-hover:opacity-100

**NewProjectCard**
- border-2 border-dashed rounded-2xl
- Centered: CircleIcon + title + subtitle
- Hover: border-app-textTertiary + bg-app-sidebar/50 + icon scale-110

**TemplateRow** (suggestion)
- Full-width button, hover bg-white border shadow
- Left: icon in white rounded-xl border (shadow-inner-soft)
- Content: title (font-medium text-[15px]) + subtitle (text-sm)
- Divider between rows: h-px w-[calc(100%-4rem)] ml-16

**CommunityCard**
- bg-white border rounded-2xl p-4 shadow-sm
- Icon (bordered, no color) + heading + description

**InfoBanner** (alert/tip)
- bg-orange-50/50 border-orange-100 rounded-2xl p-5
- Icon + heading + body text + optional link

**FileResultCard** (search)
- bg-white border rounded-2xl overflow-hidden
- Header: file icon + name + modified date, border-b
- Body: bg-app-codeBg monospace text with line numbers and highlighted match rows

---

### 3.4 Form Components

**TextInput**
- bg-white border border-app-border rounded-lg px-3 py-1.5
- Focus: outline-none border-app-textTertiary (or ring-1)
- Filter variant: with leading icon (pl-9)

**LargeTextInput** (transparent)
- bg-transparent border-none focus:ring-0
- Used for profile name (text-3xl font-serif) and description

**Textarea**
- bg-white border rounded-2xl, focus-within:border-[#d4d2cc]
- Inner: p-5 h-64 bg-transparent border-none resize-none font-mono
- Footer: px-5 py-3 border-t bg-app-sidebar/30 rounded-b-2xl (hint + action)

**Select**
- bg-white border rounded-xl px-4 py-2.5 appearance-none
- Focus: ring-1 ring-app-border

**Toggle/Switch**
- sr-only checkbox + peer-based CSS div
- Track: w-9 h-5 bg-app-border peer-checked:bg-black rounded-full
- Thumb: absolute white circle, translates on checked

**RangeSlider**
- h-1 bg-app-border rounded-lg appearance-none
- Custom thumb: 16x16 bg-textPrimary rounded-full border-2 border-white shadow

**TagPill** (removable)
- Colored variant: bg-orange-50 border-orange-100 text-orange-700
- Neutral: bg-app-sidebar border-app-border text-app-textSecondary
- Contains: label + X icon button

---

### 3.5 Data Display

**ProgressBar**
- Container: h-1 bg-app-border/40 rounded-full overflow-hidden
- Fill: bg-app-textPrimary (default) or bg-green-600 (success) or bg-orange-400 (warning)
- Label row above: text-[11px] font-medium space-between

**UsageCard**
- bg-white border rounded-2xl p-6 shadow-sm
- Label + value (right) + ProgressBar + description text

**MembersTable**
- bg-white border rounded-2xl overflow-hidden shadow-soft
- Header: bg-app-sidebar/50 border-b, th text-[11px] uppercase
- Row: border-b border-app-border/60 hover:bg-app-sidebar/30
- Cells: Avatar+name+email | Role badge | Status dot | 3-dot actions

**ActivityFeedItem**
- Icon circle (colored bg) + description + timestamp
- Vertical line connector between items (absolute border-l)

**KbdKey**
- px-2 py-1 bg-app-sidebar border rounded-md text-[11px] font-mono shadow-inner-soft
- min-w-[32px] text-center

**KeyboardShortcutRow**
- bg-white border rounded-xl p-4 shadow-sm hover:border-[#d4d2cc]
- flex justify-between: label + KbdKey group

---

### 3.6 Status & Feedback

**StatusBadge** (text pill)
- Live: bg-orange-50 text-orange-600 border-orange-100 text-[10px] font-bold uppercase
- Role Owner: bg-orange-50 text-orange-700 border-orange-100 rounded-full
- Role Editor/Viewer: bg-app-sidebar text-app-textSecondary border-app-border rounded-full
- Count: bg-app-border/40 text-app-textSecondary rounded-full text-xs

**OnlineDot**
- w-1.5 h-1.5 rounded-full
- Online: bg-green-500 | Away/Offline: bg-app-border

**UserAvatar**
- Sizes: w-8 h-8 (sidebar), w-20 h-20 (settings profile)
- bg-[#2d2a26] text-[#e8e6df] rounded-full font-medium
- Optional status dot: w-2.5 h-2.5 bg-blue-500 border-2 border-app-sidebar (absolute bottom-right)

**IconBadge** (card icons)
- w-10 h-10 rounded-xl
- Color variants: orange-50/orange-100/orange-600, blue, purple, emerald, amber
- Contains: phosphor icon text-xl

**AIAvatar** (sparkle logo)
- w-8 h-8 or w-12 h-12 rounded-lg or rounded-2xl
- bg-orange-50 border-orange-100 text-orange-600
- Icon: ph-fill ph-sparkle

**CodeBlock**
- bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg border border-white/10
- Header: bg-[#2d2d2d] border-b border-white/5, file icon + monospace name + copy button
- Body: p-5 font-mono text-[13px] leading-6 overflow-x-auto whitespace-pre
- Syntax tokens: keyword(#c678dd), string(#98c379), function(#61afef), tag(#e06c75), attr(#d19a66), comment(#5c6370 italic)
- Blinking cursor: inline-block w-[2px] h-[1.2em] bg-orange-500 animate-blink

**BrowserPreview**
- Chrome bar: h-8 border-b bg-app-sidebar/30, traffic lights + URL bar + refresh
- Content: scaled app preview (scale-[0.9] origin-top) inside rounded border
- Hot reload badge: fixed bottom-right, bg-black/80 backdrop-blur rounded-full + green pulse dot

**InlineMono**
- `code` tag: bg-app-hover px-1 rounded font-mono text-[13px]

**FilterChip** (search filters)
- px-3 py-1.5 rounded-full bg-white border shadow-sm text-xs font-medium
- Contains: label + optional caret

---

### 3.7 Navigation

**NavItem** (sidebar link)
- flex items-center gap-3 px-3 py-2 rounded-lg
- Icon (text-lg) + label text
- States: default (text-app-textSecondary hover:bg-app-hover), active (bg-white shadow-sm border border-black/5 font-medium text-app-textPrimary)

**PillTabSwitcher** (floating header)
- bg-app-sidebar/80 backdrop-blur-md border rounded-full p-1 shadow-sm
- Children: px-4 py-1.5 rounded-full text-sm font-medium
- Active: bg-white shadow-sm border border-black/5

**FilterBar** (projects toolbar)
- flex between: [search input + filter dropdowns] | [view toggle + sort]
- View toggle: bg-app-border/30 p-1 rounded-lg, active icon: bg-white shadow-sm

---

## 4. Iconography

All icons are from **Phosphor Icons** (`@phosphor-icons/web`).

Key icons used:
- Navigation: ph-sidebar-simple, ph-arrow-left/right, ph-magnifying-glass
- Actions: ph-plus, ph-plus-circle, ph-gear, ph-gear-fill, ph-dots-three-vertical, ph-dots-three-outline-vertical
- Content types: ph-folder-notch, ph-folder-open, ph-file-ts, ph-browser, ph-database, ph-cube, ph-robot
- People: ph-user, ph-user-circle-gear, ph-users-three, ph-user-focus
- AI: ph-fill ph-sparkle (filled variant for AI avatar)
- Status: ph-check-circle, ph-shield-check, ph-info, ph-envelope-simple
- UI: ph-caret-down, ph-x, ph-arrow-right, ph-paper-plane-right, ph-arrow-up-right
- Media: ph-microphone, ph-copy, ph-share-network, ph-arrow-clockwise
- Tools: ph-layout, ph-plugs, ph-magic-wand, ph-lightning, ph-gift, ph-lock

Icon sizing: `text-lg` (18px) for sidebar/UI icons, `text-xl` (20px) for card icons, `text-2xl` for large display icons.

---

## 5. Motion & Interaction

- Standard transitions: `transition-colors` (color changes), `transition-all` (layout + color)
- Hover reveals: `opacity-0 group-hover:opacity-100 transition-opacity`
- Scale on hover: `hover:scale-110 transition-transform` (new project card icon)
- Pulse: `animate-pulse` (status dots, hot-reload badge)
- Blink: `animate-[blink_1s_step-end_infinite]` (code cursor)
- Backdrop blur: `backdrop-blur-md` (headers, floating pills)

---

## 6. Component Status Summary

As of 2026-03-20, the light mode design is **complete** — all pages and all missing components have been designed.

### Files
| File | Contents |
|------|----------|
| `light-mode/01-home.html` | Welcome / Empty state composer |
| `light-mode/02-active-session.html` | Active chat — split view |
| `light-mode/03-projects.html` | Projects grid |
| `light-mode/04-agent-profiles.html` | Agent profile editor |
| `light-mode/05-settings.html` | Settings page |
| `light-mode/06-teams.html` | Teams & members |
| `light-mode/07-search.html` | Code search |
| `light-mode/08-component-library.html` | All 18 missing components |

### Token Refinements (from component library)

The component library introduced some refined token values vs. the initial pages:

```js
// Refined color tokens (from 08-component-library.html)
app: {
  bg:            '#fcfbf8',   // Same as main
  text:          '#1a1816',   // Same as textPrimary
  textSecondary: '#6b6863',   // Slightly adjusted (was #66635e)
  textTertiary:  '#a3a09a',   // Slightly adjusted (was #99958f)
  surface:       '#ffffff',   // Explicit white surface (was inputBg)
  hover:         '#f4f2ec',   // Slightly adjusted (was #efeee9)
  codeBg:        '#f5f4f1',   // Light code bg (was #f9f8f4)
  accent:        '#ed702d',   // Orange accent
  success:       '#22a04c',   // Green
  successBg:     '#eefcf1',   // Light green bg
  error:         '#e04f4f',   // Red
  errorBg:       '#fceeee',   // Light red bg
  warning:       '#d97706',   // Amber
  warningBg:     '#fffbeb',   // Light amber bg
}
// Shadows refined:
// soft:  '0 2px 8px -2px rgba(26,24,22,0.05), 0 4px 16px -4px rgba(26,24,22,0.02)'
// modal: '0 8px 32px -8px rgba(26,24,22,0.1), 0 16px 48px -12px rgba(26,24,22,0.05)'
```

### New Components Documented

**From the component library, these component patterns were finalized:**

**Semantic State Colors:**
- Success states: `bg-app-successBg border-app-success/20 text-app-success`
- Error states: `bg-app-errorBg border-app-error/20 text-app-error`
- Warning states: `bg-app-warningBg border-app-warning/20 text-app-warning`
- Info states: neutral border + icon

**Tool Call Card states** (6): reading (spinner), running (blue pulse badge), writing (progress bar), complete (check + fade), permission-required (amber warning), error (red X)

**Status Bar layout** (28px height):
- Left: model | divider | permission mode | divider | git branch
- Center: active tool pill | agent count | turn timer
- Right: context % + mini bar | divider | cost | divider | CPU%

**Diff View structure:**
- Left panel: file list with +/- counts, file type icons
- Right panel: header with filename + Modified badge + Unified/Split toggle
- Table: old line# | new line# | content (removed=errorBg, added=successBg, context=codeBg)

**Checkpoint Timeline:**
- Past checkpoints: filled dark circles on dark line
- Current: white circle with thick dark border + ring accent glow
- Future: outlined circle on gray line, dimmed
- Hover tooltip: dark pill above checkpoint with title + turn number

**Plan Review steps:**
- Normal: white circle number + description + file path chip
- Shell/risky: amber circle + warning badge + command chip

**Subagent tree:**
- Root agent: full width row
- Children: ml-6 with L-shaped border connector (absolute positioned)
- Grandchildren: ml-12

**Agent Profile Cards:**
- Selected: border-2 border-app-text + checkmark badge top-right
- Unselected: border border-app-border, hover: border-app-textSecondary + shadow-md
