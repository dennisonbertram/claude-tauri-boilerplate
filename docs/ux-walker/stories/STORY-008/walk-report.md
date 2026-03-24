# STORY-008: View Session Context Summary

## Walk Date
2026-03-22

## Goal
View session context/summary info (message count, date, tokens used, etc.)

## Steps Performed

### Step 1: Look for session metadata/context display
- Examined the new chat view and sidebar
- Sidebar shows session names only -- no metadata (message count, date created, size)
- The session list entries are plain buttons with text only
- **Result**: FAIL - No session metadata visible in sidebar

### Step 2: Check for context summary visible
- No message count, token count, or date information displayed on session list items
- No tooltip with metadata on hover (hover only reveals the action button)
- Some sessions display timestamps as their names (e.g., "Mar 21 at 9:15 PM") but this is the session name, not metadata
- **Result**: FAIL - No context summary visible anywhere

### Step 3: Check session header area for context information
- The header area shows: Chat/Code/Cowork tabs, model selector ("Sonnet 4.6"), mode selector ("Normal")
- No session-specific context info in the header (no message count, creation date, token usage)
- Could not load an existing session to check its header (known crash issue)
- **Result**: FAIL - No context information in header area

## Findings

| # | Type | Severity | Description |
|---|------|----------|-------------|
| 1 | Missing Feature | MEDIUM | No session metadata visible in sidebar (message count, date, size) |
| 2 | Missing Feature | MEDIUM | No context summary or token usage display anywhere |
| 3 | Missing Feature | LOW | No tooltip or secondary info on session hover |
| 4 | Limitation | LOW | Could not verify in-session context display due to known crash when clicking sessions |

## Screenshots
- `screenshots/main-view.png` - Main app view
- `screenshots/new-chat-view.png` - New chat view showing lack of context info

## Overall Result: FAIL
No session context summary or metadata is displayed anywhere in the UI.
