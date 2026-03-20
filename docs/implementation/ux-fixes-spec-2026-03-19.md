# UX Fixes Spec — 2026-03-19

**GitHub Issues**: #234–253
**Source audit**: docs/investigations/ux-review/ux-analysis-report.md

---

## Wave 1 — Quick Win Fixes (5 parallel tasks)

### Task 1: Window Title
**File**: `apps/desktop/index.html`
**Fix**: Change `<title>Tauri + React + Typescript</title>` → `<title>Claude Code</title>`

### Task 2: Duplicate "New Agent Profile" entries
**Files**: `apps/desktop/src/components/agent-builder/AgentBuilderView.tsx`, `AgentProfileSidebar.tsx`
**Fix**:
- `addProfile` creates with unique placeholder name: `New Profile ${Date.now()}` or sequential counter
- Better: If a profile with name "New Agent Profile" already exists (unsaved), do NOT create another. Instead navigate to/select the existing unsaved one.
- Update `AgentProfileSidebar` to detect unsaved profiles (no id persisted) and render them distinctly

### Task 3: Composer placeholder
**File**: `apps/desktop/src/components/chat/ChatInput.tsx`, `apps/desktop/src/components/chat/WelcomeScreen.tsx`
**Problem**: The `ghostText` prop (shown when input is empty) is being set to the focused suggestion chip text, which bleeds into the placeholder area confusingly.
**Fix**: Composer placeholder should always be `"Message Claude..."`. The `ghostText` / suggestion passthrough to input should be removed or clearly distinguished visually.

### Task 4: Duplicate CTAs on Welcome Screen
**File**: `apps/desktop/src/components/chat/WelcomeScreen.tsx`, `apps/desktop/src/components/sessions/SessionSidebar.tsx`
**Fix**:
- Keep the center panel "New Conversation ⌘N" as the PRIMARY CTA (it has the keyboard shortcut)
- Keep the sidebar "New Chat" button as a small icon-only button (no text label)
- OR: remove the sidebar "New Chat" button entirely since clicking the chat nav tab already implies new chat

### Task 5: Duplicate CTAs on Empty State Screens
**Files**: `apps/desktop/src/components/teams/TeamsView.tsx`, `apps/desktop/src/components/agent-builder/AgentBuilderView.tsx`
**Fix**:
- Teams: Remove the "New Team" from header OR make it icon-only. Keep the centered empty state CTA with description text.
- Agents: Remove "Create New Profile" from center empty state, keep header "+ New agent profile" button.

---

## Wave 2 — Behavior Fixes (after Wave 1 review passes)

### Task 6: Status bar "Normal" → inline effort picker
**Files**: `apps/desktop/src/components/StatusBar.tsx`
**Fix**: Clicking the effort button should show a small popover with Low/Medium/High/Max options. NOT open settings panel.

### Task 7: Strip markdown from session titles
**Files**: wherever session titles are generated/saved — search for `setSessionTitle`, `updateSession`, AI title generation code
**Fix**: Strip markdown syntax (`**`, `_`, `#`, `` ` ``, etc.) from auto-generated titles before saving

### Task 8: Date grouping in conversations sidebar
**File**: `apps/desktop/src/components/sessions/SessionSidebar.tsx`
**Fix**: Group sessions into Today / Yesterday / This Week / This Month / Older buckets with dividers

### Task 9: Fix emoji duplication in agent profile icon field
**File**: `apps/desktop/src/components/agent-builder/tabs/GeneralTab.tsx` (or wherever the icon field is rendered)
**Fix**: The swatch preview and input field both show the emoji. Ensure preview is visually distinct (in a rounded box, separated from input).

### Task 10: Fix automation canvas white rectangle
**File**: `apps/desktop/src/components/agent-builder/HookCanvas.tsx`
**Fix**: Identify the source of the white rectangle (likely minimap styling or React Flow overlay). Remove or fix CSS.

---

## Repomix Include Pattern

```
apps/desktop/index.html,apps/desktop/src/components/chat/WelcomeScreen.tsx,apps/desktop/src/components/chat/ChatInput.tsx,apps/desktop/src/components/sessions/SessionSidebar.tsx,apps/desktop/src/components/agent-builder/AgentBuilderView.tsx,apps/desktop/src/components/agent-builder/AgentProfileSidebar.tsx,apps/desktop/src/components/teams/TeamsView.tsx
```
