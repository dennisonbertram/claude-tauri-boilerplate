# UX Stories: Streaming Chat Interface

Topic: Streaming Chat Interface  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: First Message with Image Attachment

**Type**: medium  
**Topic**: Streaming Chat Interface  
**Persona**: Software developer  
**Goal**: Start a new chat session and attach a screenshot to ask for help

**Preconditions**:
- New chat session created (no messages)
- Welcome screen visible with empty input area
- Screenshot file ready on desktop (PNG, ~2MB)

**Steps**:
1. User takes a screenshot of an error dialog and saves it to desktop
2. User opens the chat, sees "Tell Claude what you're working on..." placeholder
3. User types: "Why is this happening?"
4. User clicks the attachment icon (📎) or drags the screenshot onto the input area
5. Image loads and appears as a thumbnail pill below the input with filename `screenshot.png`
6. User presses Cmd+Enter (or clicks Send)
7. Input clears, message appears in chat history with avatar "You" and the image thumbnail inline
8. "Assistant is typing..." indicator appears, dots animate
9. First token streams in: "Based on..." and message progressively appears word-by-word
10. Tool call block appears: "Bash: echo $JAVA_HOME" (collapsible, shows status: running)
11. Tool finishes with green checkmark, output displays
12. Final assistant message finishes with 5,234 tokens used, cost breakdown shows $0.0015

**Variations**:
- **Multiple images**: Drag 3 images at once; thumbnails stack horizontally; all appear in final message
- **Non-image file**: User drags a `.txt` file; appears as plain text attachment (name only, no preview)
- **Cancel attachment**: User clicks X button on image pill before sending; image removed, input preserved

**Edge Cases**:
- **Large image (>5MB)**: Browser loads slowly but doesn't crash; UI shows spinner while converting to data URL
- **Attachment during streaming**: User adds image while response is streaming; image added to next turn instead
- **Mixed file types**: User pastes text AND has images attached; both included in message

---

## STORY-002: Effort Picker Flow with Thinking Budget Trade-off

**Type**: short  
**Topic**: Streaming Chat Interface  
**Persona**: Senior engineer tackling a complex architectural decision  
**Goal**: Use "Max" effort for deep reasoning and monitor thinking token spend

**Preconditions**:
- Session with 2-3 prior messages
- Default effort is "High" (settings shows 16,000 thinking budget)
- Context indicator shows 35% usage

**Steps**:
1. User asks: "Design a caching strategy for this microservice"
2. User notices effort buttons in settings (Low | Medium | High | Max) in input toolbar
3. User clicks "Max" button; button highlights in blue
4. User sends message
5. Response begins streaming; within 2 seconds, a "Thinking..." block collapses below the assistant message
6. Thinking block shows: "Thinking... (2.3s)" with a Brain icon
7. User hovers over Thinking block's expand arrow to see reasoning ("Let me consider the trade-offs: consistency vs performance...")
8. Main response streams: "Based on the access patterns, I'd recommend..."
9. Context indicator changes to yellow (73% usage) as thinking tokens accumulate
10. Final message shows 8,234 thinking tokens + 2,156 regular output tokens

**Variations**:
- **Low effort chosen**: User selects "Low"; response arrives in 3 seconds with no thinking block; context stays at 35%
- **Thinking toggle off**: User has "Show Thinking" disabled in settings; thinking block never appears, but token count still shows
- **Max effort context warning**: Reaching 85% context triggers red color + pulse on indicator; user notices and exports session before running out

**Edge Cases**:
- **Early response end**: Thinking finishes but streams slowly; user sees "(2.3s)" then 5 seconds of thinking text trickles in
- **Thinking timeout**: Model hits 16k thinking budget mid-reasoning; cuts off thinking block at limit with "(16.0k tokens)")

---

## STORY-003: Real-time Tool Visualization with Elapsed Time

**Type**: medium  
**Topic**: Streaming Chat Interface  
**Persona**: DevOps engineer  
**Goal**: Monitor tool execution in real-time and understand what the assistant is doing

**Preconditions**:
- Message asking: "Run diagnostics on the database connection pool"
- Session connected to a project workspace

**Steps**:
1. User sends message; response begins streaming
2. First assistant text appears: "I'll run diagnostics..."
3. Tool block appears: "Bash: curl -s http://localhost:5432/health" (status: running with spinner)
4. Elapsed timer shows "0s" and increments: "1s", "2s"...
5. User watches tool run for 4 seconds
6. Tool block status changes to green checkmark (complete)
7. Output section expands showing: "{"status":"ok","latency":"12ms"}"
8. Next tool block appears: "Bash: pg_stat_statements query..." (running, 0s)
9. Meanwhile, main response continues streaming with analysis text: "The connection pool is healthy..."
10. Second tool completes (3s), shows results
11. Both tool blocks collapse by default; user can re-expand to see details
12. Final summary text finishes streaming

**Variations**:
- **Tool error**: Bash tool fails (red X); output shows error message; assistant immediately responds "I see the issue..."
- **Parallel tools (future)**: Multiple tool blocks run side-by-side if subagents are involved
- **Long-running tool**: Tool hits 30+ seconds; user can click "View Details" to see streaming logs

**Edge Cases**:
- **Tool mid-response**: User clicks a tool block expand button while it's still running; animation stutter avoided by using CSS transitions
- **Network lag**: Tool takes 2s just to start; elapsed shows "0s" for 2 seconds, then jumps to "2s" instantly
- **Tool output truncation**: Output is 50KB; shows first 20KB with "...show more" button

---

## STORY-004: Model & Effort Selector with Fast Mode Toggle

**Type**: short  
**Topic**: Streaming Chat Interface  
**Persona**: Impatient user in a time crunch  
**Goal**: Switch to fast mode for quick iterative feedback on code changes

**Preconditions**:
- Default model: claude-sonnet-4-6
- Effort: High
- Fast mode toggle: Off

**Steps**:
1. User opens Settings (gear icon in chat input area) or accesses from main settings
2. User sees "Fast Mode" toggle under "Model" section
3. User clicks toggle; it switches on (blue)
4. Settings briefly shows: "Effort forced to Low for speed"
5. User closes settings
6. In chat input area, Effort buttons now show "Low" as selected (was "High")
7. User types: "Refactor this function to use async/await"
8. User sends; response arrives in ~3 seconds (vs. 12 seconds in High effort)
9. No Thinking block appears
10. Context indicator stays low (43% usage vs. would have been 68%)
11. Response is concise but complete: "Here's a refactored version..."

**Variations**:
- **Fast mode auto-disabled on complex task**: User asks "Architect a distributed system"; system detects and suggests High effort, user confirms
- **Model switch**: User changes model dropdown from Sonnet to Haiku; notice appears "Uses fewer tokens. $0.0004/1K input tokens vs $0.003/1K"
- **PR Review model**: User has separate "PR Review Model" setting for code-review workflow (Haiku by default)

**Edge Cases**:
- **Nested effort conflict**: Fast mode ON, but user has a workspace set to "Max effort code review"; UI disambiguates which applies when
- **Missing model**: User selects a model that's not available; error banner appears "Model not available. Switch back?"

---

## STORY-005: Suggestion Chips After Empty Assistant Message

**Type**: short  
**Topic**: Streaming Chat Interface  
**Persona**: New user seeking guidance  
**Goal**: Get AI-generated suggestions for next steps

**Preconditions**:
- Chat with 1-2 prior exchanges
- Last message is assistant response about a task
- Suggestion chips feature enabled in settings (default)

**Steps**:
1. User waits for assistant response to fully stream
2. After final token, Suggestion Chips appear above input (not before, once response complete)
3. Chips show: "Refactor the test", "Add error handling", "Explain the logic"
4. User hovers over first chip; it highlights with light background
5. User clicks "Refactor the test"
6. Chip text instantly appears in input field: "Refactor the test"
7. Input focuses; user sees cursor at end
8. User appends: " to use the new testing framework"
9. User sends; normal flow continues

**Variations**:
- **Dismiss chips**: User clicks X on a chip to remove it; chip disappears without sending
- **No suggestions generated**: Assistant response was very long; chips don't generate (server-side limit)
- **Regenerate chips**: User clicks "Refresh" button next to chips; new set generated in 2 seconds

**Edge Cases**:
- **Suggestions appear late**: Chips load 5 seconds after response finishes (backend Haiku call delayed); no spinner shown
- **Chip text too long**: Chip text truncates with "..." if longer than 50 chars; full text shows on tooltip

---

## STORY-006: Cost Tracking with Expandable Breakdown

**Type**: short  
**Topic**: Streaming Chat Interface  
**Persona**: Budget-conscious developer  
**Goal**: Monitor token usage and costs per message

**Preconditions**:
- Session with 5 messages exchanged
- Cost Display badge visible in top right of chat area
- Session total so far: $0.0247

**Steps**:
1. User notices cost badge in toolbar showing "$0.02" (abbreviated)
2. User clicks badge to expand detail panel
3. Panel slides down from top, shows "Cost Breakdown" header + "$0.0247" total
4. Below: list of messages with costs:
   - "#1 · Haiku: $0.0012" (1,240 in / 85 out)
   - "#2 · Sonnet: $0.0059" (2,100 in / 340 out)
   - "#3 · Sonnet: $0.0108" (3,200 in / 820 out) ← most expensive
   - "#4 · Haiku: $0.0043" (920 in / 245 out)
   - "#5 · Sonnet: $0.0025" (1,100 in / 155 out)
5. User scrolls in panel to see all
6. User notices "#3 used significantly more tokens (cache miss?)
7. User clicks elsewhere to close panel

**Variations**:
- **Cache hit**: Message shows "Cache R: 2,500" tokens (read); overall cost is lower
- **Thinking tokens**: Message with thinking shows separate line "Thinking: 8,234 tokens" inside the cost breakdown
- **Different model costs**: Haiku messages show "$0.0008" vs Sonnet "$0.0089" for similar input

**Edge Cases**:
- **No costs yet**: First message typing but not sent; panel shows "No cost data yet"
- **Cost calculation lag**: Final token arrives, cost badge doesn't update for 1-2 seconds while backend calculates

---

## STORY-007: Context Indicator Nearing Limit

**Type**: short  
**Topic**: Streaming Chat Interface  
**Persona**: Researcher with long-running conversation  
**Goal**: Understand and respond to context window filling up

**Preconditions**:
- Session with 20+ messages
- Max context tokens: 200,000
- Current usage: 168,000 tokens (84%)
- Context indicator visible in toolbar showing "84%" in yellow with warning color

**Steps**:
1. User sends another message: "Continue analyzing..."
2. Context indicator pulses yellow (indicates caution)
3. User hovers over context indicator
4. Tooltip appears showing:
   - Input: 142,300
   - Output: 25,700
   - Cache Read: 0
   - Cache Write: 0
   - Total: 168,000 / 200,000 (84%)
5. User reads tooltip and realizes context is getting tight
6. User hovers away; tooltip fades
7. Response arrives; context jumps to 91% (red now)
8. Context indicator becomes critical (bright red) + pulse animation
9. User sees an inline banner: "Context window at 91%. Consider exporting this session soon or compacting context."
10. User clicks "Learn more" link; short help text appears about compacting

**Variations**:
- **Auto-compact triggered**: At 95% usage, system automatically compacts context (shows "Compacting..." text on indicator)
- **Export suggestion**: At 85%, banner suggests "Export this session to start fresh?" with quick export button
- **Exceeded limit (recovery)**: System gracefully fails next message with error banner; user must export + restart

**Edge Cases**:
- **Cache read large**: User has 80K cache read tokens; indicator still shows 85% (cache read is cheap)
- **Rapid message spam**: User sends 5 quick messages; context meter jumps erratically as responses stream in

---

## STORY-008: Markdown with Code, LaTeX, and Mermaid Rendering

**Type**: medium  
**Topic**: Streaming Chat Interface  
**Persona**: Technical writer  
**Goal**: See rich media in assistant responses (code blocks, equations, diagrams)

**Preconditions**:
- Message asking: "Explain the Fourier transform with a diagram"
- Session configured with markdown rendering enabled (default)

**Steps**:
1. User sends query
2. Response begins streaming
3. First paragraph of text appears: "The Fourier transform converts..."
4. Code block starts rendering: "```python" begins appearing as plain text
5. Code lines stream in:
   ```python
   import numpy as np
   ```
   (continues with syntax highlighting as stream finishes code block)
6. Code block UI shows "Copy" button in top-right
7. User continues reading; LaTeX equation appears mid-text: "$e^{i\pi} + 1 = 0$"
8. Equation renders beautifully with proper symbols and spacing
9. Next section has a "```mermaid" block starting to stream
10. Mermaid diagram renders as visual graph once complete:
    - Node: "Input Signal" → "FFT Algorithm" → "Frequency Domain"
    - Interactive (can hover over nodes)
11. User clicks Copy button on Python code block; code copied to clipboard
12. "Copied!" confirmation appears for 2 seconds

**Variations**:
- **Inline code**: Code snippet in middle of sentence renders as monospace with light background
- **Unsupported diagram**: ```graphql block appears; rendered as plain code block (not a renderer)
- **Escaped characters**: Angle brackets in code `<T>` render correctly without HTML breaking

**Edge Cases**:
- **Mermaid parse error**: Diagram syntax is invalid; fallback to code block with error message "Failed to render diagram"
- **LaTeX rendering slow**: Complex equation takes 1-2 seconds to render; shows plain "$..." while loading
- **Copy button interaction during streaming**: Code block still streaming; Copy button disabled, tooltip "Wait for code to finish"

---

## STORY-009: Workflow Template Trigger (Code Review)

**Type**: long  
**Topic**: Streaming Chat Interface  
**Persona**: Tech lead reviewing a pull request  
**Goal**: Invoke a structured code review workflow with custom prompt template

**Preconditions**:
- Chat linked to a workspace with uncommitted changes
- Code review workflow template configured (custom or default)
- File changes available: 3 files modified (main.ts, test.ts, schema.ts)
- Diff available from workspace diff API

**Steps**:
1. User sees command palette hint: "Type '/' for slash commands"
2. User types "/" in input; Command Palette opens showing available commands
3. Commands visible: "/review", "/pr-title", "/branch-name", "/browser", "..."
4. User clicks "/review" or types it
5. Input field auto-populates with "/review"
6. User presses Enter or clicks "Insert"
7. Placeholder message inserts showing "Running code review workflow..."
8. System fetches workspace diff + changed files
9. A message builds automatically with:
   - System prompt from workflow template (custom review instructions)
   - List of changed files: "main.ts, test.ts, schema.ts"
   - Full unified diff pasted below
10. Message sends as a special "workflow" message (highlighted border)
11. Assistant response streams with structured review:
    - Summary paragraph
    - "High-risk issues" section with bullet points
    - "Suggestions" section
    - "Tests to add" section
12. Each section appears progressively as response streams
13. User reads review and appreciates the structured format (came from template)

**Variations**:
- **Custom template**: User has custom review prompt; uses that instead of default
- **PR template**: User types "/pr-title"; generates PR title + description for the diff
- **Branch naming**: User types "/branch-name"; suggests kebab-case branch name
- **Browser workflow**: User types "/browser"; template for browser testing inserted

**Edge Cases**:
- **Diff too large**: Workspace diff exceeds 100KB; system truncates and warns "Diff too large (showing first 50K). Full diff available in workspace."
- **No changes**: User runs "/review" on workspace with no uncommitted changes; error "No changes to review. Make changes first or use a different workspace."
- **Template not found**: Custom template file deleted; falls back to default with warning banner

---

## STORY-010: Rewind Dialog and Checkpoint Timeline

**Type**: long  
**Topic**: Streaming Chat Interface  
**Persona**: Iterative developer  
**Goal**: Go back to an earlier point in the conversation and branch off a different path

**Preconditions**:
- Session with 8 messages (4 turns: user ask → assistant answer, repeated)
2. Messages visible in list with timestamps: "2:14 PM", "2:18 PM", "2:22 PM", "2:31 PM"
3. Checkpoints created at turns 2 and 3 (auto-checkpointed)

**Steps**:
1. User realizes Turn 3's response was incorrect; wants to try a different prompt at Turn 2
2. User hovers over message #3 (assistant response to "Optimize the query")
3. "Rewind to before this" button appears on message hover
4. User clicks it
5. Rewind Dialog opens (modal overlay)
6. Dialog shows "Rewind Confirmation" + preview of what would be kept:
   - "Keeping: Messages up to turn 2 (your 'Write a function...' question)"
   - Turn 3 (incorrect response) will be deleted
7. Input field at bottom says "I want to try a different approach. Here's a new idea..."
8. User edits input to: "Actually, let me try using a Redis cache instead"
9. User clicks "Rewind & Continue" button
10. Dialog closes
11. Message list updates: messages #3, #4, #5, #6 disappear
12. New message from user appears: "Actually, let me try using a Redis cache instead"
13. Assistant responds with new direction; full turn unfolds as normal

**Variations**:
- **Cancel rewind**: User clicks "Discard" button in dialog; dialog closes, nothing changes
- **Rewind to earlier**: User rewinds to Turn 1 (middle of conversation); preview shows many messages being dropped; warning appears "This will remove 6 messages"
- **Rewind without new input**: User rewinds but doesn't type a new message; just keeps the old input field state before the rewind target
- **Timeline visualization**: Checkpoint timeline at bottom shows visual timeline of turns with dots; user clicks a dot to set rewind target

**Edge Cases**:
- **Rewind during streaming**: Response is streaming; user clicks rewind; stream cancels, rewind proceeds
- **Last message only**: User tries to rewind the very last assistant message; dialog warns "You'll lose the most recent response. Continue?"
- **Rewind loss of artifacts**: Earlier message generated an artifact; rewind removes it; warning "This will also remove a generated artifact (Dashboard v2)"

---

## STORY-011: Thinking Block Expansion & Collapse Toggle

**Type**: short  
**Topic**: Streaming Chat Interface  
**Persona**: Curious researcher  
**Goal**: Peek at model reasoning without disrupting reading flow

**Preconditions**:
- Message with "Max" effort sent
- Response includes multi-paragraph reasoning
- Thinking block is collapsed by default
- Show Thinking toggle is ON in settings

**Steps**:
1. User reads assistant response: "Here's my analysis of the proposed architecture..."
2. User notices a Thinking block below the first paragraph (collapsed)
3. Block shows: "Thinking... (3.2s)" with a Brain icon and collapse arrow (▶)
4. User clicks arrow to expand
5. Thinking block opens, showing model's reasoning: "Let me consider the trade-offs. Option A is simpler but less flexible. Option B handles edge cases better..."
6. Block expands to show full thinking (up to 500 chars visible; scrollable if longer)
7. User reads thinking while rest of response is visible
8. User clicks arrow again to collapse
9. Block folds back to "Thinking... (3.2s)" compact state
10. Rest of chat remains unaffected

**Variations**:
- **Keyboard toggle**: User presses Cmd+T (shortcut) to toggle all thinking blocks at once
- **Auto-expand on hover**: Thinking block expands on hover, collapses when mouse leaves
- **Disable thinking**: User's "Show Thinking" setting is OFF; no thinking block ever appears (but token count still shown)

**Edge Cases**:
- **Very long thinking (50KB)**: Thinking block scrolls internally; shows "...truncated for performance"
- **Thinking appeared late**: Thinking streams in 5 seconds after response finishes; block appears mid-scroll with "(Still thinking...)" and updates as it streams
- **Scroll position lost**: User scrolls chat to read thinking; collapses block; scroll position resets to top (or smoothly transitions?)

---

## STORY-012: Permission Dialog & Risky Tool Execution

**Type**: long  
**Topic**: Streaming Chat Interface  
**Persona**: Safety-conscious engineer  
**Goal**: Understand what the assistant wants to do and approve risky actions

**Preconditions**:
- Message asking: "Please run a database migration"
- Permission mode: "default" (requires approval for medium/high-risk tools)
- MCP tools configured: bash, file edit, git operations

**Steps**:
1. User sends: "Run the migration script in scripts/migrate.sh"
2. Assistant response begins streaming: "I'll execute the migration..."
3. Tool block appears: "Bash: ./scripts/migrate.sh" (status: pending approval)
4. Permission Dialog modal opens (overlay blocking further input)
5. Dialog title: "Risky Action Requires Approval"
6. Dialog shows:
   - Tool: "Bash"
   - Risk Level: "High" (badge in red)
   - Action: "Execute './scripts/migrate.sh'"
   - Description: "This script will modify the database schema in production"
   - Buttons: "Approve Once" | "Always Allow" | "Deny"
7. User reads and considers; clicks "Approve Once"
8. Dialog closes; permission granted for this single tool call
9. Tool block immediately transitions to "running" state with spinner
10. Tool executes and output streams: "Migration 001_add_users_table.sql..."
11. Tool completes with checkmark (green)
12. Assistant continues: "Migration completed. 5 new tables created..."
13. Response finishes normally

**Variations**:
- **Deny action**: User clicks "Deny"; tool blocked, assistant sees error and responds with alternate approach
- **Always Allow**: User clicks "Always Allow" for Bash; all future Bash tools in session auto-approve (no dialog)
- **Different risk level**: Tool is "Low" risk (read a file); permission dialog still appears but marked yellow "Low Risk" with faster auto-approval in some modes

**Edge Cases**:
- **Multiple tools in queue**: Assistant wants to run 3 Bash commands in sequence; first requires approval; user approves once; second & third also require dialogs
- **Permission mode override**: User has "bypassPermissions" mode enabled globally; no dialog appears, tool runs immediately
- **Unsure user timeout**: Dialog stays open for 5 minutes; if no action, request times out with error "Permission request expired"
- **Scope selection**: Dialog offers "Approve for this session only" vs "Always approve Bash in this session" vs "Always approve globally"

---
