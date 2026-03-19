# User Path Testing Stories

Generated: 2026-03-18
Status: In progress — paths are walked in order, bugs filed and fixed as found.

Each path represents a realistic user journey with 10+ steps. Tests are run using
the Chrome browser automation tool against `http://localhost:1420`.

---

## Path 1: The user wants to start their first conversation and get a coding answer

1. User opens the app and sees the welcome screen ("Claude Code")
2. User clicks "New Conversation" button in the center
3. A new session is created and the chat input is focused
4. User types "How do I reverse a string in Python?" and presses Enter
5. User sees their message bubble appear immediately
6. User watches Claude stream a response with a code block
7. User hovers over the code block and sees a "Copy" button
8. User clicks "Copy" and the code is copied to clipboard
9. User sends a follow-up: "Now show me how to do it in JavaScript"
10. Claude responds with a JS version
11. User sees both responses are still visible (conversation history intact)
12. User checks the status bar at the bottom for token count
13. User closes and re-opens the same session — messages should still be there

---

## Path 2: The user wants to find an old conversation by searching

1. User opens the app with many existing sessions in the sidebar
2. User clicks the "Search sessions" input in the sidebar
3. User types part of a session name (e.g., "kimchi")
4. The session list filters to show only matching sessions
5. User clears the search and sees full list returns
6. User types a word that matches no sessions
7. User sees an empty state ("No sessions found" or similar)
8. User clears search again
9. User scrolls the session list to find older sessions
10. User clicks a session from a different date
11. Chat area loads (or shows "Start a conversation" if empty)
12. User verifies the selected session is highlighted in the sidebar

---

## Path 3: The user wants to rename a session to something meaningful

1. User has a session with an auto-generated name (e.g., "Sparkly Churro")
2. User hovers over the session in the sidebar — sees the "..." (more) button
3. User clicks "..." to open the context menu
4. User clicks "Rename"
5. An inline input or dialog appears with the current name
6. User clears the current name and types "Python string helpers"
7. User presses Enter or clicks Save
8. The sidebar shows the new name immediately
9. User clicks away and back — the new name persists
10. User tries to rename to an empty string — should be rejected or revert
11. User renames again to "My Python Notes"
12. User refreshes the page — the new name is still there

---

## Path 4: The user wants to delete a session they no longer need

1. User has multiple sessions in the sidebar
2. User hovers over a session and clicks "..."
3. User selects "Delete" from the context menu
4. A confirmation dialog appears ("Are you sure?")
5. User clicks "Cancel" — session is NOT deleted, still in sidebar
6. User opens the context menu again and selects "Delete"
7. User clicks "Confirm" or "Delete"
8. The session disappears from the sidebar
9. If that was the active session, the chat area shows the welcome screen
10. User verifies the deleted session does not reappear on refresh
11. User tries deleting all sessions — sidebar should show empty state
12. User creates a new chat — sidebar shows the new session

---

## Path 5: The user wants to use a slash command to change the model

1. User is in an active chat session
2. User clicks the chat input
3. User types "/" — a command palette popup appears
4. User sees available slash commands listed
5. User types "/model" — the palette filters to show model command
6. User presses Enter or clicks "/model"
7. A model picker UI appears (dropdown or dialog)
8. User sees available models listed
9. User selects a different model (e.g., switches from Haiku to Sonnet)
10. The status bar at the bottom updates to show the new model
11. User sends a message — response comes from the new model
12. User types "/model" again and switches back to original model

---

## Path 6: The user wants to export a session as Markdown

1. User has a session with several messages
2. User hovers over the session in sidebar, clicks "..."
3. User selects "Export" from the context menu
4. An export dialog or options appear
5. User selects "Markdown" format
6. User clicks Export/Download
7. A file download is triggered (or file is saved to disk)
8. User opens the exported file — it contains all messages in readable format
9. User also tries "Export as JSON" option
10. JSON file contains structured message data
11. User verifies the session still exists in the app after export (export is non-destructive)
12. User refreshes — session is intact

---

## Path 7: The user wants to fork a conversation to explore a different approach

1. User has a multi-turn conversation (5+ messages)
2. User finds a point in the conversation where they want to branch
3. User hovers over an assistant message — sees a "Fork" button or option
4. User clicks "Fork"
5. A new session is created in the sidebar (named something like "original-name (fork)")
6. The forked session contains messages up to the fork point
7. User is now in the forked session
8. User sends a new message taking a different direction
9. Original session is untouched in the sidebar
10. User switches between original and forked session
11. Both sessions maintain their independent conversation history
12. User verifies both sessions appear in sidebar and can be navigated

---

## Path 8: The user wants to view and change settings (theme, model, notifications)

1. User clicks the gear icon (⚙) in the top-left user area
2. Settings panel slides in from the right
3. User clicks the "Appearance" tab
4. User changes the theme from Dark to Light (or vice versa)
5. The UI updates immediately to reflect the new theme
6. User clicks the "Model" tab
7. User changes the default model
8. User clicks "Notifications" tab
9. User toggles notification sound on/off
10. User clicks "Advanced" tab
11. User sees the privacy mode toggle — toggles it on then off
12. User closes settings (X button or Escape)
13. User reopens settings — their changes are preserved

---

## Path 9: The user wants to attach a file to their message

1. User is in a chat session
2. User clicks the "Attach" button next to the chat input
3. A file picker opens
4. User selects a text or code file from their filesystem
5. The file appears as an attachment chip in the input area
6. User can see the file name/type in the chip
7. User types a message: "Can you explain this file?" and sends
8. The message sends with the attachment
9. Claude responds referencing the file contents
10. User tries attaching an image file
11. The image appears as a preview in the message
12. User tries to attach and then remove the attachment (X on chip) before sending

---

## Path 10: The user wants to use the Workspaces tab to create a new workspace

1. User clicks the "Workspaces" tab in the top nav
2. User sees the project list in the sidebar
3. User sees an existing project (or clicks "+ Add Project")
4. If adding: User navigates to a local git repo path and confirms
5. User clicks the project in the sidebar to expand it
6. User clicks "Create Workspace" or "+" within the project
7. A dialog appears asking for branch name and optionally base branch
8. User enters "feature/test-workspace" as the branch name
9. User clicks Create
10. The new workspace appears in the project's workspace list
11. User clicks the workspace — sees Chat/Diff/Paths/Notes tabs
12. User clicks the "Chat" tab and sends a message in workspace context
13. User clicks the "Notes" tab and types a note

---

## Path 11: The user wants to use the Teams view to create a new agent team

1. User clicks "Teams" tab in top nav
2. User sees "No teams yet" empty state
3. User clicks "New Team" button (top right)
4. A dialog or form appears
5. User enters a team name and description
6. User clicks Create
7. The new team appears in the Teams view
8. User clicks the team to open it
9. User sees the team workspace with task board and message flow
10. User can see subagent status panel
11. User clicks "Shutdown Team" or delete button
12. A confirmation dialog appears
13. User confirms — team is removed from the list

---

## Path 12: The user wants to rewind a conversation and try again

1. User has a multi-turn conversation
2. User sees an assistant response they don't like
3. User looks for a "Rewind" or "Retry" option on a message
4. User clicks the rewind option on an earlier message
5. A rewind dialog appears with options (truncate/retry)
6. User selects their preferred rewind mode
7. User confirms the rewind
8. The conversation is truncated to the selected point
9. Claude regenerates the response from that point
10. User sees the new response replacing the old one
11. User verifies earlier messages are still intact
12. User can continue the conversation from the new branch point

---

## Path 13: The user wants to use the /cost command to check spending

1. User has an active session with multiple turns
2. User clicks the chat input
3. User types "/cost" and presses Enter
4. A cost summary appears in the chat or as an overlay
5. User sees breakdown: input tokens, output tokens, cache tokens, total cost
6. User dismisses the overlay
7. User sends more messages to accumulate more cost
8. User runs "/cost" again — the totals have increased
9. User looks at the status bar — sees a cost indicator ($ amount)
10. User clicks the cost indicator in the status bar
11. A more detailed cost breakdown appears
12. User checks that the cost is reasonable for the work done

---

## Path 14: The user wants to search within a long conversation

1. User has a session with many messages (6+ to trigger TOC)
2. User scrolls through the conversation
3. User notices the Table of Contents panel appears at the top
4. User sees message entries in the TOC and clicks one to jump to it
5. User finds a search button/input
6. User types a keyword from a past message
7. The conversation scrolls to/highlights the matching message
8. User uses "Next" to navigate between multiple matches
9. User uses "Prev" to go back
10. User clears the search
11. User clicks "Export summary to new chat" button in TOC
12. A new session is created with the summary as context

---

## Path 15: The user wants to use /clear to reset context and start fresh

1. User is in a long session and wants to reset without losing the session
2. User types "/clear" in the chat input
3. A confirmation or immediate clear happens
4. The visible messages are cleared from the chat view
5. User sees the "Start a conversation" empty state
6. User sends a new message — it works as a fresh context
7. Claude responds without referencing the old conversation
8. User switches to another session and back
9. The cleared session still shows as "Start a conversation"
10. User verifies in the session list the session still exists (just cleared)
11. User tries to type "/restart" to see what it does
12. User compares the behavior of /clear vs /restart

---

## Path 16: The user wants to change permission mode and understand its effect

1. User is in a chat session
2. User looks at the status bar — sees current permission mode (e.g., "Normal")
3. User clicks the permission mode indicator in the status bar
4. A dropdown or dialog shows mode options: Normal, Auto, Strict
5. User selects "Auto" mode
6. The status bar updates to show "Auto"
7. User sends a message that would trigger tool use
8. The tool runs without asking for permission (auto-approve)
9. User switches back to "Normal" mode
10. User sends another tool-triggering message
11. A permission dialog appears asking to approve the tool
12. User approves — the tool runs
13. User denies — the tool is skipped, Claude adapts

---

## Path 17: The user wants to use MCP settings to view configured servers

1. User clicks the gear icon to open Settings
2. User navigates to the "MCP" tab
3. User sees a list of configured MCP servers (or empty state)
4. User looks for an "Add MCP Server" option
5. User clicks Add and sees a form (name, command, args)
6. User fills in details for a test MCP server
7. User saves the configuration
8. The server appears in the list
9. User clicks on the server entry to see its details
10. User looks for a "Test Connection" or status indicator
11. User deletes the test server
12. User confirms deletion — server removed from list
13. User closes settings

---

## Path 18: The user wants to write and send a multi-paragraph message

1. User opens a chat session
2. User clicks the chat input
3. User types a first paragraph
4. User presses Shift+Enter to add a newline (without sending)
5. User types a second paragraph
6. User presses Shift+Enter again for another line
7. User types a third paragraph
8. The input box has expanded to show multiple lines
9. User presses Enter to send — all three paragraphs sent as one message
10. Claude responds to the full multi-paragraph message
11. User verifies the message bubble shows all paragraphs correctly
12. User verifies Enter sends but Shift+Enter creates newlines

---

## Path 19: The user wants to use the status bar to switch models quickly

1. User opens a chat session
2. User looks at the status bar — sees model name (e.g., "Haiku 4.5")
3. User clicks the model name in the status bar
4. A model picker appears (dropdown or popover)
5. User sees a list of available models with descriptions/tiers
6. User selects "Sonnet" tier
7. The status bar updates to show "Sonnet"
8. User sends a message — response comes from the new model
9. User clicks model in status bar again
10. User sees the current model is highlighted/selected
11. User switches back to Haiku
12. User opens Settings > Model tab — verifies it matches what was selected

---

## Path 20: The user wants to create a new session using keyboard shortcuts

1. User is in an existing session
2. User presses Cmd+N (or the keyboard shortcut for new chat)
3. A new session is created and focused
4. User sees the "Start a conversation" welcome state
5. User presses Cmd+, to open Settings
6. Settings panel opens
7. User presses Escape — Settings closes
8. User presses Cmd+? to open keyboard shortcuts help
9. A help dialog/panel appears with all shortcuts listed
10. User presses Escape to close help
11. User types a message and presses Cmd+Enter (if that's the send shortcut)
12. Message is sent
13. User presses Cmd+L to clear the conversation
14. Chat is cleared
15. User presses Cmd+N again — new session created

---

## Test Execution Log

| Path | Status | Bugs Found | Fixed |
|------|--------|-----------|-------|
| 1 | ✅ Pass | — | — |
| 2 | ✅ Fixed | Search query param not forwarded to `listSessions` | Yes — route now passes `q` param; 3 regression tests added |
| 3 | ✅ Fixed | Rename Enter key propagated to session select after submit | Yes — stopPropagation added to Enter handler |
| 4 | ✅ Pass | — | — |
| 5 | ✅ Pass | — | — |
| 6 | ✅ Pass | — | — |
| 7 | ✅ Pass | — | — |
| 8 | ✅ Pass | — | — |
| 9 | ✅ Pass | — | — |
| 10 | ✅ Pass | — | — |
| 11 | ⚠️ Bug | "New Team" button off-screen — settings panel renders wider than viewport (1731px vs 1612px visible) | No — GitHub issue filed |
| 12 | ⚠️ Gap | Rewind/Checkpoint only works in workspace sessions with file-edit tool calls; not available in regular chat | No — feature gap, not a bug |
| 13 | ✅ Pass | — | — |
| 14 | ⚠️ Gap | TOC exists but no in-conversation keyword search and no "Export summary to new chat" button | No — feature gap |
| 15 | ✅ Pass | — | — |
| 16 | ✅ Pass | — | — |
| 17 | ✅ Pass | "+ Add Server" and delete buttons are off-screen (same layout bug as path 11) but functionality works | No — same root cause as path 11 bug |
| 18 | ✅ Pass | — | — |
| 19 | ✅ Pass | — | — |
| 20 | ✅ Pass | — | — |
