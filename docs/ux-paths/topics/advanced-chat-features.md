# UX Stories: Advanced Chat Features

Topic: Advanced Chat Features  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: Review Cost Breakdown During Session

**Type**: short
**Topic**: Advanced Chat Features
**Persona**: Data scientist monitoring API spend
**Goal**: Understand total cost and per-message breakdown before session ends
**Preconditions**: Session has 3+ messages with costs tracked

### Steps
1. Open any chat session with active message history → messages appear with costs recorded
2. Click cost badge in status bar (shows "$0.47") → expandable panel opens above status bar
3. Panel shows session total and table: Message #1 (Claude 3.5 Sonnet: $0.12, In: 245 tokens, Out: 89 tokens)
4. Hover over input tokens row → see cache read/write tokens if applicable
5. Scroll through list to find most expensive message → Message #3 ($0.18 due to 512 output tokens)
6. Click away or click badge again → panel collapses

### Variations
- **Cached messages**: Row shows "Cache R: 1200" and reduced cost ($0.01) instead of full input cost
- **Multiple models**: Panel shows "Opus", "Sonnet", "Haiku" labels for different model messages
- **No costs**: If session has no billing data yet, cost badge doesn't render

### Edge Cases
- **Zero-cost session**: Badge hidden entirely (no tokens yet)
- **Very long list**: Max 6 rows visible, scrollable overflow with 60px max-height
- **Large numbers**: Tokens formatted as "2,456,789" (localeString)
## STORY-002: Rewind Conversation to Earlier Checkpoint

**Type**: medium
**Topic**: Advanced Chat Features
**Persona**: Developer trying different approaches in code review
**Goal**: Reset conversation to Turn 5 while optionally keeping current code changes
**Preconditions**: Session has 8+ turns with file changes at multiple checkpoints

### Steps
1. Scroll down to checkpoint timeline section (collapsed by default) → see "Checkpoints 8" badge
2. Click timeline toggle → expands to show Turn 1-8 vertically, each with "Modified 3 files, Deleted 1 file"
3. Hover over Turn 5 entry → see prompt preview "Review the PR..." and timestamp "2:34 PM"
4. Click "Rewind" link on Turn 5 → RewindDialog opens, shows 3 radio options
5. Default selected: "Code & Conversation (restore both)" → click "Rewind" button
6. Dialog closes, spinner appears briefly, conversation rolls back to Turn 5 state
7. Chat area shows only first 5 turns, code workspace reflects Turn 5 file state

### Variations
- **Conversation-only rewind**: Select radio "Conversation only" → keeps current code, removes messages 6-8
- **Code-only rewind**: Select radio "Code only" → conversation stays same, workspace reverts to Turn 5
- **Preview mode**: If preview available, dialog shows "3 files affected, 2 messages removed" before confirming
- **With feedback**: User types "Try different approach" in approval field before rewind → feedback logged

### Edge Cases
- **No preview loaded**: "Loading preview..." spinner visible until ready
- **Last checkpoint selected**: "View changes" button appears (compares Turn 7 to Turn 8 with git refs)
- **Single checkpoint**: Timeline renders only one item, rewind button still enabled
- **Rewind warning**: Yellow banner "This action cannot be undone" visible on dialog
## STORY-003: Monitor Active Subagent Execution

**Type**: medium
**Topic**: Advanced Chat Features
**Persona**: AI researcher observing multi-agent task decomposition
**Goal**: Track 3 parallel agents and 2 child tasks in real-time status tree
**Preconditions**: Agent task spawned with subprocess delegation (plan mode in review state)

### Steps
1. In plan review, click "Approve" → Chat sends to Claude, agents start
2. Subagent panel in message list toggles visible (blue "Agents 3" badge)
3. Panel shows tree:
   - Main: "Analyze code structure" [blue dot, running] "2m 34s"
   - Child 1: "Extract patterns" [blue dot, running, progress: "Scanning imports..."]
   - Child 2: "Generate diff" [yellow dot, stopped, summary: "No changes needed"]
4. Main task completes (green dot) → Child 3 spawned
5. Expand/collapse Main agent → hide/show child tree (default expanded)
6. Click elsewhere to collapse panel → badge still shows active count, can re-open

### Variations
- **Nested agents**: Child agent spawns own children (3+ levels deep, each indented)
- **Failed agent**: Red dot "failed" with summary "FileNotFoundError: src/utils/parse.ts"
- **Idle status**: Waiting for approval shows "awaiting" status (gray dot)
- **Agent without children**: Toggle button hidden, no indent

### Edge Cases
- **No agents running**: Panel shows "No active agents" placeholder when empty
- **Rapid spawning**: Badge updates in real-time (e.g., "Agents 5" → "Agents 6")
- **Completed session**: Panel can be toggled but shows empty once all agents finish
- **Tree with 8+ items**: Scroll with max-height 192px, preserves expansion state while scrolling
## STORY-004: Accept Suggestion Chip for Next Action

**Type**: short
**Topic**: Advanced Chat Features
**Persona**: Product manager using AI to brainstorm features
**Goal**: Quickly jump to suggested next question without retyping
**Preconditions**: Claude response ends with 2-3 suggestion chips (generated by model)

### Steps
1. Claude responds "Here are three directions we could go..."
2. Below input box, see 3 chips: "Tell me more about the UX", "Sketch wireframe", "Cost estimation"
3. Hover over first chip → chip background darkens, x-button highlights
4. Click first chip → text "Tell me more about the UX" fills input box
5. Input textarea shows full suggestion, ready to edit or submit
6. Press Enter or click Send → message submitted with suggestion text

### Variations
- **Ghost text**: Before clicking, ghost text "Tell me more..." appears faded in input (accepts with Tab/ArrowRight)
- **Dismiss**: Click X on chip → chip disappears without filling input
- **Keyboard**: Arrow keys to navigate chips, Enter to select (when one is focused)
- **All dismissed**: Last chip dismissed → empty state "No suggestions available"

### Edge Cases
- **Suggestion > 100 chars**: Chip truncates with ellipsis, full text in title attribute
- **Empty input + chip click**: Input autofocuses, receives full suggestion
- **Multi-line suggestion**: Suggestion with newlines preserved in textarea (rare but supported)
## STORY-005: Review Thinking Process Before Approval

**Type**: short
**Topic**: Advanced Chat Features
**Persona**: Safety researcher validating AI reasoning chain
**Goal**: Read and expand thinking block to verify multi-step reasoning before approving
**Preconditions**: Plan mode review state with thinking budget enabled (e.g., 10,000 tokens)

### Steps
1. In plan review, Claude response shows collapsible "Thinking..." block (collapsed by default)
2. Click block header → expands to reveal 8 paragraphs of internal reasoning (italicized, muted color)
3. Read reasoning: "First, let's identify the core issue... Then, we can consider three approaches..."
4. Scroll within thinking block (max-height 384px overflow)
5. Duration shown in header: "Thinking (2.4s)" → indicates time spent reasoning
6. Close block (click header again) → collapses for cleaner review view
7. Click "Approve" → plan approved knowing reasoning chain

### Variations
- **No thinking**: If thinking disabled, block doesn't render
- **Large thinking**: 5000+ token thoughts are scrollable, header stays visible
- **Short thinking**: "Thinking (0.3s)" fits in one paragraph, still collapsible

### Edge Cases
- **Thinking-only response**: If response is ONLY thinking with no action text, block shows all content
- **Copy button**: Long thinking text can be selected and copied manually
## STORY-006: Pin Context Summary Under Input

**Type**: short
**Topic**: Advanced Chat Features
**Persona**: Manager keeping track of discussion thread across many turns
**Goal**: Glance at AI-generated one-line summary of session topic
**Preconditions**: Session with 2+ user messages and model-generated context summary

### Steps
1. Open chat session with existing conversation
2. Below ChatInput, small italicized text appears: "Discussing performance optimization strategy for React components"
3. Context summary updates after each exchange (refreshed by Haiku model)
4. Hover over summary → tooltip shows full text if truncated
5. User can collapse input area → summary still visible at 40% opacity
6. Summary disappears if session cleared or new session created

### Variations
- **No summary yet**: Placeholder doesn't render on first turn
- **Custom summary**: In session settings, user can override auto-generated summary

### Edge Cases
- **Very long summary**: Truncated with ellipsis, max 120 characters displayed
- **Null summary**: If API fails, gracefully doesn't render
## STORY-007: Monitor Token Usage While Typing

**Type**: short
**Topic**: Advanced Chat Features
**Persona**: API cost monitor with tight budget
**Goal**: See context window usage in real-time meter before sending message
**Preconditions**: Session is active with context window limit of 200,000 tokens

### Steps
1. Open chat with active conversation showing 45,000 input + 8,000 output tokens used
2. In status bar, see ContextIndicator: horizontal meter 26% filled (green) + "26%"
3. Hover over indicator → tooltip shows breakdown: "Input: 45,000 | Output: 8,000 | Cache Read: 0 | Cache Write: 0 | Total: 53,000 / 200,000"
4. Type new 1000-token message → meter updates to 27%
5. At 80% usage, meter turns yellow and pulses animation
6. At 95%+ usage, meter turns red + pulses faster

### Variations
- **Cache tokens**: Tooltip shows "Cache Read: 12,000 | Cache Write: 5,000" when context compacting happens
- **Compacting indicator**: Status shows "Compacting..." instead of percentage during compression
- **No max tokens**: If unbounded, percentage doesn't update

### Edge Cases
- **Usage = 0**: Meter shows 0%, doesn't render tooltip until hover
- **Mobile view**: Meter scales down to 48px wide
## STORY-008: Expand and Collapse Approved Plan

**Type**: short
**Topic**: Advanced Chat Features
**Persona**: Engineer reviewing AI-generated plan for code refactor
**Goal**: See approved plan summary collapsed, expand to re-read full details if needed
**Preconditions**: Plan mode workflow completed and approved

### Steps
1. User approves plan → status changes from "Review Plan" (purple) to "Plan Approved" (green checkmark)
2. Plan content collapses by default (shows only header with "Approved" indicator)
3. Click expand arrow on header → plan text unfolds: "Step 1: Extract utility functions... Step 2: Update imports..."
4. Read full plan
5. Click collapse arrow → plan folds again, preserves scroll position for later

### Variations
- **Rejected plan**: Shows "Plan Rejected" (red X), still collapsible
- **Active plan**: During planning, not collapsible (always expanded)

### Edge Cases
- **Very long plan**: Content scrollable within max-height 384px when expanded
- **No arrow shown**: If plan is in review state, no toggle (always expanded during review)
## STORY-009: View Latest Turn File Changes in Diff

**Type**: medium
**Topic**: Advanced Chat Features
**Persona**: Code reviewer comparing Turn 7 vs Turn 8 file modifications
**Goal**: See git diff between last two checkpoints to understand what changed in latest turn
**Preconditions**: Session has 8+ checkpoints with git commits on last 2 checkpoints

### Steps
1. In checkpoint timeline, Turn 8 (latest) shows "View changes" link next to "Rewind"
2. Click "View changes" → LatestTurnChangesDialog opens (dark modal)
3. Dialog shows:
   - "Comparing Turn 7 to Turn 8"
   - File list: "src/components/Button.tsx (modified)", "src/utils/helpers.ts (created)"
4. Click file → embedded diff viewer shows side-by-side or unified diff
5. Read changes: added 15 lines to Button.tsx (syntax highlighted)
6. Close dialog → dismissed

### Variations
- **Only one checkpoint**: No "View changes" link (need at least 2)
- **No git commits**: Button disabled or hidden if gitCommit field is null

### Edge Cases
- **Large diff**: Diff viewer scrollable with syntax highlighting
- **Binary file**: Shows "[Binary file]" placeholder instead of diff
- **Deleted file**: Shows full original content marked as red deletions
## STORY-010: Provide Feedback While Approving Plan

**Type**: short
**Topic**: Advanced Chat Features
**Persona**: Manager approving AI plan with optional guidance
**Goal**: Approve plan and add coaching note for AI on next steps
**Preconditions**: Plan in review state, multiple approval options visible

### Steps
1. See plan review with 4 action buttons: "Provide Input", "Reject", "Approve with Feedback", "Approve"
2. Click "Approve with Feedback" → text input appears with placeholder "Approval notes (optional)"
3. Type: "Good plan. Focus especially on error handling edge cases in the validation module."
4. Press Enter or click "Approve with feedback" button → approval sent with feedback text
5. Plan marked approved (green checkmark), feedback logged as metadata

### Variations
- **Reject with feedback**: Click "Reject" → placeholder changes to "Feedback for changes"
- **Provide input**: Click "Provide Input" → input shows "Answer Claude or provide clarifying input"
- **No feedback**: Click "Approve" (direct button) → no input field, immediate approval

### Edge Cases
- **Escape key**: Cancels input mode, clears text, returns to action buttons
- **Empty feedback**: Can still submit approval with blank feedback field
- **Very long feedback**: Textarea allows up to 500 chars (no hard limit in UI)
---
