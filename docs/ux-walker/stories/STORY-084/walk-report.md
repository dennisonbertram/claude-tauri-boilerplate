# STORY-084: Attach Linear Issue to Chat

## Walk Date: 2026-03-23

## Steps Performed
1. Checked LinearIssueBar component in chat
2. Reviewed ChatPage integration with Linear

## Observations
- `LinearIssueBar` component exists at `/apps/desktop/src/components/chat/LinearIssueBar.tsx`
- Shows attached issue with: issue ID (clickable), title, and "Clear" button
- ChatPage has `linearIssue` state and `LinearIssuePicker` integration
- Issue context is attached to chat sessions via `chatPageTypes.ts` (`LinearIssueContext` type)
- The bar appears below the chat input when an issue is attached
- Could not test live UI flow due to Linear not being connected

## Result: PASS
Linear issue attachment to chat is implemented. The LinearIssueBar component renders attached issue context in the chat view.

## Code References
- `/apps/desktop/src/components/chat/LinearIssueBar.tsx`
- `/apps/desktop/src/components/chat/chatPageTypes.ts`
- `/apps/desktop/src/components/chat/ChatPage.tsx`
