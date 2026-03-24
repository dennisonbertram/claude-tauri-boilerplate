# STORY-007: Auto-Name Session Based on Content

## Walk Date
2026-03-22

## Goal
Verify sessions get auto-generated names based on content.

## Steps Performed

### Step 1: Check existing session names in sidebar
Analyzed all visible session names in the sidebar under "TODAY":

**Content-based names (meaningful):**
- "Classic Vanilla Butter Cake Recipe"
- "Testing Wider Input Feature"
- "JavaScript Trigger Initial Greeting"
- "Fun Project Ideas Brainstorm (fork)"
- "Pizza Recipe Request"

**Random adjective+noun names (not content-based):**
- "Crispy Meadow", "Brisk Breeze", "Swift Orchid", "Fuzzy Canyon"
- "Lucky Meadow", "Fuzzy Dune", "Lucky Orbit", "Swift Breeze"
- "Fuzzy Comet", "Quiet Dune", "Crispy Canyon", "Lucky Atlas"
- "Velvet Meadow", "Mighty Dune", "Swift Breeze"

**Generic default names:**
- "New Conversation" (appears multiple times)

### Step 2: Are names meaningful?
- ~5 out of ~22 sessions have content-based names (23%)
- ~15 sessions have random adjective+noun names (68%) -- NOT content-based
- ~4 sessions have the default "New Conversation" name (18%)
- **Result**: PARTIAL - Some sessions have content-based names, but the majority use random word combinations that give no indication of content

### Step 3: Create new chat to test auto-naming
- Clicked "New Chat" button
- New chat area appeared but no new session was created in the sidebar yet (session likely created on first message)
- Did not send a message to avoid consuming API credits
- **Result**: INCONCLUSIVE - would need to send a message to verify auto-naming

## Findings

| # | Type | Severity | Description |
|---|------|----------|-------------|
| 1 | UX | HIGH | Majority of sessions (68%) have random adjective+noun names (e.g., "Fuzzy Canyon") that provide no content context |
| 2 | UX | MEDIUM | Multiple sessions named "New Conversation" with no differentiation |
| 3 | Info | LOW | Some sessions do have content-based names, suggesting auto-naming works sometimes but not consistently |

## Screenshots
- `screenshots/session-names-sidebar.png` - Sidebar showing mix of name types

## Overall Result: PARTIAL PASS
Auto-naming exists but is inconsistent. Many sessions fall back to random word combinations instead of content-based names.
