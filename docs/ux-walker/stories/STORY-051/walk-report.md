# STORY-051: Profile Selector in Chat

## Status: FAIL

## Steps Performed
1. Navigated to New Chat view
2. Searched for profile selector in chat input area
3. Examined all buttons near chat input: "Select project", model selector "Sonnet 4.6", and several unlabeled icon buttons
4. Clicked unlabeled buttons (e126, e127) to check if any open a profile picker
5. No profile selector found anywhere in the chat creation flow

## Observations
- The New Chat view has: textbox, Select project button, model selector, and some icon buttons
- No visible profile selector or dropdown to choose an agent profile when starting a new chat
- Profiles can be managed in the Agent Profiles section but cannot be applied to new conversations from the chat view
- This is a missing feature -- there is no way to select a profile when creating a new chat

## Findings
- F-051-001: HIGH -- No profile selector available in new chat view; users cannot select an agent profile when starting a conversation
