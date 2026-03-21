# UX Stories: Chat Sessions & History

Topic: Chat Sessions & History  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: Create First Chat Session

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: New user onboarding
**Goal**: Start their first conversation with Claude
**Preconditions**: App is open, user is authenticated, no sessions exist yet

### Steps
1. User sees Welcome Screen with message "Start a conversation to work with Claude on your code" → Blue "New Conversation" button is visible
2. User clicks "New Conversation" button → ChatPage loads with empty message area, SessionSidebar shows "No conversations yet"
3. User types first prompt ("Help me optimize this React component") in the chat input → Send button activates
4. User submits message → Session is created with auto-generated name (e.g., "Fuzzy Okapi"), message appears in ChatPage
5. Claude responds, message appears in the chat stream → SessionSidebar now shows session in "Today" bucket with today's date

### Variations
- **With Profile Selection**: If agent profiles exist, user selects a profile from ProfileSelector before clicking "New Conversation"
- **With Custom Name**: User creates session with `POST /api/sessions` including a title parameter instead of accepting auto-generated name

### Edge Cases
- **First message takes time**: User submits first message, stream is buffering; session still appears in sidebar with loading state
- **Profile selection then cancel**: User selects profile, then closes Welcome Screen without creating chat; profile selection persists for next attempt

---

## STORY-002: Search Sessions by Topic

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: Power user with 30+ sessions
**Goal**: Quickly find a specific session about React testing
**Preconditions**: User has multiple sessions created over past weeks (e.g., "Vue Component Refactor", "React Testing Setup", "API Integration Debug")

### Steps
1. User focuses on SessionSidebar search input (or presses Cmd+K) → Input placeholder shows "Search sessions"
2. User types "react" → Sidebar filters in real-time, shows only sessions matching "react"
3. SessionList displays "React Testing Setup" and "API Integration Debug" under "Today" bucket
4. User clicks "React Testing Setup" → ChatPage loads with full conversation history
5. User can see conversation context immediately; can continue chatting or scroll up to see earlier messages

### Variations
- **Partial match**: User types "tes" → "React Testing Setup" still appears (full-text search is case-insensitive)
- **No results**: User types "golang" → Sidebar shows "No sessions match \"golang\""
- **Clear search**: User clicks X in search field (or selects all and backspaces) → Full session list returns

### Edge Cases
- **Empty search input**: User presses Cmd+K, search input auto-focuses, user then presses Escape to close
- **Search while streaming**: User has search results, selects a session, starts new chat that begins streaming; sidebar temporarily locks to prevent race conditions

---

## STORY-003: Rename Session After Conversation

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: Organized user who wants meaningful session names
**Goal**: Change auto-generated session name to "React Query Optimization"
**Preconditions**: Session exists with auto-generated name like "Curious Parrot", user has had a 5-turn conversation

### Steps
1. User hovers over session row in sidebar → Three-dot menu (⋮) icon appears on the right
2. User clicks menu icon → Dropdown appears with options [Rename, Fork, Export JSON, Export Markdown, Delete]
3. User clicks "Rename" → Session row enters edit mode with inline text input field, text is pre-selected
4. User types new name "React Query Optimization" (old name is replaced) → Input field is active with blinking cursor
5. User presses Enter or clicks elsewhere → SessionSidebar updates, session list refreshes with new title, chat header also reflects new name

### Variations
- **Undo by pressing Escape**: User starts renaming, presses Escape → Edit mode closes, original name is restored
- **Very long name**: User types 489-character title (just under 500-char limit) → Title is accepted and truncated in sidebar view with ellipsis
- **Whitespace trimming**: User types "  New Title  " → Title is saved as "New Title" (leading/trailing spaces removed)

### Edge Cases
- **Rename to same name**: User changes "Session A" to "Session A" → API detects no change, cancels rename, reverts to display mode
- **Rename during sync**: Session is being synced to server; user renames locally → UI shows optimistic update, then syncs to server
- **Network error on rename**: User submits rename, server returns 500 → Toast error appears ("Failed to rename session"), original name is restored

---

## STORY-004: Fork Session at Checkpoint

**Type**: medium
**Topic**: Chat Sessions & History
**Persona**: Developer exploring multiple approaches to a problem
**Goal**: Create a branch of current session to try a different implementation strategy
**Preconditions**: Session has 12 messages (6 turns), user has reviewed the conversation and wants to branch at message 6

### Steps
1. User reviews conversation in ChatPage, scrolls up to message 6 (turn 3 response from Claude)
2. User hovers over the message → A "Fork Here" button appears next to the timestamp
3. User clicks "Fork Here" → RewindDialog opens showing the checkpoint at message 6
4. Dialog displays "Create a new session fork from this point?" with two options: "Cancel" and "Fork"
5. User clicks "Fork" → API call `POST /api/sessions/:id/fork` with messageIndex=6
6. New session is created with name "Curious Parrot (fork)" and first 6 messages are copied
7. User is automatically switched to new session → ChatPage reloads with forked session, SessionSidebar shows new session active

### Variations
- **Custom fork name**: Dialog allows user to type custom name (e.g., "Alternative Approach") → Fork is created with custom title instead of auto-generated
- **Fork from start**: User forks at message 0 (beginning) → New empty session is created
- **Fork full session**: User doesn't specify messageIndex → All messages are copied to new session

### Edge Cases
- **Large message count**: Session has 500 messages; fork takes 2 seconds → Spinner appears in dialog, UX shows progress
- **Server error during fork**: API returns 500 → Toast error appears, dialog closes, original session remains active
- **Fork while streaming**: User initiates fork while new message is streaming → Fork request queues until stream completes

---

## STORY-005: Export Session to Markdown

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: Technical writer documenting a code review
**Goal**: Export session as markdown to include in project documentation
**Preconditions**: Session titled "Feedback on Auth Module" has 8 messages, user has completed review

### Steps
1. User hovers over session in sidebar → Three-dot menu appears
2. User clicks menu → Dropdown shows [Rename, Fork, Export JSON, Export Markdown, Delete]
3. User clicks "Export Markdown" → API call `GET /api/sessions/:id/export?format=md`
4. Browser downloads file "Feedback_on_Auth_Module.md" → File contains:
   - Heading with session title
   - Export timestamp
   - Each message with **User:** or **Assistant:** label
   - Message content in markdown format
5. User opens file in editor, sees clean readable format ready to paste into docs

### Variations
- **Export JSON**: User selects "Export JSON" → File downloads with structured JSON including metadata, timestamps, and message array
- **Long filename handling**: Session title is "Fix [URGENT] React 19 Migration - Component X/Y/Z Issues" → Filename becomes "Fix_URGENT_React_19_Migration_Component_XYZ_Issues.json" (unsafe chars removed, truncated to 50 chars)

### Edge Cases
- **Session with code blocks**: Messages contain markdown code blocks with language tags → Exported file preserves formatting
- **Unicode in session title**: Session is "修复 Bug 报告" → Filename sanitization converts to safe ASCII: "Bug.md"
- **Download blocked**: Corporate firewall blocks download → User can copy content from export response shown in DevTools

---

## STORY-006: Delete Session with Confirmation

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: User cleaning up old sessions
**Goal**: Permanently remove an outdated session about "Old Node.js API Design"
**Preconditions**: Session exists and hasn't been used in 3 weeks

### Steps
1. User hovers over session row "Old Node.js API Design" → Three-dot menu appears
2. User right-clicks session (context menu) or clicks the ⋮ icon → Menu opens
3. User clicks "Delete" (red destructive action) → Menu closes, session row enters delete confirmation state
4. Inline confirmation appears: "Delete \"Old Node.js API Design\"?" with [Delete] (red) and [Cancel] buttons
5. User pauses for 1 second (thinking if they're sure) → Clicks red "Delete" button
6. SessionSidebar removes the session row, no longer appears in list → If this was active session, ChatPage shows Welcome Screen
7. Toast notification confirms "Session deleted" (optional)

### Variations
- **Cancel deletion**: At step 5, user clicks "Cancel" → Confirmation state closes, session returns to normal view
- **Delete active session**: User deletes the currently open session → ChatPage switches to Welcome Screen, sidebar is updated
- **Accidental click recovery**: User accidentally clicks delete, notices in step 4, clicks Cancel → Session is preserved

### Edge Cases
- **Server error on delete**: API returns 500 → Toast error appears ("Failed to delete session"), session row remains, confirmation closes
- **Delete while syncing**: Session is uploading to cloud; user initiates delete → Delete is queued, processed after sync completes
- **Network lost**: User deletes session, network goes offline → Client shows optimistic deletion, retries on reconnect

---

## STORY-007: Auto-Name Session Based on Content

**Type**: medium
**Topic**: Chat Sessions & History
**Persona**: User wanting meaningful names without manual input
**Goal**: Have a session automatically renamed based on the first few messages
**Preconditions**: Session has 3+ messages, user sees it has an auto-generated name like "Swift Tiger"

### Steps
1. User hovers over session in sidebar → Three-dot menu appears
2. (Alternative) User can click menu icon and look for "Auto-Name" option if available, OR use keyboard shortcut
3. User right-clicks → Menu shows [Rename, Fork, Export JSON, Export Markdown, Delete]
4. (Note: In current implementation, auto-name is called programmatically; user doesn't directly trigger it)
5. **Behind the scenes**: System analyzes first user message ("I need help refactoring my authentication flow") and first assistant response → Generates title
6. New title appears: "Authentication Flow Refactoring" → SessionSidebar updates, header reflects new name

### Variations
- **Privacy mode**: User has privacy mode enabled → Auto-name uses local deterministic title like "Session 2026-03-20" instead of calling external AI
- **Manual trigger via API**: Frontend calls `POST /api/sessions/:id/auto-name` with model parameter → Title is generated using specified model
- **User rejects auto-name**: Generated title doesn't match user's intent → User manually renames to "Auth Refactor - RBAC Approach"

### Edge Cases
- **Session has no messages**: User tries to auto-name empty session → Server returns 400 "No messages to generate title from"
- **Auto-name in progress**: User manually renames while auto-name API call is in flight → Latest rename wins (optimistic update)
- **Slow generation**: AI takes 3 seconds to generate title → Spinner or loading state appears in SessionSidebar

---

## STORY-008: View Session Context Summary

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: User returning to old session after a week
**Goal**: Quickly understand what the session was about
**Preconditions**: Session exists with 10+ messages, created 7 days ago

### Steps
1. User clicks on old session in sidebar → ChatPage loads with message history
2. Near the top of the chat, below the session title, a "Context Summary" section appears
3. Summary reads: "Discussed React performance optimization techniques, implemented lazy loading and memo patterns, debugged useCallback issues" → Generated from messages via `POST /api/sessions/:id/summary`
4. User skims summary for 5 seconds → Remembers the context and feels confident continuing the conversation
5. User scrolls down to see recent messages or types new message to continue → Chat resumes

### Variations
- **Very short session**: Session has only 1 message → No summary is generated, ContextIndicator shows "No context available"
- **Privacy mode**: Summary generation is skipped → Shows "Summary unavailable (privacy mode)"
- **User scrolls past summary**: Once user scrolls down, summary collapses and becomes a small collapsible toggle

### Edge Cases
- **Summary generation fails**: Server error during summary generation → Toast shows "Failed to load summary", section is hidden
- **Summary is loading**: User opens session, summary endpoint is slow → Spinner appears in summary area
- **Session context is very large**: 50+ messages → Summary may take longer to generate, user sees skeleton placeholder

---

## STORY-009: Link Session to Agent Profile

**Type**: medium
**Topic**: Chat Sessions & History
**Persona**: User with multiple profiles (e.g., "Code Reviewer", "Architect", "QA Tester")
**Goal**: Associate a session with the "Code Reviewer" profile so it uses specific tools and prompts
**Preconditions**: User has created 2+ agent profiles, has an existing session without a profile link

### Steps
1. User creates new session with `POST /api/sessions` and includes profileId parameter → Session is created and linked to profile
2. SessionSidebar shows session row with a ProfileBadge next to the date (e.g., small tag labeled "Code Reviewer")
3. When user opens this session in ChatPage → Header displays profile name, available tools are from that profile's toolset
4. User sends a message → System uses the profile's custom system prompt and model settings
5. Session name, profile link, and all settings persist in sidebar → User can see at a glance which profile is active

### Variations
- **Change profile mid-session**: User sends first 3 messages with Profile A, then switches to Profile B → Future messages use Profile B, history remains Profile A colored
- **Create session without profile**: User creates session without specifying profileId → No badge appears, default profile or no profile is used
- **Profile selector in Welcome Screen**: User sees ProfileSelector component before clicking "New Conversation" → Can pick profile first, then chat uses that profile

### Edge Cases
- **Profile deleted**: User deletes a profile that was linked to a session → Badge still shows profile name (or marks as "Profile Removed"), chat continues with stored settings
- **Profile becomes unavailable**: User loses access to a profile during session → Session shows error in profile badge area
- **Switch profile during streaming**: User changes profile while message is streaming → Change queues until stream completes, next message uses new profile

---

## STORY-010: List and Organize Sessions by Date

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: Long-time user with 80+ sessions over 3 months
**Goal**: Quickly scan all sessions organized by recency
**Preconditions**: User has sessions spanning "Today", "Yesterday", "This Week", "This Month", and "Older"

### Steps
1. User opens app → SessionSidebar loads, displays session groups:
   - **Today**: "React Hooks Deep Dive", "TypeScript Migration"
   - **Yesterday**: "CSS Grid Layout"
   - **This Week**: "GraphQL API Design", "Node.js Error Handling"
   - **This Month**: "Docker Setup Guide", "Authentication Flow"
   - **Older**: "Initial Setup", "Python Scripts", ...
2. Each group has a gray section header (e.g., "TODAY") in small caps
3. Sessions within each group are sorted by creation date (newest first within bucket)
4. User scans and finds "TypeScript Migration" under Today → Clicks it to load
5. SessionSidebar smoothly scrolls to keep selected session visible

### Variations
- **Only "Today" sessions**: User has 3 sessions created today → Only "Today" bucket is shown
- **Search within buckets**: User searches for "react" → Buckets collapse to show only matching sessions
- **Responsive sidebar**: On small window, bucket headers remain sticky as user scrolls through sessions

### Edge Cases
- **Session created at midnight**: Session created at 11:59 PM yesterday vs 12:00 AM today → Correctly placed in respective buckets based on system date
- **User changes system timezone**: Buckets recalculate based on new timezone → UI updates appropriately
- **Locale-specific date formatting**: User's locale is German → Headers show "Heute", "Gestern", etc. (if i18n is implemented)

---

## STORY-011: Recover Recently Deleted Session

**Type**: medium
**Topic**: Chat Sessions & History
**Persona**: User who accidentally deleted important session
**Goal**: Restore "Q4 Performance Analysis" session that was deleted 5 minutes ago
**Preconditions**: Session was deleted via trash/delete action, and undo grace period is active (typically 30 mins)

### Steps
1. User deletes session "Q4 Performance Analysis" → Toast notification appears: "Session deleted. Undo?" with time stamp
2. User immediately clicks "Undo" button in toast → API call `POST /api/sessions/:id/restore` is made
3. Session reappears in SessionSidebar under original date bucket → All messages are restored
4. User clicks on restored session to verify it's complete → ChatPage shows all 15 messages intact
5. User continues working, no data was lost

### Variations
- **No undo action implemented**: System immediately deletes (no recovery) → Warning dialog appears before delete: "This action cannot be undone. Delete?"
- **Restore after 30 mins**: User tries to restore after grace period expires → Toast shows "Session already permanently deleted"
- **Restore from settings**: If a trash/recycle bin view exists, user can browse deleted sessions → Select and permanently restore

### Edge Cases
- **Multiple deletes in quick succession**: User deletes 3 sessions quickly → Each has its own undo toast stacked
- **Network error on undo**: Undo request fails → Toast shows "Failed to restore session", original delete persists
- **Disk space limits**: Recovery fails due to storage constraints → Error message explains situation

---

## STORY-012: Browse Full Session Thread with Message Parts

**Type**: medium
**Topic**: Chat Sessions & History
**Persona**: Developer reviewing a complex multi-turn conversation
**Goal**: View complete message thread including tool calls, thinking, and file operations
**Preconditions**: Session has 20 messages including tool calls and images, all persisted in DB

### Steps
1. User opens session with complex history → ChatPage displays MessageList with full thread
2. User scrolls to see message structure:
   - Message 1 (user): "Analyze this codebase"
   - Message 2 (assistant): Contains [thinking block] + [text response] + [tool calls: read file X, grep for pattern Y]
   - Message 3 (assistant): Displays file contents and grep results as formatted blocks
   - Message 4 (user): "Now refactor the auth module"
   - ... and so on for 20 messages
3. Each message part is rendered appropriately (ThinkingBlock for thinking, ToolCallBlock for tool uses, formatted text)
4. User clicks "Show More" or scrolls on a long message → Additional content expands, thread remains readable
5. API endpoint `GET /api/sessions/:sessionId/thread` returns ThreadMessage[] with parts array

### Variations
- **Message with image attachments**: User scroll to see message with AttachedImage components → Images display inline
- **Message with markdown**: Assistant response contains code blocks, lists, tables → All render with syntax highlighting
- **Legacy messages without parts**: Old session with plain message.content → Synthesized as single text part

### Edge Cases
- **Very large message count**: 500+ messages → Virtual scrolling is applied, only visible messages render
- **Slow thread load**: API takes 2 seconds → Message list shows skeleton loaders
- **Message parts fail to parse**: Corrupted message_parts JSON → Fallback to displaying plain text content

---

## STORY-013: Share Session Export with Team

**Type**: long
**Topic**: Chat Sessions & History
**Persona**: Team lead sharing code review findings
**Goal**: Export session as JSON and share findings with teammates
**Preconditions**: Session contains 10 messages with detailed code review feedback, multiple file diffs

### Steps
1. User completes code review session titled "UserAuth Component Review" → Has 8 messages of feedback
2. User hovers over session → Clicks three-dot menu
3. User selects "Export JSON" → File "UserAuth_Component_Review.json" downloads
4. User opens file in editor to verify contents include all messages and metadata
5. User opens Slack channel #engineering → Drags downloaded JSON file into message composer
6. User types: "Here's the full code review feedback with all AI suggestions. See attached." → Sends message
7. Teammates download file, open in editor or paste into their own sessions
8. (Optional) Team uses `POST /api/sessions` with messages array to recreate session locally

### Variations
- **Share as Markdown**: User exports as markdown instead → File is more readable in web viewers, teammates can paste into docs
- **Share via link**: Backend provides temporary shareable link for export (if implemented) → User shares URL instead of file
- **Import shared session**: Teammate receives JSON → Can import into their own app to recreate session with all context

### Edge Cases
- **Large session**: 100+ messages → JSON file is 2MB+ → Download works but is slower
- **Proprietary code in session**: Messages contain company secrets → User should be aware file contains full conversation history
- **Character encoding issues**: Session contains emoji or non-ASCII text → Exported JSON handles UTF-8 correctly

---

## STORY-014: Session Persistence Across App Restart

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: User who closes and reopens app mid-conversation
**Goal**: Resume work exactly where they left off
**Preconditions**: User was working on session "Feature Flag Implementation", had sent 5 messages, app was closed

### Steps
1. User had session "Feature Flag Implementation" open with 5 messages, app was closed
2. User reopens app → SessionSidebar loads with full list of all sessions (fetched from `GET /api/sessions`)
3. "Feature Flag Implementation" is visible in "Today" bucket
4. SessionSidebar shows active session state from previous session if stored (or user can click to reopen)
5. User clicks on the session → ChatPage loads and fetches messages via `GET /api/sessions/:id/messages`
6. All 5 previous messages appear, conversation can continue from where it left off
7. User types new message → Session Claude ID and conversation context are preserved

### Variations
- **No session was previously active**: User closes app with Welcome Screen visible → App reopens to Welcome Screen
- **Session was deleted**: Previously active session no longer exists → App shows Welcome Screen with message "Previous session deleted"
- **Multiple sessions**: User had 3 sessions open (tabs) → All are persisted; clicking any one loads it

### Edge Cases
- **Database corruption**: Session data is partially corrupted → App shows error, graceful fallback to session list without specific session loaded
- **Very old session**: Last accessed 6 months ago → Still loads correctly with full message history
- **App upgrade**: App updates between sessions → Old session format is migrated, still loads correctly

---

## STORY-015: Handle Session with Profile Badge

**Type**: short
**Topic**: Chat Sessions & History
**Persona**: User with multiple specialized agent profiles
**Goal**: Quickly identify which profile was used for a session at a glance
**Preconditions**: User has created "Code Reviewer" and "Technical Writer" profiles, sessions linked to them

### Steps
1. SessionSidebar displays sessions in groups
2. For each session with a profile link, a small ProfileBadge appears next to the date
3. Example row: "TypeScript Linting Setup" [Mar 19] [Code Reviewer badge in blue]
4. User can see at a glance that this session used the Code Reviewer profile
5. When user opens the session → ChatPage header shows profile name, available tools, and settings
6. If session has no profile, no badge appears → Uses default settings

### Variations
- **Profile color coding**: Different profiles have different badge colors (Reviewer = blue, Writer = green, Architect = orange)
- **Profile icon**: Badge includes small icon representing profile (e.g., 👁️ for reviewer)
- **Hover tooltip**: Hovering over badge shows profile description

### Edge Cases
- **Badge space constraint**: On narrow sidebar, badge overlaps with session title → Badge moves to second line or title truncates
- **Many profiles**: User has 10+ profiles → Sidebar might show only initials in badge
- **Profile name changes**: User renames "Code Reviewer" to "Senior Reviewer" → All session badges update to new name

---

**Summary of Stories**:
- **5 Short stories**: Create, Search, Rename, Delete, Export (core operations)
- **6 Medium stories**: Fork, Auto-Name, Profile Link, Summary, Thread View, Recovery
- **4 Long stories**: Browse Thread Details, Share Export, Persistence, Profile Badges
- **Total: 15 stories** covering session CRUD, history management, organization, and cross-feature integration

All stories reference actual UI components (SessionSidebar, SessionItem, menu actions), API endpoints (`POST /api/sessions`, `PATCH`, `DELETE`, `/fork`, `/export`, `/summary`, `/auto-name`, `/thread`), and realistic user behaviors found in the codebase.
