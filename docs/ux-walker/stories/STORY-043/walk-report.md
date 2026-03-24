# STORY-043: Create New Agent Profile

## Status: PASS (with minor issue on first attempt)

## Steps Performed
1. Navigated to Agent Profiles via sidebar navigation button
2. Observed Agent Profiles page with existing profile "Code Review Bot Changed Again" and "New agent profile" (+) button
3. Clicked "New agent profile" button
4. First attempt: navigated away to New Chat view (bug) -- but second attempt after re-navigation worked correctly
5. New profile appeared in sidebar as "New Agent Profile" with full editing form (General tab selected by default)
6. All 8 tabs visible: General, Prompt, Model, Tools, Automations, Integrations, Sandbox, Advanced
7. Save button starts disabled, becomes enabled after changes
8. Successfully saved profile with custom name and description

## Observations
- The "New agent profile" button behavior is inconsistent -- on the first click from the Agent Profiles page, it sometimes navigates to New Chat instead of creating a new profile
- On subsequent attempts, it correctly creates a new profile entry in the sidebar and shows the editing form
- New profiles get default values: name "New Agent Profile", empty description, empty icon, color #6b7280
- Delete button is present on new profiles immediately (before first save)

## Findings
- F-043-001: MEDIUM -- "New agent profile" button sometimes navigates to new chat instead of creating profile (intermittent)
