# Changelog Feature Analysis -- Complete Extraction

All features, improvements, capabilities, and bug fixes extracted from the product changelog. Every entry is captured with its name, description, and release date.

---

## Version 0.40.1 -- Fast Mode (Mar 16, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 1 | Opus 4.6 Fast Mode | Opus 4.6 fast mode is live |
| 2 | Workspace Unarchiving | Unarchive workspaces via command palette (Cmd+K) |
| 3 | Large File Diffs | Display diffs for very large files with small changes |
| 4 | File Link Parsing | Improved parsing for file links in agent output |
| 5 | App Switcher Refresh | Refreshed look of app switcher (hold Cmd, press O) |
| 6 | Command Palette Sorting | Improved sorting for command palette results |
| 7 | Archive Loading Indicator | New loading indicator when archiving workspace in sidebar |
| 8 | Undo Handling | Improved undo when typing messages to agents |
| 9 | Command Palette Search Fix | Fixed expensive search query running on keystroke |
| 10 | Chat Tab Shifting Fix | Fixed UI glitch where tabs shift after closure |
| 11 | Review Comments Fix | Fixed hidden review comments unhiding themselves |

---

## Version 0.39.0 -- Insta-Summarize, Command Palette, Opus 4.6 (Mar 13, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 12 | Instant Chat Summaries | Summarizing chats is now instant |
| 13 | Command Palette Enhancements | Create, merge, manage PRs without leaving keyboard |
| 14 | Next Session Navigation | Jump to next session needing attention via Cmd+K |
| 15 | Session Search by Content | Search sessions by message content |
| 16 | Settings Access | Open settings tabs via command palette |
| 17 | Update Checking | Check for updates without leaving keyboard |
| 18 | File Search (Cmd+F) | Search within files in edit mode using Cmd+F |
| 19 | Workspace Switching Speed | Fixed virtualization bug for faster switching |
| 20 | Scroll Jank Fix | Reduced scroll jank when switching workspaces |
| 21 | Experimental Sidebar | New experimental sidebar with human-readable branch names |
| 22 | Plan Approval Icons | Distinct icons for plan approval and user input states |
| 23 | Running Indicators | Workspace running status indicators in sidebar |
| 24 | Workspace Counts | Workspace counts next to collapsed status groups |
| 25 | Opus 4.6 General Availability | Opus 4.6 now generally available, no manual toggle needed |
| 26 | Better Search Results | Improved search results in command palette |
| 27 | Deferred Restart Option | Option to defer restart until all agents idle |
| 28 | PR Badge Interaction | Right-click PR badge to copy link or PR number |
| 29 | PR Creation Model Control | Control whether Claude switches to Haiku for PRs |
| 30 | Sidebar Visibility Buttons | Always-shown sidebar visibility toggle buttons |
| 31 | File Viewing Memory | Remembers which file was viewed when switching workspaces |
| 32 | Status Group Counts | Collapsed status group shows workspace count |
| 33 | Internal Speedups | Performance optimizations throughout application |
| 34 | macOS Permissions | Reduced unnecessary macOS permissions prompts |
| 35 | Unsaved File Edits | Preserves unsaved file edits when switching tabs |
| 36 | Chat Tab Overlap Fix | Fixed chat tabs sometimes overlapping |
| 37 | Detached Head State | Disabled branch renaming in detached head state |
| 38 | Escape in Mentions Menu | Pressing escape no longer unfocuses chat input |
| 39 | File Tab Flash Fix | Fixed file tabs flashing when closing |
| 40 | Sidebar Drag Fix | Fixed invalid state from dragging sidebar closed |
| 41 | Bedrock/Vertex Update | Updated Bedrock and Vertex AI users to Claude Opus 4.6 |
| 42 | Shortcut Number Overlap | Fixed shortcut number overlapping with archive button |
| 43 | Binary File Classification | Fixed small files incorrectly classified as binary |
| 44 | Cost Display Removal | Removed Claude Code cost display for inaccuracy |
| 45 | Merged PR Coloring | Workspaces with merged PRs show in purple |
| 46 | Run Tab Animation | Run tab shows running animation instead of loading spinner |
| 47 | Branch Rename Instructions | Clarified branch renaming instructions sent to agent |
| 48 | Text Selection Disabling | Disabled text selection to avoid UI jank |
| 49 | Repo Icon Defaults | Workspaces without chosen icon use initial on colored background |

---

## Version 0.38.5 -- Bug Fixes (Mar 11, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 50 | Plan Mode Exit Fix | Fixed bug causing plan mode to exit early |
| 51 | Experimental Sidebar Mode | New experimental sidebar mode (Settings > Experimental) |
| 52 | Login Button on 401 | Show login button when hitting 401 authentication error |
| 53 | Missing Symlink Restoration | Auto-restore missing workspace symlinks at app launch |
| 54 | Unarchived Workspace Fix | Fixed unarchived workspaces getting archived immediately |
| 55 | Auto-Archive Trigger | Auto-archive now triggers without requiring workspace click |
| 56 | Cancellation Agent | Fix cancellation agent (Cmd+Shift+Delete) availability |
| 57 | Workspace Rename Sync | Fixed workspace rename getting lost with multiple instances |

---

## Version 0.38.4 -- Direnv Support, Opus 4.6 1M (Mar 10, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 58 | Direnv Support | Support for directory-based shell tools like direnv |
| 59 | Opus 4.6 (1M Context) | Added Opus 4.6 with 1M context window, opt-in via Settings |
| 60 | App Switcher Enhancement | Show all installed apps and add close button to cycle |
| 61 | Auto-Archive PR Scenarios | Auto-archive respects all PR merge scenarios |
| 62 | Chat Rendering Performance | Improved chat rendering performance |
| 63 | Target Branch Resolution | Fix target branch resolution for PRs |
| 64 | Error Message Casing | Error messages display in proper case |

---

## Version 0.38.3 -- Multiline Comments (Mar 10, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 65 | Multiline Comments | Click and drag to add multiline comments |
| 66 | Comment Markdown | Comments render with markdown formatting |
| 67 | GitHub Comment Avatars | Comments from GitHub show author's avatar |
| 68 | Resolved Comment Handling | Comments disappear when outdated or resolved |
| 69 | Terminal Search | Search terminal with Cmd+F |
| 70 | Chat Markdown Copy | Right-click on chat to copy as markdown (Cmd+Option+C) |
| 71 | Idle Process Management | Stops idle Claude processes to reduce memory |
| 72 | Merge/Rebase Detection | Detects merge/rebase preference from git |
| 73 | CodeMirror Integration | Code editor powered by CodeMirror for speed/lighter weight |
| 74 | Wrong PR Base Branch | Fixed showing wrong PR base branch |
| 75 | Large Repo UI Issue | Fixed UI issue from having too many repos |
| 76 | Inaccurate Cost Info | Removed inaccurate cost information from turn tooltip |
| 77 | Tool Call Code Output | Fixed visual issue with tool call code output |
| 78 | Stop Button Replacement | Stop button replaced by queue button when message typed |
| 79 | App Switcher Experiment | Press Cmd+O and hold cmd for new experiment |

---

## Version 0.38.1-0.38.2 -- New Terminal, Perf Issues (Mar 6, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 80 | Terminal Rewrite | Rewritten terminal for improved performance and reliability |
| 81 | Log File Size Limiting | Limit log file size and clear large ones |
| 82 | Claude Code Update | Update Claude Code to version 2.1.70 |
| 83 | Context Usage Parsing | Fix context usage parsing for latest Claude Code format |
| 84 | Subagent Rendering | Fix subagent rendering to recognize latest Claude Code format |

---

## Version 0.38.0 -- GPT-5.4 (Mar 5, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 85 | GPT-5.4 Availability | GPT-5.4 now available in model selection |
| 86 | PR Review Editing | Right-click review button to edit review before sending |
| 87 | Reviewer Agent Control | Change reviewer agent or add custom instructions |
| 88 | Claude Agent SDK Update | Upgraded to Claude Agent SDK 0.2.64 |
| 89 | Chat Title Search | Search by chat title in command palette (Cmd+K) |
| 90 | Model Selector Spacing | Improved spacing and alignment in model selector |
| 91 | Auto Cancel on Dismiss | Cancel agent automatically when dismissing ask-user question |
| 92 | Edit Button in Diff | Fix edit button in diff view navigation |
| 93 | Grep Tool Preview | Fix grep tool preview showing matches incorrectly |
| 94 | Viewed Checkbox | Fix viewed checkbox not appearing in diff tree view |
| 95 | Markdown Table Copy | Fix markdown table copy button not appearing/working |
| 96 | Archive Navigation Prevention | Prevent navigation to archived workspaces |
| 97 | Slash Command Dropdown | Fix slash command dropdown descriptions truncating |

---

## Version 0.37.1 -- Polish and Bug Fixes (Mar 3, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 98 | Number Key Model Switching | Use number keys to quickly switch between models |
| 99 | Back/Forward Navigation | More intuitive back/forward navigation |
| 100 | Workspace Repo Settings | Right-click workspace to navigate to repo settings |
| 101 | Simplified Next Unread | Simplified the "Next unread" button |
| 102 | Workspace City Display | See workspace's city name on history page |
| 103 | Slash Commands Autocomplete | Fixed UI issue with slash commands autocomplete menu |
| 104 | Scroll Button Transparency | Fixed transparent background on scroll-to-button |
| 105 | File Picker Flickering | Fixed flickering in file picker (Cmd+P) |
| 106 | Layout Shifts | Fixed several layout shifts |
| 107 | Cmd+O Directory Opening | Fixed opening wrong directory with cmd+O in some apps |
| 108 | Autocomplete Disabling | Disabled autocomplete and hints when editing files |
| 109 | Help Menu Standardization | Standardized two help menus and added debug tools option |
| 110 | Git Status Help | Improved help text when app can't compute git status |
| 111 | CPU/Memory Usage Display | Experimental option to show CPU and memory usage |

---

## Version 0.37.0 -- Manual Mode (Mar 3, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 112 | Built-in File Editor | Text editor for direct file editing with syntax highlighting |
| 113 | Editor Search | Full Cmd+F search in file editor |
| 114 | Performance Improvements | General performance improvements throughout application |
| 115 | Repository Text Search | Add text search to repository selector (Cmd+Shift+N) |
| 116 | Port Display | Display port number on terminal panel's open button |
| 117 | Table Markdown Copy | Button to copy rendered tables as markdown |
| 118 | Tab Density | Improved top bar tab density and hover feedback on tab actions |
| 119 | Auto-Create Folders | Create missing folders automatically when starting quick repo |
| 120 | File Change Polling | Stop polling for file changes after turn completes |
| 121 | Chat Summary Privacy | Prevent chat summaries using external AI in privacy mode |
| 122 | Mark as Read Option | Fixed "mark as read" option and bug with marking unread |

---

## Version 0.36.9 -- Performance Improvements (Feb 27, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 123 | Performance Optimization | Removed code introducing performance issues |
| 124 | Commit and Push Shortcut | Keyboard shortcut for commit and push (Cmd+Shift+Y) |
| 125 | New Workspace Shortcuts | Open or duplicate workspace from branch (Cmd+Shift+N) |
| 126 | Inline Archive Button Removal | Removed inline archive button to prevent accidents |

---

## Version 0.36.7 -- Bug Fixes (Feb 27, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 127 | Xcode License Detection | Detect if Xcode license out of date on app startup |

---

## Version 0.36.6 -- Bug Fixes (Feb 27, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 128 | Claude Agent SDK Update | Updated to 0.36.6 to fix prompt caching bug |

---

## Version 0.36.5 -- Open from Linear, Bug Fixes (Feb 26, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 129 | Linear Integration Deeplink | Open workspace from Linear issue |
| 130 | GitHub Request Reduction | Reduced background GitHub gh requests |
| 131 | Context Meter Restoration | Added back the context meter display |
| 132 | GitHub Issues Display | See and select GitHub issues from create workspace dialog |
| 133 | Claude Code SDK Update | Updated Claude Code SDK and binaries to 2.1.59 |
| 134 | Settings Switch Animation | Animated settings switch toggles |
| 135 | GitHub Polling Reduction | Reduced GitHub polling for inactive workspaces |

---

## Version 0.36.4 -- Next Workspace (Feb 24, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 136 | Jump Between Chats | Quickly jump between chats needing attention/unread messages |
| 137 | Thinking Mode Animation | Smoothed animations when toggling thinking and plan mode |
| 138 | Linear Integration Improvement | Improved Linear integration |
| 139 | Workspace Diff Timeout | Workspace diffs timeout after 20 seconds |
| 140 | Linear Deeplink Parameters | Handle prompt and path parameters in Linear deeplinks |

---

## Version 0.36.3 -- Submit a Prompt, SDK Memory Leaks (Feb 23, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 141 | Submit a Prompt Feature | Prompt coding agent to build features directly |
| 142 | Tool Version Manager Support | Terminal respects mise, asdf, and rbenv configurations |
| 143 | Anthropic Agent SDK Update | Updated to 2.1.50, solving memory leak issues |
| 144 | Enterprise Data Privacy Mode | Enable via setting enterpriseDataPrivacy in config JSON |
| 145 | Workspace Sidebar Controls | Split sidebar controls into filter and display buttons |
| 146 | Show More Buttons | Show more buttons when workspaces grouped by repo |
| 147 | File Tab Content Refresh | File tabs properly refresh when navigating between text files |
| 148 | Graphite Stack Order | Fixed reversed branch order in Graphite stacks |
| 149 | Terminal Version Manager | Terminal respects tool version manager configurations |

---

## Version 0.36.2 -- Model Picker, Bug Fixes (Feb 18, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 150 | Default Model Change | Change default model directly from model picker |
| 151 | Context Usage Info | Temporarily removed due to Anthropic SDK issue |
| 152 | GitHub Check Copy | Button to copy logs from GitHub check |
| 153 | Agent Type Switching | Switching agent types now immediately switches to new tab |
| 154 | Ask-a-Question Instructions | Clearer instructions for Claude's ask-a-question tool |
| 155 | Rendering Optimizations | Small rendering optimizations throughout app |
| 156 | Markdown Preview Scroll | Fixed markdown preview scroll in file and diff viewers |
| 157 | Archive Workspace Crash | Fixed crash when archiving workspaces |
| 158 | PR Creation Layout Shift | Fixed layout shift when creating workspaces from PRs |
| 159 | Directory Movement Warning | Added reminders not to move/delete workspace directories outside the app |

---

## Version 0.36.1 -- Bug Fixes (Feb 17, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 160 | Resource Usage Fix | Fixed bug causing increased background resource usage |
| 161 | Inline New Workspace Button | Re-added inline "New workspace" button |
| 162 | Chat Overview Bars | Capped at 50 turns for better readability |
| 163 | Open In Button | "Open in" button always shows workspace directory |
| 164 | Xcode Installation Detection | Improved Xcode installation detection |

---

## Version 0.36.0 -- Sonnet 4.6, Pierre Diffs (Feb 17, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 165 | Sonnet 4.6 Live | Sonnet 4.6 now live |
| 166 | New Diff Viewer Engine | Replaced with more accurate, beautiful diff engine |
| 167 | Workspace Info Display | More workspace info in sidebar (repo, directory) |
| 168 | Repository Drag and Drop | Drag and drop to reorder repositories in sidebar |
| 169 | Chat Tab Sizing | Adjustments to chat tab sizing |
| 170 | Sidebar Visibility Toggle | Toggle sidebar visibility from View menu |
| 171 | Branch Rename Clarification | Clarify branch rename instruction |
| 172 | Home Page UI Fix | Fix right sidebar toggle button on home page |
| 173 | Ask-a-Question Textarea | Fix textarea autoresizing in ask-a-question tool |
| 174 | Chat Title Override Fix | Fixed AI-generated titles overriding manual changes |

---

## Version 0.35.3 -- Reliability and Performance (Feb 14, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 175 | Rendering Fixes | Fixed rendering and performance issues |
| 176 | High Idle CPU | Removed animations causing high idle CPU usage |
| 177 | Workspace Deletion Option | Option to delete workspaces that can't be archived |
| 178 | Chat Renaming | Rename chats in tab bar with inline editor |
| 179 | Model Picker Navigation | Model picker is keyboard-navigable |
| 180 | Mermaid Diagram Interaction | Mermaid diagrams support pan and zoom when expanded |
| 181 | Attachment Scrolling | Attachments scroll to save space with 10+ attachments |
| 182 | PR Description Reminder | Agent reminded to write PR descriptions covering all changes |
| 183 | Repository URL Configuration | Configure URL used by "Open" button in repo settings |
| 184 | Rendering Performance | UI performance improvements throughout app |
| 185 | Codex x86_64 Support | Fixed issue with Codex on x86_64 architecture |

---

## Version 0.35.2 -- Group Workspaces by Repo, GPT-5.3-Codex-Spark (Feb 12, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 186 | Workspace Grouping | Group workspaces by repository in sidebar |
| 187 | GPT-5.3-Codex-Spark | OpenAI's fastest frontier model now available |
| 188 | Bold Workspace Titles | Workspace titles bolded when awaiting responses or plan review |
| 189 | Cancellation Reliability | Cancelling Claude Code now faster and more reliable |
| 190 | GitHub Polling Reduction | Reduced GitHub polling to prevent quota hits |

---

## Version 0.35.1 -- Bug Fixes (Feb 11, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 191 | Chat Disappearing Fix | Fixed bug causing chats to intermittently disappear |

---

## Version 0.35.0 -- Workspace Status (Feb 11, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 192 | Workspace Status Organization | Organize by status (backlog, in progress, review, done) |
| 193 | PR Title Labeling | Workspaces labeled by PR title when available |
| 194 | Workspace Status Display | Visual status display in sidebar organization |
| 195 | Repository Customization | Customize repository when using Cmd+Shift+N |
| 196 | Truncated Title Tooltips | Tooltips on hover for truncated workspace titles |
| 197 | Uncommitted File Stats | Fixed incorrect line stats and diffs for uncommitted files |
| 198 | PR Metadata Clearing | Fixed PR metadata and comments not clearing in continued workspace |
| 199 | File Mention Rendering | Fixed file mentions with parentheses/percentages not rendering |
| 200 | Open in Browser Shortcut | Fixed "Open in browser" shortcut conflicting |
| 201 | Workspace Action Tooltips | Fixed workspace action tooltips flickering |
| 202 | PR Template Skipping | Skipped attaching PR templates with custom description |

---

## Version 0.34.2 -- Chat Summaries, Re-Run Actions, LaTeX (Feb 10, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 203 | Chat Summaries | Hover table of contents for brief chat overview |
| 204 | Failed Action Re-run | Failed GitHub Actions checks have re-run button |
| 205 | LaTeX Support | Added support for LaTeX rendering in chats |
| 206 | Diagram Theme Colors | Diagrams use the app's theme colors |
| 207 | IDE Opening | Smoother experience opening files in Cursor, VS Code |
| 208 | Workspace Search | Repo name included when searching for workspaces with /add-dir |
| 209 | PR Title Display | PR title shown in experimental sidebar mode |
| 210 | History Label | "Workspaces" label changed to "History" in experimental mode |
| 211 | Autoscroll Fix | Fixed autoscroll not working correctly |
| 212 | Image Attachment Rendering | Fixed image attachments not rendering properly |
| 213 | Terminal Escape Codes | Fixed garbled escape codes in terminal on buffer replay |
| 214 | Settings Sidebar Spacing | Fixed settings sidebar spacing not matching workspace sidebar |
| 215 | Chat Scrolling Performance | Fixed chat scrolling performance with redundant cache fix |

---

## Version 0.34.1 -- Editable PR Titles and Descriptions (Feb 6, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 216 | Editable PR Titles | Edit PR titles in Checks tab |
| 217 | Editable PR Descriptions | Edit PR descriptions in Checks tab |
| 218 | AI Uses Edited Values | AI uses edited PR values when creating PRs |
| 219 | Prompt Improvements | Improved prompts for code review, chat summarization |
| 220 | Agent Swarm Tools | Added UI rendering for agent swarm tools |
| 221 | Non-Image File Pasting | Non-image files can be pasted into Composer |
| 222 | Image Copy/Paste | Fixed images copied in app not pasting into Composer |
| 223 | Tool Icon Sizing | Fixed inconsistent tool icon sizing |
| 224 | Unicode Terminal Support | Fixed certain unicode characters not rendering in terminal |

---

## Version 0.34.0 -- Opus 4.6 and GPT-5.3-Codex (Feb 5, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 225 | Opus 4.6 Availability | Smartest Anthropic model now available |
| 226 | GPT-5.3-Codex Availability | Fastest OpenAI model now available |
| 227 | Mermaid Fullscreen | Mermaid diagrams can expand to fullscreen |
| 228 | Toast Workspace Links | Each toast links to related workspace |
| 229 | Richer Error Messages | Richer error messages from Claude Code and Codex |
| 230 | Deeplink Clickability | Deeplinks in AI responses now clickable |
| 231 | Archive During Running | Archiving blocked while agents running |
| 232 | Open In Options | New "Open in" options including more Zed, IntelliJ variants |
| 233 | Redundant Compaction | Cleaned up redundant compaction messages |

---

## Version 0.33.5 -- Better Archiving (Feb 3, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 234 | Git State Saving | Automatically saves git state when archiving |
| 235 | Uncommitted File Saving | Saves uncommitted files when archiving |
| 236 | Workspace Status Organization | Organize by status in experimental mode |
| 237 | Archive Script Interrupt | Archiving immediately interrupts setup script |
| 238 | Unarchive Flexibility | Always unarchive even if original branch changed |
| 239 | Code Review Summary | Code reviewer outputs summary in more visible place |
| 240 | Punctuation Boundary Navigation | Option+Left/Right stops at punctuation in composer |
| 241 | Ask Question Moderation | Claude less aggressive using ask-a-question tool |
| 242 | Text Navigation Boundaries | Alt+arrow treats periods as word boundaries |

---

## Version 0.33.4 -- Git Panel Grouping and Bug Fixes (Jan 31, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 243 | Git Panel File Grouping | Changes tab groups files into Uncommitted/Committed |
| 244 | GitHub Issue Linking | Link GitHub issues without Linear authentication |
| 245 | PR Diff Accuracy | Creating workspace from PR shows correct diff |
| 246 | Open In JetBrains Detection | Fixed detection for JetBrains IDEs via Toolbox |
| 247 | Chat Bottom Space | Fixed extra blank space at chat bottom |
| 248 | Authentication Messages | Fixed authentication failure message |

---

## Version 0.33.3 -- Performance Improvements, File Context Menu (Jan 29, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 249 | Long Chat Performance | Fixed performance issue in long chats |
| 250 | File Context Menu | New context menu when right-clicking files |
| 251 | User Comments Display | User comments appear in Checks tab |
| 252 | Comment Input Focus | Fixed comment input frequently losing focus |
| 253 | Branch Rename After Continue | Fixed branch rename instruction after "Continue on new branch" |
| 254 | Claude Code 400 Error | Fixed 400 API error with Claude Code |
| 255 | Uncommitted Changes Toggle | Fixed Option+U not un-toggling uncommitted changes view |
| 256 | Open Button File Navigation | "Open" button opens to currently viewed file |

---

## Version 0.33.2 -- View GitHub Actions (Jan 28, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 257 | GitHub Actions Viewing | Click GitHub Action in Checks tab to view logs |
| 258 | Thinking Budget | Replaced ultrathink with max thinking budget |
| 259 | Right Panel Overflow | Fixed right panel overflow on smaller screens |
| 260 | Opus No Content | Fixed Opus sometimes outputting "(no content)" |
| 261 | Apple Autocomplete | Disabled Apple autocomplete in Composer |

---

## Version 0.33.1 -- Slash Command Bug Fix (Jan 27, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 262 | Slash Command Processing | Fixed certain slash commands not processing with thinking enabled |

---

## Version 0.33.0 -- Tasks and Typography (Jan 27, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 263 | Tasks Feature | Claude can organize work with tasks for longer projects |
| 264 | Typography Revamp | Revamped typography scale for readability |
| 265 | Multi-select Questions | Support for multi-select questions from Claude |
| 266 | Context Usage Breakdown | Detailed context usage when hovering context dial |
| 267 | Question Input Spellcheck | Disabled autocorrect/spellcheck in questions field |
| 268 | Archive Shortcut Change | Changed add repository shortcut to Cmd+Option+A |
| 269 | Codex Cancellation | Fixed bug with cancellation in Codex |
| 270 | Attachments with Slash Commands | Fixed attachments not sent with slash commands |

---

## Version 0.32.2 -- Bug Fixes (Jan 23, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 271 | Message Sending After Close | Fixed inability to send messages after closing chat tab |
| 272 | Archived Workspace Messaging | Fixed archived workspace message sending issue |

---

## Version 0.32.1 -- Rerun Setup Scripts (Jan 22, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 273 | Setup Script Rerun | Rerun setup script directly from terminal panel |
| 274 | Context Window Display | Setting to always view context window usage |
| 275 | Copy Plans | Option to copy plans to clipboard |
| 276 | Cmd+O Repository Opening | Restored Cmd+O shortcut to open repository from settings |
| 277 | Elixir Syntax Highlighting | Added Elixir syntax highlighting |
| 278 | Empty Chat Loading | Fixed chats appearing empty on load |

---

## Version 0.32.0 -- GitHub Issues, Graphite Stacks, Continue Chats, Table of Contents (Jan 22, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 279 | GitHub Issues Attachment | Attach GitHub issues in chat |
| 280 | Graphite Stack Display | Stack appears in right sidebar when using Graphite |
| 281 | Update Memory Option | Click "Update memory" after merge to learn from mistakes |
| 282 | Continue on New Branch | Start new feature work in same workspace |
| 283 | Chat Table of Contents | Table of contents for easy navigation |
| 284 | Subagent Rendering | Improved sub-agent rendering |
| 285 | Script Stdin Redirection | Redirect /dev/null to stdin when running scripts |
| 286 | Message Cancellation Race | Fixed race condition with cancelling and sending messages |
| 287 | MCP Output Truncation | Truncated MCP output preview to prevent UI freezes |
| 288 | Loader Alignment | Loader indicator aligned with chat messages |
| 289 | Todos Overflow | Fixed todos going off screen in Checks tab |
| 290 | Interactive Question Bug | Fixed enter shortcut in interactive question tool |
| 291 | Tab Switch Layout Shift | Fixed layout shift when toggling tabs in right sidebar |
| 292 | Export to New Chat | "Export to new chat" button visible when running out of context |
| 293 | Composer Focus | Fixed Composer losing focus after cancelling |

---

## Version 0.31.3 -- AskUserQuestion Improvements (Jan 19, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 294 | Question UI Cleanup | Cleaned up AskUserQuestion tool UI |
| 295 | GitHub Comment Edits | See GitHub comment edits |
| 296 | Folder Drag and Drop | Drag and drop folders onto Composer |
| 297 | PR Link Copy | Button to copy PR link |
| 298 | Git Prefix Flexibility | Add git prefix not ending in "/" in Settings > Git |
| 299 | Codex Reasoning Level | Updated Codex reasoning level default to low |
| 300 | Rebase Detection | Made rebase detection more reliable |
| 301 | Codex Review Thinking | Review session respects Codex thinking level |
| 302 | Mark as Viewed Shortcut | Ctrl+V to mark file as viewed works when chat focused |

---

## Version 0.31.2 -- General Agent Preferences (Jan 17, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 303 | General Agent Instructions | Add instructions for agents on startup |
| 304 | Chat Search Navigation | Cmd+G and Cmd+Shift+G shortcuts to navigate search results |
| 305 | Workspace Archive Bug | Fixed bug preventing workspace archiving |
| 306 | Thinking Toggle Dark Mode | Fixed thinking/plan mode toggles in dark mode |
| 307 | Create PR Wrong Chat | Fixed "Create PR" button sending to wrong chat |
| 308 | File Name Overflow | Fixed file names overflowing when reviewing diffs |

---

## Version 0.31.1 -- Checks Tab (Jan 16, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 309 | Checks Tab Introduction | One place to track everything before merging |
| 310 | Git Status Tracking | Track git status in Checks tab |
| 311 | Deployment Tracking | Track deployments in Checks tab |
| 312 | CI Actions Tracking | Track CI actions in Checks tab |
| 313 | Comment Tracking | Track comments in Checks tab |
| 314 | User Todos Tracking | Track user todos in Checks tab |
| 315 | Repository Settings Shortcut | Cmd+, shortcut to open repo settings |
| 316 | Archive Commit Prompt | Ask to commit if uncommitted changes when archiving |
| 317 | Slash Command Anywhere | Slash command autocomplete works anywhere in message |
| 318 | Restart Slash Command | Added /restart to restart Claude Code process |
| 319 | Restart Confirmation | Confirmation dialog if agents running when restarting |
| 320 | Codex Thinking Levels | Restored granular thinking levels for Codex |
| 321 | Non-file Comments | Non-file level GitHub comments accessible from Checks tab |
| 322 | Favicon Detection | Improved favicon detection in left sidebar |
| 323 | Corporate Proxy Support | Fixed app crashing for corporate SSL proxy users |
| 324 | Invalid Slash Commands | Invalid slash commands show error in chat |
| 325 | Search Bar Width | Increased Cmd+F search bar width |
| 326 | Repository Name Truncation | Repository names truncated in left sidebar |
| 327 | Settings Repository Names | Repository names truncated in settings |
| 328 | Left Sidebar Icon Alignment | Fixed left sidebar icon alignment |
| 329 | Sidebar Resize | Fixed left sidebar resizing to no width |
| 330 | Right Panel Overflow | Fixed text overflowing in right panel |

---

## Version 0.31.0 -- Search Chats, Add Scripts in UI, View Setup Script Logs (Jan 15, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 331 | Chat Search Feature | Use Cmd+F to search within chats |
| 332 | Script Editing UI | Edit scripts directly in Settings |
| 333 | Setup Script Logs Display | Setup script logs visible in UI |
| 334 | Left Sidebar Simplification | Simplified left sidebar with + icon for new workspace |
| 335 | Favicon Auto-detection | Auto-detects favicons from repository |
| 336 | SVG Image Toggle | Toggle to render .svg files as images |
| 337 | Mark as Viewed Shortcut | Ctrl+V shortcut to mark files as viewed |
| 338 | Viewed Navigation | Marking file as viewed automatically navigates to next file |
| 339 | Target Branch Reset | Tries to reset git state when changing target branch |
| 340 | Workspace Storage Configuration | Setting to configure where workspaces stored |
| 341 | Linear Issue Sorting | Linear issues sorted chronologically by updated time |
| 342 | New Linear Issues | New issues pulled in faster |
| 343 | Attachments Popover | Fixed attachments popover not closing after adding |
| 344 | Fix Errors Button | "Fix errors" button appears when PRs blocked awaiting review |
| 345 | Unnecessary Tab Switching | Fixed unnecessary chat tab switching |
| 346 | Hand Off Button | "Hand off" button starts new chats in default permission mode |
| 347 | Composer Approval Text | Fixed composer approval text on smaller screens |

---

## Version 0.30.0 -- Bug Fixes, Claude Code for Chrome, Hand off Plans (Jan 13, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 348 | Error Code 1 Fix | Fixed increase in Error Code 1 with async subagent |
| 349 | Claude Code Chrome | Claude Code can use Chrome to test, browse, screenshot |
| 350 | Hand Off Plans | Hand off plans to another agent for implementation |
| 351 | GetTerminalOutput Rendering | Improved rendering for GetTerminalOutput tool |
| 352 | CI Job Run Time | Added CI job run time to Checks tab |
| 353 | CI Jobs Sorting | CI jobs in Checks tab sorted by state |
| 354 | Todo Creation Shortcut | Enter key creates new TODO in Checks tab |
| 355 | Copy Queued Messages | Button to copy queued user messages |
| 356 | App Versions | Added app and SDK versions to help menu |
| 357 | Terminal Clear Shortcut | Cmd+K shortcut to clear terminal display |
| 358 | Branch Name Display | Fixed workspace branch name not showing during initialization |
| 359 | Deleted File Viewing | Fixed deleted files not being marked as viewed |
| 360 | Checks Panel View | Fixed navigating to Checks panel changing main panel view |

---

## Version 0.29.5 -- Bug Fixes, Claude Can Read Terminal (Jan 12, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 361 | Terminal Reading Tool | New tool for Claude to read terminal |
| 362 | Uncommitted Changes Shortcut | Shift+Option+C shortcut to view uncommitted changes |
| 363 | Deployment Project Names | Project name added to deployments in Changes tab |
| 364 | Workspace Tab Closing | Fixed new workspace page appearing when last tab closed |
| 365 | Deleted File Marking | Fixed deleted files not being marked as viewed |
| 366 | Thinking Toggle | Clarified behavior in thinking toggle |

---

## Version 0.29.4 -- PR Checks, New Shortcuts (Jan 12, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 367 | Checks Tab | Monitor GitHub actions, deployments, user TODOs |
| 368 | Review Shortcut | Cmd+Shift+R shortcut for review |
| 369 | Fix Errors Shortcut | Cmd+Shift+X shortcut for fix errors |
| 370 | GitHub Open Shortcut | Cmd+Shift+G shortcut to open in GitHub |
| 371 | Pull Latest Shortcut | Cmd+Shift+L shortcut to pull latest |
| 372 | Merge Shortcut | Cmd+Shift+M shortcut to merge |
| 373 | Tab Navigation Shortcuts | CTRL+Tab and Shift+CTRL+Tab to switch chat tabs |
| 374 | Keyboard Shortcuts Cheatsheet | Cmd+/ to see shortcuts cheatsheet |
| 375 | Read Image Tool | Better rendering for read image tool use |
| 376 | Plan Mode Help Text | Fixed plan mode helper text wrapping |
| 377 | Composer UI Tweaks | Various UI tweaks to Composer |

---

## Version 0.29.3 -- Composer Improvements, Bug Fixes (Jan 10, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 378 | Simplified Composer | Simplified composer with + icon for attachments |
| 379 | Linear Issues in Composer | Add linear issues via Composer + icon |
| 380 | Review Button Visibility | Fixed review button not visible while AI working |
| 381 | Branches Dialog Crash | Fixed branches tab crashing with many branches |
| 382 | Dark Mode Checkboxes | Checkboxes more legible in dark mode |
| 383 | Tab Navigation in Dialog | Fixed TAB not working in create workspace dialog |

---

## Version 0.29.2 -- Vercel Deployments, Simplified Thinking Levels (Jan 9, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 384 | Vercel Deployments Tab | View Vercel and GitHub deployments per PR |
| 385 | Thinking Toggle Simplification | Simplified thinking toggle on/off with Option+T |
| 386 | Thinking Default | Thinking enabled by default for new users |
| 387 | Left Sidebar Hiding | Fixed left sidebar hiding when all repos deleted |
| 388 | Spotlight Error Message | Improved error messaging when spotlight fails |
| 389 | Environment Variable Visibility | Fixed CONDUCTOR_* env variables visibility |
| 390 | Branch Renaming Instructions | Clarified branch renaming instructions |
| 391 | Merged PR Appearance | Workspaces with merged PRs show in purple |
| 392 | Run Tab Animation | Run tab shows running animation instead spinner |
| 393 | Version Display Removal | Removed Claude Code cost display |
| 394 | Icon Default | Workspaces without icon use initial on colored background |

---

## Version 0.29.1 -- Customize Prompts, Mark Files as Viewed (Jan 8, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 395 | Customize Code Review Prompts | Customize code review prompts per repository |
| 396 | Customize Create PR Prompts | Customize create PR prompts per repository |
| 397 | Customize Branch Rename Prompts | Customize branch renaming prompts per repository |
| 398 | Mark Files as Viewed | Mark files as viewed when reviewing changes |
| 399 | Viewed File Auto-reset | Files automatically move back to review when changed |
| 400 | Claude Code Update | Bumped to Claude Code 2.1.0 |
| 401 | Broken Hyperlinks | Fixed broken hyperlinks |
| 402 | Comments Keybindings | Comments respect user keybindings for sending |
| 403 | Model Selection Carry-over | Model/thinking selection carries over when forking |
| 404 | Comment Duplication | Fixed comments being sent multiple times |
| 405 | Large Branch Selection | Changing target branch with many branches now instant |
| 406 | Clear Command | Fixed /clear command |

---

## Version 0.29.0 -- Claude Can Comment on Code (Jan 7, 2026)

| # | Feature | Description |
|---|---------|-------------|
| 407 | Diff Commenting Tool | Claude Code tool to comment directly on diff |
| 408 | GitHub Comment Sync | GitHub comments automatically sync to diff |
| 409 | Comment Import Options | Choose to add comments to chat or hide them |
| 410 | Memory Update Prompt | Ask AI to update memory when addressing comments |
| 411 | Draft Comment Persistence | Draft comments persist across restarts |
| 412 | Previous Message Comments | View comments from previous messages |
| 413 | Spotlight Testing | New experimental system for testing changes |
| 414 | Keyboard Shortcut | Question navigation when providing input during planning |
| 415 | Markdown Formatting | Claude uses markdown when asking questions |
| 416 | Keyboard Shortcuts Search | Search bar in keyboard shortcuts dialog |
| 417 | Context Directory | Agents know about shared .context directory |
| 418 | Shell Configuration Access | Claude and Codex access shell configurations |
| 419 | Branch Deduplication | Dedupe branch names when creating workspace |
| 420 | Recent Chats | Only show 5 most recent chats for context |
| 421 | Fork Workspace Preservation | Preserve notes/attachments in .context when forking |
| 422 | Cancel Button Tooltip | Fix cancel button tooltip |
| 423 | Terminal Escape Key | ESC no longer captured in Terminal (vim works) |
| 424 | Dialog Escape Fix | Fixed ESC not closing dialogs |
| 425 | Smart Scrolling | Fixed smart scrolling bugs with arrow keys |
| 426 | Context Directory Changes | Ignore changes in .context for checkpointing |
| 427 | Mono Font Persistence | Fixed "Mono Font" setting not persisting |
| 428 | Question Input Key | Claude question custom input uses configured send key |
| 429 | Node Version | Fixed Claude/Codex using bundled node |
| 430 | File Mention Jank | Fixed jank with mentioning files |
| 431 | Attach Button | Hide "attach to chat" button for folders |
| 432 | Context Meter Icon | Made context meter icon thinner |
| 433 | Question Headers | Removed headers from Claude's questions |
| 434 | Passport Navigation | Navigate to Passport using command palette |

---

## Version 0.28.1 -- Context Directory, Set Working Directories (Dec 23, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 435 | Context Directory | New .context directory in workspaces |
| 436 | Attachment Storage | Attachments stored automatically in .context |
| 437 | Plan Storage | Plans automatically stored in .context |
| 438 | Notes Storage | Notes automatically stored in .context |
| 439 | Working Directory Configuration | Set which directories checked out in workspace |
| 440 | Custom Mono Fonts | Use custom mono fonts in settings |
| 441 | Workspace Context | All new workspaces have .context directory |
| 442 | Planning Sidebar Notification | Sidebar notification when awaiting input during planning |
| 443 | Chat Forking Summaries | Summaries stored in new workspace directory when forking |
| 444 | Command Palette Terminal | Disabled command palette when terminal focused |
| 445 | Branch Name Search | Fixed inaccurate branch names when searching |
| 446 | Keyboard Shortcut Conflict | Fixed conflict between feedback and workspace search shortcuts |
| 447 | Zen Mode Scroll | Fixed scroll to bottom button position in zen mode |
| 448 | Codex GH_TOKEN | Fixed Codex not receiving GH_TOKEN |
| 449 | Planning Text Wrapping | Fixed text wrapping when awaiting user input |

---

## Version 0.28.0 -- Workspaces Page, Claude's Context, Interactive Planning (Dec 22, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 450 | Workspaces Page | View history of all workspaces |
| 451 | Workspace Restoration | Open existing or unarchive old workspaces |
| 452 | Workspace Filtering | Filter by repo, branch, or PR number |
| 453 | Context Indicator | Indicator when Claude close to running out of context |
| 454 | Interactive Plan Mode | Claude asks interactive questions during planning |
| 455 | Workspace Context Folder | .context folder in new workspaces |
| 456 | File Attachment Shortcut | Plus icon to attach files directly in chat |
| 457 | Chat Keyboard Navigation | Navigate with arrow keys or vim style j/k |
| 458 | Sidebar Toggle | [ and ] keys toggle sidebars |
| 459 | Notes Markdown Preview | Notes tab support rich markdown previews |
| 460 | PR Viewing | Viewing PRs in GitHub is now instant |
| 461 | Historical Changes View | More obvious when viewing historical changes |
| 462 | Response Metadata Hover | Hover response duration to see metadata |
| 463 | Permission Mode Changes | Permission mode changes sent to Claude in real time |
| 464 | Run Script Feedback | UI feedback when run scripts stopping/starting |
| 465 | Default Branch Detection | Fixed default branch detection for local repositories |
| 466 | Sidebar Visibility Lag | Fixed lag when toggling sidebar visibility |
| 467 | Cancellation Jank | Fixed UI jank when cancelling |
| 468 | Fix Errors Logs | Fixed "Fix Errors" button not sending logs |
| 469 | Codex Chat Cancellation | Fixed messages not sendable after cancelling in Codex |
| 470 | GPT-5.2-Codex Availability | Disabled for API key users (recommend OpenAI subscription) |
| 471 | Settings Relocation | Moved repository settings to Settings page |
| 472 | Visual Cleanups | Visual cleanups throughout app |

---

## Version 0.27.2 -- Onboarding Bug Fix (Dec 19, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 473 | Claude Code Auth Fix | Fixed bug causing Claude Code auth to hang |

---

## Version 0.27.1 -- Clickable File Mentions (Dec 19, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 474 | File Link Clicking | Click on files tagged in messages to open them |
| 475 | File Page Opening | Cmd+O on file page opens specific file |
| 476 | Plan Mode Editing | Fixed bug allowing edits while in plan mode |
| 477 | Archive Button Display | Fixed archive button not appearing when remote deleted |
| 478 | Process Management | Fixed rare bug with pgrep affecting other apps |

---

## Version 0.27.0 -- Notes Tab, GPT-5.2-Codex, More Fonts (Dec 18, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 479 | Workspace Scratchpad | Scratchpad notes for sharing with agents |
| 480 | Notes Tag | Share notes with agents using notes tag |
| 481 | GPT-5.2-Codex | OpenAI's latest frontier coding model available |
| 482 | Custom Monospace Fonts | Customize monospace font in Settings > Appearance |
| 483 | Fork App Addition | Added Fork to "Open In" menu |
| 484 | OAuth Error Messages | Improved OAuth error token messages |
| 485 | Fork Chat Drops | Fixed forking chats dropping files that are both tracked/ignored |
| 486 | Double Send Fix | Fixed race condition where messages sent twice |

---

## Version 0.26.0 -- Search Workspaces, View Files from Chat (Dec 17, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 487 | Workspace Search | Search workspaces by branch, repo, or PR number (Cmd+Shift+F) |
| 488 | File Path Clicking | Click agent-mentioned file paths to view in app |
| 489 | GPT-5.2 Reasoning | Added xhigh reasoning for GPT-5.2 |
| 490 | Code Review Index | Added index to code review instructions |
| 491 | Sub Agent Icons | Added sub agent icon to tool use summary |
| 492 | Chat Tab Flicker | Fixed flicker when closing chat tabs |
| 493 | User Message Indentation | Preserved indentation in user messages |
| 494 | Terminal Shutdown | Fixed terminals shutting down after file deletion |

---

## Version 0.25.13 -- Performance Improvements (Dec 16, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 495 | Composer Input Lag | Fixed regression reducing input lag in Composer |
| 496 | Fuzzy Search Rewrite | Re-written fuzzy search, up to 10x faster |
| 497 | @ Character Flickering | Fixed pasting @ characters causing flicker/lag |
| 498 | Fuzzy Search Re-renders | Fixed unnecessary re-renders slowing queries |
| 499 | Antigravity Addition | Added Antigravity to "Open In" menu |
| 500 | MCP Server Hiding | Claude Code MCP servers hidden when using Codex |
| 501 | Plan Mode Diffs | Fixed diffs showing incorrectly in plan mode |

---

## Version 0.25.12 -- Bug Fixes (Dec 15, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 502 | GitHub CLI Bundling | Bundle GitHub CLI with the app |
| 503 | Chat Max Width | Added max width for chats |
| 504 | Archive Dialog Expansion | Expanded archive dialog with full branch names |
| 505 | Environment Variable Fix | Fixed environment variables not picked up |
| 506 | Repository Deletion Handling | Gracefully handle deleted repositories |
| 507 | Agent Type Icons | Fixed session picker icons for agent types |
| 508 | Codex API Key | Fixed Codex API Key not always picked up |

---

## Version 0.25.11 -- Fetch Comments from GitHub, Mark Workspaces as Unread (Dec 13, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 509 | GitHub Comment Fetching | Fetch PR comments from GitHub in one click |
| 510 | Workspace Unread Marking | Mark workspaces as unread |
| 511 | PR Number Search | Search by PR number in command palette |
| 512 | Message Duration Formatting | Simpler message duration formatting |
| 513 | Settings Reorganization | Reorganized Settings page for fewer clicks |
| 514 | Environment Variable Clearing | Fixed env variables not clearing when unset |
| 515 | Loading Animation Visuals | Fixed visual issues with loading animations |
| 516 | Hover Transitions | Removed hover state CSS transitions for snappiness |
| 517 | Add Dir Slash Command | Fixed /add-dir sometimes not running |
| 518 | Resolved Comments | Fixed resolved comments not filtered when fetching |
| 519 | Slash Command Processing | Fixed slash commands not processing as first message |
| 520 | Revert Button | Revert button only shows when it succeeds |
| 521 | Mermaid Unicode | Better unicode support in Mermaid diagrams |

---

## Version 0.25.10 -- Bug Fixes (Dec 12, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 522 | Agent Hanging Fix | Fixed agents hanging without responding |
| 523 | MCP JSON Recognition | MCPs in .mcp.json now recognized by Claude |
| 524 | Claude Code Bundling | App bundled with Claude Code |
| 525 | PR Status Checks | Failing status checks appear when branch awaiting review |
| 526 | Checkmark Standardization | Standardized all checkmarks to gray |
| 527 | Open In Button | Fixed Open In button failing for some users |
| 528 | Token Saving Error | Fixed "Failed to save token" error in onboarding |

---

## Version 0.25.9 -- Onboarding Bug Fixes (Dec 11, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 529 | Onboarding Auth Fix | Fixed onboarding broken for non-authenticated users |
| 530 | Western US Cities | Added more western US cities |
| 531 | Copy Buttons | Standardized copy buttons throughout app |
| 532 | Claude Code Detection | Fixed Claude Code account detection logic |

---

## Version 0.25.8 -- GPT-5.2 (Dec 11, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 533 | GPT-5.2 Availability | OpenAI's latest frontier model available |
| 534 | Review Button Prominence | Made review button more obvious |
| 535 | Background Process Rendering | Improved rendering when checking background processes |

---

## Version 0.25.7 -- .env Bug Fix, Vercel CI Status Checks (Dec 11, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 536 | Env File Security | Environment variables in .env not picked up by Claude |
| 537 | Vercel CI Checks | Failing Vercel CI jobs appear with log links |
| 538 | OAuth Timeout Error | Improved error suggestion for OAuth timeouts |
| 539 | Workspace Creation Resilience | Workspace creation succeeds even without remote pull |
| 540 | Cost Display | Fixed costs sometimes showing incorrectly |

---

## Version 0.25.6 -- Multiple Git Repos, Fork Workspaces (Dec 10, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 541 | Multi-Repo Editing | Use /add-dir for multi-repository editing |
| 542 | Workspace Forking | Fork workspace to new workspace with summary |
| 543 | Image Resizing | Auto-resize images >8k pixels to prevent errors |
| 544 | Chat Scrollbar | Improved chat scrollbar click target |
| 545 | Tufte Markdown Styling | Tufte markdown style applies to changed files |

---

## Version 0.25.5 -- Approve Plans with Feedback, Perf Improvements, GH_TOKEN Support (Dec 9, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 546 | Plan Feedback | Approve plans with feedback for Claude |
| 547 | File Tree Performance | Improved performance for large file trees |
| 548 | GH_TOKEN Login | Login with GH_TOKEN |
| 549 | Archive from Command Palette | Improved archiving from command palette |
| 550 | Settings Layout | Fixed layout issues on settings page |

---

## Version 0.25.4 -- Sync PR Comments from GitHub (Dec 8, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 551 | PR Comment Syncing | Sync PR comments from GitHub |
| 552 | Tufte Markdown Toggle | Toggle Tufte markdown rendering |
| 553 | Export to New Chat | "Export to new chat" button for recovery |
| 554 | Quit Confirmation | Prompt to confirm quit if agent running |
| 555 | Notification Sound Test | Button to test notification sounds |
| 556 | Markdown Rendering Option | New markdown rendering option in Settings |
| 557 | City Discovery | More cities to discover |
| 558 | Performance with Many Changes | Improved performance with many file changes |
| 559 | Refresh Button Prominence | Refresh button more prominent for files |
| 560 | Revertible Messages | Fixed messages incorrectly showing as revertible |

---

## Version 0.25.3 -- Pinned Workspaces (Dec 5, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 561 | Workspace Pinning | Pin workspaces to keep them at top |
| 562 | Large Image Upload | Upload images over 5MB |
| 563 | Closed Tab Context | Closed tabs can be added as contexts in new sessions |
| 564 | DMG Image | New DMG image |
| 565 | City List Expansion | Added Gwangju to cities list |
| 566 | Git Branch Prefix | Fixed git branch prefix not applying to new workspaces |
| 567 | Plan Mode Rendering | Plan mode rendering fixes |
| 568 | Icon Alignment | Fixed tiny icon shift in sidebar |
| 569 | Phantom Notifications | Remove phantom notifications from archived workspaces |

---

## Version 0.25.2 -- Bug Fixes (Dec 4, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 570 | MCP JSON Issue | Bug prevents MCPs in .mcp.json from being picked up |
| 571 | Clear Command Restoration | Added back /clear command |
| 572 | Slash Commands Rendering | Improved slash commands rendering in chat |
| 573 | Workspace Creation Speed | Fixed bug in workspace creation for faster times |
| 574 | Slash Command Suggestions | Improved slash command auto-complete suggestions |
| 575 | Diff Comments Disappearing | Fixed diff comments disappearing while drafting |
| 576 | Merge Button Fix | Fixed merge button not working on non-squash repos |
| 577 | Composer Post-Plan Update | Fixed Composer not updating after approving plan |
| 578 | File Change Summaries | Truncated large numbers of file changes |
| 579 | Onboarding Tooltips | Hide educational tooltips from new users |

---

## Version 0.25.1 -- Wrapped (Dec 4, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 580 | Usage Wrapped | Summary of usage throughout the year |
| 581 | Codex Extra High Reasoning | Added Codex Extra High reasoning level |
| 582 | Claude Code Login Error | Improved error message for Claude Code login failures |
| 583 | Slash Commands in Codex | Fixed Claude Code slash commands appearing in Codex |
| 584 | Duplicate Suggestions | Fixed duplicate slash command auto-complete suggestions |
| 585 | Branch Name Animation | Removed noisy typing animation for branch names |
| 586 | MCP Status Link | Fixed broken link in MCP status dropdown |

---

## Version 0.25.0 -- Workspace Storage Improvements, AI Response Metadata, Slash Commands (Dec 3, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 587 | Workspace Storage Location | Workspaces created at ~/conductor/workspaces/ |
| 588 | Gitignore Management | No need to add .conductor to gitignore |
| 589 | AI Response Metadata | Metadata below each AI response |
| 590 | Response Duration Display | Shows how long response took |
| 591 | Response Copy Button | Copy response as markdown |
| 592 | Changed Files List | List of changed files below response |
| 593 | Slash Commands Support | Claude Code default slash commands work |
| 594 | Plugin Commands | Commands installed via Plugins work |
| 595 | MCP Server Statuses | MCP server statuses appear before sending |
| 596 | File Contents Copy | Button to copy file contents in diffs |
| 597 | Fuzzy Search | Improved fuzzy search for slash commands |
| 598 | Dark Mode Switches | Improved switch visibility in dark mode |
| 599 | Claude Code Skills | Improved rendering of Claude Code Skills |
| 600 | Cmd+N Shortcut Tooltip | Only show tooltip on selected repository |
| 601 | Archive Button Loading | Fixed archive button loading state with other archives |
| 602 | PR Creation Instructions | Target branch mentioned in PR creation instructions |
| 603 | Port Recognition | Fixed port recognition with wrapped line URLs |
| 604 | Diff Arrow Direction | Fixed arrows opening wrong direction |
| 605 | Toast Duration | Increased default toast duration to 10 seconds |
| 606 | Workspace Screen | Removed "Open In" button from new workspace screen |
| 607 | Settings as Page | Converted settings from dialog to proper page |
| 608 | Settings Close Shortcut | Changed settings close shortcut to Cmd+Esc |

---

## Version 0.24.0 -- Improved Codex, Quick Start (Dec 2, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 609 | Codex Bash Commands | Bash command render live in Codex |
| 610 | Codex Web Search | Web search enabled in Codex |
| 611 | Codex MCP Display | MCPs appear in Codex UI |
| 612 | Quick Start Feature | Create new repos in the app |
| 613 | Quick Start GitHub Push | Push new repos to GitHub |
| 614 | Fullscreen Settings | Made settings page fullscreen |
| 615 | Tab Clarity | Clearer, easier navigation tabs |
| 616 | Fuzzy Search Flexibility | More flexible fuzzy search |
| 617 | Default File Tree | New workspaces show file tree by default |
| 618 | File Tree Auto-switch | Automatically switch to changed files once modified |
| 619 | Branch Notifications | Workspace branch name in macOS notifications |
| 620 | Text Attachment Previews | Added previews for text attachments |
| 621 | Session Cost Display | Toggle to show session cost in top bar |
| 622 | Scroll to Bottom Button | Added back scroll to bottom button |
| 623 | Archive Undo Toast | Undo toast when archiving workspaces |
| 624 | Auto-detect Default Branch | Detect default branch automatically for Quick Start |
| 625 | Xcode Opening | Open in XCode now uses xed |
| 626 | Sourcetree Addition | Add Sourcetree to apps list |
| 627 | Codex Chat Improvements | Various Codex chat UI improvements |
| 628 | Bash Command Prefix | Remove unnecessary prefixes in bash commands |
| 629 | Failing Commands Display | Failing bash commands no longer show empty |
| 630 | MCP Tool Calls | Show MCP tool calls in chat |
| 631 | Large Image Warning | Warning for uploading images larger than 5MB |
| 632 | Archive Workspace Bug | Fixed incorrect workspace occasionally archived |
| 633 | Tab Icon | Fixed agent icon in chat tab history popover |
| 634 | Slash Command Errors | Invalid slash commands show error |
| 635 | Create Workspace Button | Fixed "Create workspace from" button on home page |
| 636 | Claude Code Downloads | Fixed Claude Code downloads for some users |
| 637 | PR Search | Fix PR search to use GitHub search API |

---

## Version 0.23.3 -- Repo Details (Nov 26, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 638 | Repo Details View | Revamped repo details view |
| 639 | Workspace Restoration | Browse and restore archived workspaces from details |
| 640 | Archived Workspace Removal | Removed old archived workspaces view |
| 641 | Close Tab Confirmation | Ask before closing running chat tab |
| 642 | Notification Sounds | Fixed notification sounds not playing when unfocused |
| 643 | Long Messages Wrapping | Fixed long user messages not wrapping in chat |
| 644 | Settings Overflow | Fixed overflows in settings dialog |
| 645 | Git Panel Actions | Fixed git panel actions sent to wrong workspace |
| 646 | Archive Redirection | Fixed redirection after archiving |

---

## Version 0.23.2 -- Checkpointing Fixes (Nov 25, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 647 | Chat Reversion Error | Fixed reverting chat causing error code 1 |
| 648 | Workspace Creation Regression | Fixed new workspaces starting from old commit |
| 649 | Linear Tab Crash | Fixed app crash navigating to Linear tab |
| 650 | Renamed File Diffs | Fixed diffs for renamed files |

---

## Version 0.23.1 -- Opus 4.5 Bug Fixes (Nov 24, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 651 | Opus Default Model | Opus now default model |
| 652 | Plan Rendering | Fixed bug where generated plans not populating in UI |
| 653 | SDK Workaround | Implemented workaround for Claude Agent SDK bug |

---

## Version 0.23.0 -- Opus 4.5 and Better Scrolling (Nov 24, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 654 | Opus 4.5 Availability | Opus 4.5 now available |
| 655 | Smooth Scrolling | Made scrolling much smoother and more reliable |
| 656 | Subagent Prompts | Subagent calls show the prompt given |
| 657 | Shortcuts Help Menu | More shortcuts in help menu |
| 658 | Codex Attachment Reading | Fixed Codex struggling to read attachments |
| 659 | Terminal Shortcuts | Remove broken terminal shortcuts |
| 660 | Thinking Button | Fixed thinking button hiding MCP button |
| 661 | Commit Visibility | Fix workspace switching not resetting commits shown |
| 662 | Removed Lines Highlighting | Removed lines no longer show inline highlights |
| 663 | Diff Viewer Cleanup | Visual cleanups throughout app |

---

## Version 0.22.8 -- Onboarding Improvements (Nov 22, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 664 | Onboarding Improvements | Improved onboarding for new users |
| 665 | Setup Failure Reduction | Help reduce setup failures |
| 666 | Enhanced Logging | Improved logging for debugging |

---

## Version 0.22.7 -- Send Plans to New Chats (Nov 21, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 667 | Plan Copying | Copy plan from Claude Code |
| 668 | Plan Export | Send plan to new chat for implementation |
| 669 | Claude Code Installations | Fixed Claude Code installations for new users |

---

## Version 0.22.6 -- Conversation Summaries, Codex Diffs, Custom Review Models (Nov 20, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 670 | Previous Chat Summaries | Attach summary of previous chats in new tabs |
| 671 | Codex Changes Display | Shows Codex's changes after each turn |
| 672 | Default Review Model | Select default model for reviews |
| 673 | Review Thinking Level | Select thinking level for reviews |
| 674 | Retry Button | Fix the retry button |
| 675 | Branch Rename Edit Escape | Prevent escape key cancelling agent during rename |

---

## Version 0.22.5 -- GPT-5.1 Codex Max, Improved Diff Viewer (Nov 19, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 676 | GPT-5.1 Codex Max | Latest OpenAI agentic coding model available |
| 677 | Diff Viewer Redesign | Gave diff viewer a face lift |
| 678 | Cancellation Clarity | Make cancellation more obvious in Composer |
| 679 | Service Status Display | Show when third-party services having outages |
| 680 | Composer Clickability | Fixed parts of Composer being unclickable |

---

## Version 0.22.4 -- Expand Terminal, Env Vars, GitHub Enterprise (Nov 18, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 681 | Terminal Full Height | Expand terminal to full height |
| 682 | Env Variables Setting | Set env variables in Claude Code's environment |
| 683 | Third-Party Providers | Useful for configuring third-party providers |
| 684 | Gemini CLI Support | Test Gemini 3 via gemini CLI |
| 685 | Git Panel Incremental Expansion | Incremental expansion in diff viewer |
| 686 | GitHub Enterprise Support | Added GitHub enterprise login |
| 687 | PR Template Locations | Added more PR template location support |
| 688 | Sidebar Background Color | Sidebar background color fix |

---

## Version 0.22.2 -- Codex Cancellation (Nov 17, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 689 | Codex Cancellation | Cancel Codex with ESC while working |
| 690 | Bundle Size Reduction | Reduced bundle size to ~124MB |
| 691 | Claude Code Bundling | Claude Code bundled with the app |
| 692 | Loading Indicator | Fixed loading indicator disappearing while AI responding |

---

## Version 0.22.1 -- GPT-5.1 (Nov 14, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 693 | GPT-5.1 Availability | OpenAI's latest model now available |
| 694 | Subagent Nesting | Sub-agent tool calls neatly nested in chat |
| 695 | Middle Mouse Click | Close tabs with middle mouse click |

---

## Version 0.22.0 -- Code Review and Historical Diffs (Nov 12, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 696 | Code Review Feature | Click "Review" button to get AI review of changes |
| 697 | Historical Diffs | View turn-by-turn diffs for each message |
| 698 | Zen Mode Shortcut | Cmd+. shortcut to activate Zen mode |
| 699 | Compaction Notification | Show when chat compaction starts |
| 700 | Git Timestamp Parsing | Fixed git timestamp parsing error |

---

## Version 0.21.0 -- Plan Mode (Nov 10, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 701 | Plan Mode Feature | AI creates and shows plans before implementing |
| 702 | GPT-5-Codex Mini | GPT-5-Codex Mini model available |
| 703 | Opus 4.1 Restoration | Brought back Opus 4.1 |
| 704 | Chat Title Animation | Animation for chat titles |
| 705 | Archive on Merge Setting | Add archive on merge setting |
| 706 | Copy Path Button | Copy path button with Cmd+Shift+C shortcut |
| 707 | Linear Attachment Routing | Fixed Linear attachments sent to wrong chat |
| 708 | File Path Slug Rendering | Fixed file paths with slugs not rendering |
| 709 | File Picker Recent Files | Recent files scoped to repository |

---

## Version 0.20.0 -- File Picker and Chat Titles (Nov 7, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 710 | New File Opener | New file opener using Cmd+P to search files |
| 711 | Auto-Generated Chat Titles | Automatically generate chat titles for tabs |
| 712 | GitHub API Usage | Removed unnecessary GitHub API requests |
| 713 | Autoscrolling | Improved autoscrolling in chats |
| 714 | Gemini Chat Titles | Use Gemini to generate titles based on first message |
| 715 | Data Privacy Option | Pick "Strict data privacy" to disable AI titles |
| 716 | Sidebar Toggle Buttons | Add toggle buttons for left sidebar |
| 717 | Codex Thinking Levels | Add thinking levels to Codex |
| 718 | Directory Squashing | Chains of empty directories squashed in file tree |
| 719 | PR Review Status | Show when PRs awaiting manual review |
| 720 | TODO Tool Rendering | Improved TODO tool rendering |
| 721 | Command Palette Redesign | Revamped command palette UI |
| 722 | Claude Code Installation | Fixed unclear Claude Code installation UX |
| 723 | Merge Status | Fixed incorrect "Unable to merge" statuses |
| 724 | Terminal Text Wrapping | Fixed terminal text wrapping being lossy |
| 725 | Turn Rendering | Improved turn rendering logic |

---

## Version 0.19.0 -- Checkpoints (Nov 5, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 726 | Checkpoint Feature | Revert chat to previous turn, wiping history and changes |
| 727 | Recent Turn Changes | View changes in Claude's most recent turn |
| 728 | Left Sidebar Toggle | Cmd+B to toggle left sidebar |
| 729 | Right Sidebar Toggle | Option+Cmd+B to toggle right sidebar |
| 730 | Zen Mode Toggle | CTRL+Z to hide both sidebars |
| 731 | File Badge Navigation | Clicking file badges shows file in the app |
| 732 | Model Selection Focus | Selecting model closes picker and focuses composer |
| 733 | Model Not Found Error | Fix "model not found" error in older chats |
| 734 | Resource Cleanup | Improve resource teardown on app close |
| 735 | File Tab Hover | Fix hover mask for tabs with long names |
| 736 | GPT-5-Codex Default | Fix "not_found_error" setting gpt-5-codex as default |

---

## Version 0.18.4 -- Better Create PR Prompt (Nov 4, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 737 | Faster PR Creation | Claude faster and aware of git status |
| 738 | Branch Copy | Copy workspace's branch in one click |
| 739 | Tab Title Sync | Fixed tab titles out of sync with Codex models |
| 740 | File Highlighting in Git | Only highlight file when viewing diffs |
| 741 | Diff Markdown Wrapping | Fixed markdown text wrapping in diffs |

---

## Version 0.18.3 -- Bug Fixes (Nov 3, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 742 | Default Thinking Level | Default thinking level preference in Settings |
| 743 | Merged PR Info | Show PR number and URL for merged PRs |
| 744 | Linear Issues Sorting | Sort grouped Linear issues by created time |
| 745 | Thinking in Compact | Don't attach thinking mode in /compact messages |
| 746 | File Badge Opening | Fixed open-in behavior for file badges |
| 747 | Tool Header Hit Area | Fixed oversized tool header hit areas |

---

## Version 0.18.0 -- Codex (Oct 31, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 748 | Codex Integration | Now use Codex in the app |
| 749 | Workspace Empty State | Simpler workspace empty state |
| 750 | Create from Existing | New "create workspace from" button |
| 751 | Terminal Focus Shortcut | ctrl+` shortcut to focus terminal |
| 752 | Tab History UI | Improved tab history UI |
| 753 | Run Button Alignment | Fixed run button alignment |
| 754 | Workspace Reordering | Fixed workspaces reordering when closing tabs |
| 755 | Horizontal Overflow | Fixed horizontal chat overflow |
| 756 | Pull Latest Button | Hide button when workspace behind remote |
| 757 | File Mention Trigger | Fixed file mentions after parentheses/brackets |

---

## Version 0.17.5 -- Tab Beautification (Oct 28, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 758 | Tab UI Improvement | Improved UI for chat tabs |
| 759 | Chat History Saving | Save chat history for restoring previous tabs |
| 760 | Branch Name Editing | Edit branch names in top bar |
| 761 | Window State Persistence | Window size and location persists across restart |
| 762 | Chat Width | Wider chats on large screens |
| 763 | Tool Call Visibility | File names always visible when expanding tool calls |
| 764 | Dialog Escape Key | Prevent escape key closing alert dialogs |
| 765 | Enter Key Dialogs | Prevent enter key closing alert dialogs |
| 766 | UI Lag from Mutations | Fixed mutations causing UI lag |
| 767 | Top Bar Drag Regions | Fixed drag regions in top bar |

---

## Version 0.17.4 -- Git Status in Sidebar (Oct 28, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 768 | Git Status Display | View git status in sidebar at a glance |
| 769 | Exit Plan Mode Bug | Fixed exit_plan_mode tool causing chat stuck |
| 770 | Composer Focus | Fixed composer not always getting auto-focused |
| 771 | Branch Renaming | Fixed branches renamed in new chat tabs |
| 772 | Renamed Files | Fixed text overflow for renamed files |

---

## Version 0.17.3 -- Performance Improvements (Oct 28, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 773 | Notification Performance | Fixed performance regression from session notifications |
| 774 | Custom Branch Prefix | Setting for custom branch prefix |
| 775 | PR Creation Model | Use Haiku 4.5 for creating PRs through Claude |
| 776 | Nested Buttons | Fixed nested buttons |
| 777 | Plan Mode Tool | Fixed chats stuck with exit_plan_mode tool |

---

## Version 0.17.2 -- Misc Fixes (Oct 27, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 778 | Haiku 4.5 Addition | Added Haiku 4.5 |
| 779 | Native API Compacting | Compacting goes through Anthropic's native APIs |
| 780 | Message Processing Speed | Speed up message processing |
| 781 | Git Query Reduction | Reduce git queries from workspace sidebar |
| 782 | Diff Viewer Line Alignment | Fixed diff viewer line number alignment |
| 783 | Session State Reset | Reset sessions in cancelling state on startup |

---

## Version 0.17.1 -- Bug Fixes (Oct 27, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 784 | Composer Performance | Improved composer performance with lag fix |
| 785 | Commit Time Display | Relative commit time in changes dropdown filter |
| 786 | Tab Consolidation | Consolidated diff and file tab into one |
| 787 | Send Button Color | Fixed composer send button hover color |
| 788 | Unread Count | Fixed unread count in non-focused workspaces |

---

## Version 0.17.0 -- Multiple Chats (Oct 24, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 789 | Multiple Chat Tabs | Launch multiple Claude Code chats with Cmd+T |
| 790 | Diff Line Highlighting | Line hover highlighting in diff viewer |
| 791 | Commit Time Display | Display relative commit time in filter |
| 792 | Files Not Refreshing | Fixed files not refreshing on non-diff tab |
| 793 | Branch Update | Branch names update when workspace not selected |
| 794 | Compact Button Removal | Removed compact button (use /compact command) |

---

## Version 0.16.1 -- Diff Viewer Bug Fixes (Oct 23, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 795 | Model Switching Speed | Switching models in middle of session much faster |
| 796 | Accent Color Scale | Refreshed accent color scale |
| 797 | Android Studio | Add Android Studio to "Open In" menu |
| 798 | Diff File Refresh | Fixed files not refreshing in diffs |
| 799 | Deleted Files Rendering | Fixed deleted files not rendering in diffs |
| 800 | Repository Deletion | Navigate away if repository deleted |
| 801 | Single File Diffs | Fix bottom padding on single file diffs |
| 802 | Chat Tab Focus | Focus chat tab when sending message |
| 803 | Composer Arrow Keys | Disable arrow key shortcuts when focused on composer |

---

## Version 0.16.0 -- Diff Viewer + File Explorer (Oct 21, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 804 | Integrated Diff Viewer | Diff viewer integrated into main chat panel |
| 805 | File Explorer | View all files in workspace |
| 806 | Auto-Commit | Claude always commits, no more auto-committed message |
| 807 | Binary File Detection | Better binary file detection |
| 808 | Linear Issue ID Wrapping | Prevent Linear issue IDs from wrapping |

---

## Version 0.15.2 -- Create Workspace from PR (Oct 20, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 809 | Workspace from PR | Create workspace directly from PR using Cmd+Shift+N |
| 810 | Workspace from Branch | Create workspace from existing branch |
| 811 | Workspace from Linear | Create workspace from Linear issue |
| 812 | Onboarding Sequence | More noticeable onboarding for new users |
| 813 | Popup Escape | Close new workspace popup with Escape |
| 814 | File Picker Loading | Fixed file picker not loading large trees |
| 815 | Linear Auth Redirect | Fixed Linear auth not redirecting on success |
| 816 | Attachments Panel | Fixed attachments panel positioning |

---

## Version 0.15.1 -- Claude's Thinking (Oct 18, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 817 | Claude Thinking Display | See Claude's thinking by pressing Cmd+Shift+. |
| 818 | Quick Workspace Opening | Open workspaces via keyboard with Cmd + number |
| 819 | File Picker Fuzzy Search | Fuzzy search for files in file picker |
| 820 | Command Palette Archive | Fixed command palette matching for archived workspaces |

---

## Version 0.15.0 -- Linear (Oct 17, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 821 | Linear Integration | Connect Linear to the app |
| 822 | File Picker | File picker to attach images and files |
| 823 | Arrow Key Navigation | Arrow key navigation in command palette and file picker |
| 824 | Drag and Drop Files | Drag and drop files from Finder or other apps |
| 825 | File Mentioning | @-mention files in messages |
| 826 | New Workspace Redirect | Fixed create new workspace redirection |

---

## Version 0.14.7 -- Git Diff Improvements (Oct 11, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 827 | Open In Button | Added "Open In" button to files in git diff |
| 828 | Markdown Rendering | Newly added markdown files rendered as markdown |
| 829 | Markdown Text Wrapping | Fixed markdown text wrapping in git diff |
| 830 | Git Actions Loading | Fixed git actions sharing loading state |
| 831 | Diff Viewer Escape | Fixed escape key closing after leaving comment |
| 832 | Comment Button | Fixed comment button inaccurate click target |

---

## Version 0.14.6 -- Markdown Preview (Oct 10, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 833 | Markdown Preview | Added markdown preview to diff viewer |
| 834 | Gh Auth Caching | gh auth status caches for 24 hours |
| 835 | Merge Conflicts Prompt | Updated resolve conflicts prompt |
| 836 | Revert Rename | Rename revert to discard |
| 837 | Repo Details Overflow | Fixed horizontal overflow in repo details dialog |
| 838 | Sidebar UI Tweaks | Sidebar UI tweaks |

---

## Version 0.14.5 -- Zoom Improvements (Oct 9, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 839 | Zoom Controls | Fixed zoom controls (Cmd+-, Cmd++) breaking dragging |
| 840 | File Navigation | Made arrow key navigation between files more obvious |
| 841 | Diff Empty State | Updated diff viewer empty state |
| 842 | Link Issue Dialog | Focus composer when closing link issue dialog |
| 843 | Tooltip Positioning | Prevent tooltips from going outside app |
| 844 | System Reminders | Hide system reminders from Read tool |

---

## Version 0.14.3 -- Performance Improvements (Oct 8, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 845 | Zombie Process Fix | Fixed zombie claude processes left on system |
| 846 | Right Sidebar Empty State | Updated right sidebar empty state |
| 847 | Consumer Terms Error | Better error handling for Anthropic Consumer Terms |
| 848 | Plan Mode Removal | Temporarily removed plan mode due to SDK bugs |
| 849 | MCP Documentation | Fixed MCP documentation link |

---

## Version 0.14.1 -- New Diff Viewer (Oct 7, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 850 | Diff UI Revamp | Revamped diff UI |
| 851 | Large Workspace Performance | Fixed performance with many workspaces |
| 852 | Sound Effects | New sound effects on workspace completion |
| 853 | Git Diff Comment Escape | Escape shortcut to cancel git diff comments |
| 854 | Repository Details Dialog | Converted to simpler dialog |
| 855 | Git Diff Error Treatment | Added UI treatment for /login errors |
| 856 | Font Ligatures | Disabled font ligatures in git diffs |
| 857 | Binary File Detection | Fixed binary file detection for untracked files |
| 858 | Line Detection | Fixed line detection for untracked files |
| 859 | Comment Alignment | Fixed comments and line numbers misalignment |
| 860 | Drag Regions | Added drag regions to git diff sheet |
| 861 | AWS Profile Setting | Option to set AWS_PROFILE |
| 862 | Performance Improvements | Performance improvements in 0.14.2 |

---

## Version 0.14.0 -- Command Palette (Oct 14, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 863 | Command Palette | Press Cmd+K to open command palette |
| 864 | Workspace Archiving | Archive workspaces from context menu or command palette |
| 865 | Failed Bash Rendering | Better rendering of failed Bash commands |
| 866 | GH PR View Auth | Fixed gh pr view prompting for authentication |

---

## Version 0.13.8 -- Fixes for Fish Users (Oct 1, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 867 | Fish Shell Support | Use zsh for internal commands to support fish |
| 868 | GH Auth Timeout | Increased gh CLI auth timeout |
| 869 | GH Authentication Fix | Potential fix for gh authentication not being recognized |

---

## Version 0.13.6 -- Run on Bedrock, Vertex, or Custom Provider (Sept 30, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 870 | Bedrock Support | Run Claude Code via AWS Bedrock |
| 871 | Vertex Support | Run Claude Code via Google Vertex |
| 872 | Custom Provider | Run via custom Anthropic-compatible URL |
| 873 | Auto-Updater | More reliable auto-updater |
| 874 | Open In Buttons | Fixed width of "Open In" buttons |
| 875 | Onboarding Privacy | Added privacy link to onboarding |
| 876 | Cursor/VSCode Documentation | Added tips on using with Cursor/VSCode |

---

## Version 0.13.2 -- Sonnet 4.5 + New Workspace Page (Sept 29, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 877 | Sonnet 4.5 Launch | Best coding model available now |
| 878 | New Workspace Page | Faster, easier workspace creation |
| 879 | Workspace Naming | Name workspace/branch with inline editor |
| 880 | Setup Visibility | See at a glance what happened during setup |
| 881 | Linear Issue Linking | More intuitive Linear issue linking with Cmd+I |
| 882 | Cancellation Reliability | Cancellations much more reliable |
| 883 | Conductor.json Detection | Detect conductor.json in repo root |
| 884 | Run Tab Focus | Cmd+R to focus run tab |

---

## Version 0.12.1 -- Improved Plan Mode (Sept 27, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 885 | Plan Mode Logic | Claude no longer thinks it's in plan mode when not |
| 886 | Plan Controls | Controls respond to Claude's plans |
| 887 | File Reading Memory | Claude won't forget files read across turns |
| 888 | Response Speed | Faster response times across chats |
| 889 | macOS Badge | Only update notification badge when Claude completes |
| 890 | Merge Conflicts Prompt | Updated resolve merge conflicts prompt |
| 891 | PR Creation Shortcut | Cmd+Shift+P shortcut to create PR |
| 892 | Pending Checks Count | Show number of pending checks in git status |
| 893 | Script Failure Notifications | Better notifications when scripts fail |
| 894 | Initialization Script | Fixed bug sourcing initialization script |
| 895 | Branch Upstream | Prevented upstream tracking of new branches |
| 896 | Compact Button | Fixed compact button height |

---

## Version 0.12.0 -- Forward Failing Checks to Claude (Sept 25, 2025)

| # | Feature | Description |
|---|---------|-------------|
| 897 | Failing CI Forwarding | Forward failing CI checks to Claude to fix |

---

## Summary Statistics

- **Total entries captured:** 897
- **Date range:** September 25, 2025 through March 16, 2026
- **Versions covered:** 0.12.0 through 0.40.1
- **Major feature categories:**
  - **AI Models:** Opus 4.5, Opus 4.6, Sonnet 4.5, Sonnet 4.6, Haiku 4.5, GPT-5.1, GPT-5.2, GPT-5.3-Codex, GPT-5.4, Codex Mini/Max, Gemini CLI
  - **Core Features:** Plan Mode, Checkpoints, Code Review, Multiple Chat Tabs, Tasks, Chat Summaries, Command Palette, File Editor, Diff Viewer, File Explorer, Terminal
  - **Integrations:** Linear, GitHub Actions, GitHub Enterprise, Vercel, Graphite, Bedrock, Vertex, Custom Providers
  - **IDE Support:** VS Code, Cursor, Xcode, Android Studio, JetBrains (via Toolbox), Zed, IntelliJ, Fork, Sourcetree, Antigravity
  - **Workspace Management:** Archiving, Forking, Pinning, Status Organization, Search, Storage Configuration, Context Directory
  - **Developer Experience:** Slash Commands, Keyboard Shortcuts, Zen Mode, Drag and Drop, Fuzzy Search, MCP Support, Setup Scripts
