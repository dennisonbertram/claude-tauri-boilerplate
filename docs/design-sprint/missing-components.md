# Missing Components — Light Mode

Components needed but not yet designed. Each section includes a prompt you can use with an AI design tool to get the component sheet created.

---

## Priority 1 — Core UI (Blocking)

### 1. Modal / Dialog

Used for: confirm delete, create project, create workspace, invite member, export session.

**Prompt:**
> Design a modal dialog sheet for a light-mode desktop app. Warm off-white palette (#fcfbf8 bg, #e8e6df borders, #1a1816 text). Show 4 variants on one sheet: (1) Confirmation dialog — icon + title + description + Cancel/Confirm buttons, (2) Create form dialog — title + input fields + action row, (3) Destructive confirmation — red-tinted warning, (4) Information/success dialog. Backdrop is dark overlay. Modal itself is bg-white rounded-2xl shadow-modal border border-app-border. Use Inter font, Phosphor icons.

---

### 2. Dropdown / Context Menu

Used for: 3-dot project actions (rename, delete, duplicate), session actions, member actions, model picker.

**Prompt:**
> Design a context menu / dropdown sheet for a light-mode desktop app. Warm palette. Show 3 variants: (1) 3-dot action menu (rename, duplicate, delete with red destructive item), (2) Select dropdown (list of options with selected checkmark), (3) Model picker dropdown (model name + description + tier badge per row). All use bg-white border rounded-xl shadow-soft. Separator lines between groups. Hover states. Use Inter + Phosphor icons.

---

### 3. Toast / Notification

Used for: copy success, save confirmation, error alerts, task complete.

**Prompt:**
> Design a toast notification system sheet for a light-mode desktop app. Warm palette. Show 5 variants stacked: (1) Success — green icon + message + auto-dismiss progress bar, (2) Error — red icon + message + retry action, (3) Info — neutral + message, (4) Task complete — sparkle icon + "Task completed in workspace X" + View button, (5) Warning — amber. Bottom-right anchored. bg-white border rounded-2xl shadow-soft. Compact, max 320px wide. Inter + Phosphor icons.

---

### 4. Empty States

Used for: no projects, no search results, no sessions, no team members, first-time use.

**Prompt:**
> Design an empty state illustration sheet for a light-mode desktop app. Warm palette. Show 5 empty states: (1) No projects yet — folder icon + headline + "Add your first project" CTA button, (2) No search results — magnifying glass + "No results for X" + clear search link, (3) No sessions today — clock/chat bubble icon + "Start a new conversation", (4) No team members — people icon + invite CTA, (5) First-time welcome — sparkle logo + warm serif headline + primary CTA. Centered layout in main content area. Muted icons (text-app-textTertiary). Inter + Newsreader for headlines.

---

### 5. Loading / Skeleton States

Used for: session loading, project list loading, search loading, streaming.

**Prompt:**
> Design a skeleton loading state sheet for a light-mode desktop app. Warm palette. Show 4 skeleton variants: (1) Project card skeleton — animated gray rectangles in card layout, (2) Session list skeleton — repeated text-line placeholders in sidebar, (3) Chat message skeleton — avatar circle + 3 lines of varying width, (4) Code block skeleton — dark bg with gray line placeholders. Use animate-pulse on all. Also show a fullscreen loading state (centered spinner + "Loading..." text). bg-app-border/30 for skeleton fills.

---

## Priority 2 — Chat & Workspace

### 6. Tool Call Card

Used during streaming: shows what tool the AI is executing (bash command, file read/write, web search).

**Prompt:**
> Design a tool call card component sheet for a light-mode chat interface. Show 6 tool call states as inline cards within a chat message: (1) Running — file icon + "Reading package.json" + spinner + elapsed time, (2) Bash command — terminal icon + command text + "Running..." badge, (3) File write — write icon + filename + progress bar, (4) Complete — checkmark + tool name + file path + "2.3s", (5) Permission required — warning icon + "Requests shell access" + Approve/Deny buttons, (6) Error/failed — red X + tool name + error message. Cards are compact, bg-app-hover border rounded-xl. Monospace for command/path text.

---

### 7. Permission Dialog (Inline)

Used when AI wants to execute risky actions (file delete, shell, network).

**Prompt:**
> Design an inline permission request component for a chat interface. Light mode, warm palette. The AI pauses and shows a card with: risk level badge (Safe/Moderate/Risky in green/amber/red), tool icon, action description ("Claude wants to run: rm -rf ./dist"), code block showing the exact command, two buttons (Allow / Deny), optional "Always allow" checkbox. Card is bg-white border rounded-2xl shadow-soft. Should feel like a native system dialog embedded in chat.

---

### 8. Diff View

Used in workspace "Diff" tab showing git changes.

**Prompt:**
> Design a code diff view component sheet for a light-mode desktop app. Show: (1) File tree sidebar — list of changed files with +/- counts and color coding (green adds, red removes), (2) Unified diff view — filename header, line numbers, removed lines (light red bg), added lines (light green bg), unchanged context lines (bg-app-codeBg), (3) Side-by-side diff — two columns with shared line numbers. Use JetBrains Mono for code. Warm light palette for chrome, slightly tinted red/green for diff lines (not harsh). File status badges: Modified (amber), Added (green), Deleted (red).

---

### 9. Tab Strip

Used in workspace panel (Chat / Diff / Paths / Notes / Dashboards).

**Prompt:**
> Design a tab strip component sheet for a light-mode desktop app. Show 3 variants: (1) Standard horizontal tabs — underline active indicator, hover states, badge/count on tabs, (2) Compact tabs for a panel header — shorter height, (3) Pill-style tab group (alternative to underline). All on bg-app-main background. Active tab: border-b-2 border-textPrimary text-textPrimary. Inactive: text-app-textSecondary hover:text-textPrimary. Also show overflow state with scroll arrows when too many tabs.

---

### 10. Checkpoint / Rewind Timeline

Used to show conversation history and allow rewinding to a past state.

**Prompt:**
> Design a checkpoint timeline component for a chat interface. Light mode. A horizontal or vertical strip showing conversation checkpoints: each checkpoint is a small circle/dot on a line, labeled with turn number and a short action description ("Wrote middleware.ts", "Ran tests", "Fixed bug"). Active checkpoint is filled. Past checkpoints are outlined. Hovering shows a tooltip with details and a "Rewind to here" button. Show both horizontal (for footer/status area) and vertical (for sidebar panel) orientations.

---

### 11. Streaming / Live State Indicators

Used while AI is generating a response.

**Prompt:**
> Design a streaming state component sheet for a light-mode AI chat interface. Show: (1) Thinking indicator — pulsing dots or wave animation, (2) Typing cursor — blinking orange vertical bar, (3) Stream progress in composer — disabled state with cancel button, (4) Tool execution pulse — animated border on tool card, (5) Context window usage bar — thin horizontal bar turning yellow/red as it fills. All should feel calm, not alarming. Orange accent for AI-related states.

---

## Priority 3 — Settings & Configuration

### 12. Onboarding Flow

First-time setup: API key entry, model selection, first project.

**Prompt:**
> Design a 3-step onboarding flow for a light-mode desktop AI coding app. Warm palette. Step 1: Welcome screen with large serif headline + sparkle logo + "Get started" CTA. Step 2: API key setup — input field + paste button + validation state + "Where do I find this?" help link. Step 3: First project — import from GitHub (input + button) or create blank (option card). Progress dots at top. Clean, centered layout max-w-lg. Each step has a back/next nav.

---

### 13. Workspace Creation Dialog

Multi-step form for creating a new git worktree workspace.

**Prompt:**
> Design a workspace creation dialog for a light-mode developer tool. 3 paths shown as option cards: (1) From scratch — branch name input + base branch selector, (2) From GitHub issue — search field with issue list results, (3) From Linear issue — OAuth connect button → issue browser. Modal is bg-white rounded-2xl shadow-modal. Path selector is card-based (icon + title + description, hover border). After path selection, show form fields below. Action row: Cancel + Create Workspace button.

---

### 14. Status Bar

Bottom app bar showing model, streaming status, context usage, cost.

**Prompt:**
> Design a status bar component sheet for a light-mode desktop app. Slim horizontal bar (28px height) at bottom of window. Show segments from left to right: (1) Model name — clickable text with small dropdown caret (opens model picker), (2) Permission mode — shield icon + "Normal/Plan/Full" text, (3) Git branch — branch icon + branch name, (4) Separator, (5) Center: active tool name when streaming, agent count badge, turn timer, (6) Right: context usage "24%" with thin bar, session cost "$0.12", CPU/memory (when enabled). Multiple states: idle, streaming (with animated indicator), high context (amber), near limit (red). Warm light palette, text-[11px] throughout.

---

### 15. Agent Profile Cards (Picker)

Used on welcome screen and in chat to select which agent profile to use.

**Prompt:**
> Design an agent profile picker component sheet for a light-mode AI app. Show 3 variants: (1) Horizontal row of pill buttons (Default, Frontend Bot, Backend Specialist) — current design but styled better, (2) Dropdown list — each item has emoji icon + profile name + description + active checkmark, (3) Grid of profile cards — larger cards with emoji, name, description, "Use this profile" on hover. All use warm palette, rounded corners. Active/selected state is clear.

---

## Priority 4 — Advanced Features

### 16. Subagent Monitor Panel

Shows live tree of spawned AI subagents during task execution.

**Prompt:**
> Design a subagent monitoring panel for a light-mode AI coding interface. Shows a tree/list of AI agents working in parallel. Each agent row: status icon (spinner/checkmark/X), agent name/description, elapsed time, token count. Nested children agents shown with indented tree lines. Summary bar at top: "3 agents running, 2 complete". Panel can be shown as: (1) Bottom drawer in chat, (2) Side panel, (3) Inline expandable card. Calm, information-dense. Status colors: running=blue pulse, done=green, failed=red.

---

### 17. Plan View / Review Mode

Shows AI's multi-step plan before execution, awaiting user approval.

**Prompt:**
> Design a plan review component for a light-mode AI chat interface. The AI presents a numbered execution plan before acting. Show: numbered steps list (each with icon, action description, affected files/paths), overall summary header, "Approve Plan" and "Reject / Give Feedback" buttons at bottom. Steps that involve risky actions (file delete, shell) have an amber warning badge. User can click individual steps to expand details. Component fills the chat message area. Calm editorial style.

---

### 18. Notification / Invite Flows

Used in Teams page to invite members and receive join notifications.

**Prompt:**
> Design an invite flow component sheet for a light-mode app. Show: (1) Invite member modal — email input + role selector (Owner/Editor/Viewer radio) + Send Invite button, (2) Pending invite card in list (current design but refined), (3) Accept invite landing page — "You've been invited to X workspace" + Accept/Decline buttons, (4) In-app notification badge — count badge on Teams nav item, notification popover with "Jane accepted your invite". Warm palette.
