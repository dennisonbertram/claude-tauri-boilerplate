# Chat Features: STORY-137, 140, 141, 143

## STORY-137: Cost Breakdown During Session

**What was done**: Added a clickable cost indicator pill in the `ChatInputToolbar` next to the model name. Shows `$0.0342` format using `sessionTotalCost` from `useChatPageState`. Clicking opens the existing `CostDialog` modal with per-message breakdown. Only visible when cost > 0.

**Files changed**:
- `apps/desktop/src/components/chat/chat-input/ChatInputToolbar.tsx` - Added `sessionTotalCost` and `onCostClick` props; rendered cost pill with `CurrencyDollar` icon
- `apps/desktop/src/components/chat/chat-input/types.ts` - Added `sessionTotalCost` and `onCostClick` to `ChatInputProps`
- `apps/desktop/src/components/chat/ChatInput.tsx` - Pass-through of new props to toolbar
- `apps/desktop/src/components/chat/ChatPage.tsx` - Wired `sessionTotalCost` and `setCostOpen` to ChatInput

## STORY-140: Suggestion Chips After Assistant Messages

**What was done**: Verified already wired. `SuggestionChips` renders in `ChatPage.tsx` when `suggestions.length > 0 && !isLoading`. The `handleSuggestionChipSelect` handler inserts the selected chip text into the chat input. The `useSuggestions` hook generates suggestions from the message history.

**Files changed**: None (already working)

## STORY-141: Thinking Block Expansion & Collapse

**What was done**: Verified already wired. `ThinkingBlock` component renders during streaming via `MessageList` with expand/collapse toggle (caret icon). `thinkingExpanded` and `thinkingToggleVersion` from `useChatPageState` control the global default expanded state. Global toggle bound to `Ctrl+Shift+T` keyboard shortcut in `chatPageHandlers`.

**Files changed**: None (already working)

## STORY-143: Token Usage While Typing

**What was done**: Added a token estimate row below the chat input form showing:
- Draft token estimate using `chars / 4` heuristic (e.g., "~125 tokens in draft")
- Context window usage from real cumulative usage data (e.g., "12.5k / 200.0k context")

Uses `contextUsage` from `useChatPageState` which tracks actual `inputTokens`, `outputTokens`, and `maxTokens` (200k).

**Files changed**:
- `apps/desktop/src/components/chat/chat-input/types.ts` - Added `contextUsage` to `ChatInputProps`
- `apps/desktop/src/components/chat/ChatInput.tsx` - Added token estimate row with `formatTokenEstimate` helper
- `apps/desktop/src/components/chat/ChatPage.tsx` - Wired `contextUsage` to ChatInput

## Issues / Follow-up

- Pre-existing TypeScript errors in test files are unrelated to these changes
- Thinking blocks only render during active streaming; once a turn completes, the thinking content is not persisted in the message bubble (by design -- ephemeral streaming state)
- Cost indicator uses 4 decimal places; could be adjusted based on UX feedback
