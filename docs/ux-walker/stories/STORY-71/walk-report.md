# STORY-071: Manage Tool Permissions in Agent Profile

## Walk Date
2026-03-23

## Story
Check tool permissions UI in agent profile editor.

## Steps Taken
1. Navigated to Agent Profiles via sidebar
2. Opened "Code Review Bot Changed Again" profile
3. Clicked "Tools" tab in the profile editor

## Findings
- Agent Profile editor has a dedicated **Tools** tab
- Tools tab shows **Permission Mode** dropdown at top (set to "Default" with description "Ask for permission on risky operations")
- Below that, a comprehensive **Tools** list showing every available tool with Default/Allow/Block toggle buttons
- Tools listed: Read, Write, Edit, MultiEdit, Bash, Glob, Grep, LS, Task, WebFetch, WebSearch, TodoRead, TodoWrite, NotebookRead, NotebookEdit, ExitPlanMode, AskUserQuestion (and more below scroll)
- Each tool has a description (e.g., "Read file contents", "Run shell commands")
- "Show raw" link available to see raw JSON configuration
- Allowed Tools vs Blocked Tools concept explained: "If empty, all tools are available"

## Verdict
**pass** -- Tool permissions UI is fully functional in Agent Profiles with clear Default/Allow/Block toggles per tool.
