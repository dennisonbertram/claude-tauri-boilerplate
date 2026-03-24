# UX Walk Report: Streaming Chat Interface (STORY-016 to STORY-027)

**Date:** 2026-03-23
**App URL:** http://localhost:1927 (server at http://localhost:3846)
**Session:** ux-walker-localhost
**Known Issue:** Opening existing conversations crashes the app. Several stories could only be verified via source code inspection.

## Summary Table

| Story | Title | Status | Severity | Key Finding |
|-------|-------|--------|----------|-------------|
| STORY-016 | First Message with Image Attachment | PASS | none | Attach button (+) exists with full image/file support including drag-drop, paste, thumbnails |
| STORY-017 | Effort Picker Flow with Thinking Budget Trade-off | PARTIAL | medium | EffortSelector component exists but is NOT in chat UI -- only in Settings/Agent Profiles |
| STORY-018 | Real-time Tool Visualization with Elapsed Time | PASS | none | ToolCallBlock shows status icons, elapsed time, expandable I/O. Rich renderers for 10+ tool types |
| STORY-019 | Model & Effort Selector with Fast Mode Toggle | PARTIAL | medium | Model selector works (status bar + chat input). No Fast Mode toggle exists anywhere |
| STORY-020 | Suggestion Chips After Empty Assistant Message | PASS | none | SuggestionChips component with click/dismiss. Template cards on empty chat serve similar purpose |
| STORY-021 | Cost Tracking with Expandable Breakdown | PASS | none | CostDisplay badge expands to per-message breakdown. CostSegment in status bar |
| STORY-022 | Context Indicator Nearing Limit | PASS | none | Color-coded progress bar (green/yellow/red), pulse at 80%+, hover details, compaction indicator |
| STORY-023 | Markdown with Code, LaTeX, and Mermaid Rendering | PASS | none | Full support: GFM, KaTeX, syntax highlighting, Mermaid with dark/light theme + fullscreen pan/zoom |
| STORY-024 | Workflow Template Trigger (Code Review) | PASS | none | 3 template cards on new chat. WorkflowsTab for custom workflows. CodeReviewDialog for workspace reviews |
| STORY-025 | Rewind Dialog and Checkpoint Timeline | PASS | none | RewindDialog with 3 modes. CheckpointTimeline with visual timeline, file change summaries, rewind buttons |
| STORY-026 | Thinking Block Expansion & Collapse Toggle | PASS | none | ThinkingBlock with Brain icon, duration, caret toggle, italic text with scroll |
| STORY-027 | Permission Dialog & Risky Tool Execution | PASS | none | Risk-colored dialogs (blue/yellow/red), 3 decision types, 4 permission modes in status bar |

## Totals

- **PASS:** 10
- **PARTIAL:** 2
- **FAIL:** 0
- **BLOCKED (visual only):** 7 stories had visual verification blocked by the conversation crash issue but passed code inspection

## Findings Summary

### Actionable Issues (2)

1. **STORY-017 / STORY-019 -- Effort selector not accessible from chat UI**
   - The `EffortSelector` component (Low/Medium/High/Max) exists in `apps/desktop/src/components/ui/EffortSelector.tsx` with good descriptions
   - However, it only appears in Settings > Model tab, Agent Profile > Model tab, and Workflows tab
   - Users cannot change effort/thinking level from the chat compose view without navigating to settings
   - The "Normal" button in the status bar is the Permission Mode selector, not effort -- this may confuse users

2. **STORY-019 -- No Fast Mode toggle**
   - No "Fast Mode" toggle was found anywhere in the codebase
   - The model selector does support quick switching (number keys when dropdown is open) which partially addresses speed needs

### Observations

- The new chat screen has a clean layout with heading "What would you like to build?", 3 template cards, model selector, project selector, and attach/command buttons
- Chat input toolbar has a Plus (+) icon for file attachment and a "/" button for command palette -- both are small and could benefit from tooltips/labels for discoverability
- The status bar is information-dense with model, permission mode, git branch, connection status, turn timer, active tool, agent count, resource usage, context usage, and cost segments
- Mode tabs (Chat/Code/Cowork) provide distinct interaction paradigms

## Component Map

| Feature | Primary Component | Location |
|---------|------------------|----------|
| Image Attachment | ChatInput + ChatInputToolbar | `apps/desktop/src/components/chat/ChatInput.tsx`, `chat-input/ChatInputToolbar.tsx` |
| Effort Selector | EffortSelector | `apps/desktop/src/components/ui/EffortSelector.tsx` |
| Tool Visualization | ToolCallBlock + gen-ui renderers | `apps/desktop/src/components/chat/ToolCallBlock.tsx` |
| Model Selector | ModelSegment | `apps/desktop/src/components/status-bar/ModelSegment.tsx` |
| Suggestion Chips | SuggestionChips | `apps/desktop/src/components/chat/SuggestionChips.tsx` |
| Cost Tracking | CostDisplay + CostSegment | `apps/desktop/src/components/chat/CostDisplay.tsx` |
| Context Indicator | ContextIndicator + ContextUsageSegment | `apps/desktop/src/components/chat/ContextIndicator.tsx` |
| Markdown Rendering | MarkdownRenderer + MermaidDiagram | `apps/desktop/src/components/chat/MarkdownRenderer.tsx` |
| Workflow Templates | WorkflowsTab + workflowPromptDefaults | `apps/desktop/src/components/settings/WorkflowsTab.tsx` |
| Rewind/Checkpoint | RewindDialog + CheckpointTimeline | `apps/desktop/src/components/chat/RewindDialog.tsx` |
| Thinking Blocks | ThinkingBlock | `apps/desktop/src/components/chat/ThinkingBlock.tsx` |
| Permission Dialog | PermissionDialog + PermissionModeSegment | `apps/desktop/src/components/chat/PermissionDialog.tsx` |
