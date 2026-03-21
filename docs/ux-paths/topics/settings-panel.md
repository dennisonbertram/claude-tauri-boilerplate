# UX Stories: Settings Panel

Topic: Settings Panel  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: Toggle Theme Preference

**Type**: short  
**Topic**: Settings Panel > Appearance  
**Persona**: Developer with external monitors  
**Goal**: Switch from dark to light theme for bright office lighting  
**Preconditions**: Settings panel is open on Appearance tab

### Steps
1. Locate "Theme" dropdown (currently set to "Dark")
2. Click dropdown and select "Light"
3. See app UI immediately transition to light colors
4. Close settings and verify all panels use light background

### Variations
- **System mode**: User selects "System" and app respects OS dark/light preference
- **Accent color change**: User changes accent color in same tab before theme switch

### Edge Cases
- **Rapid theme switches**: Switching multiple times quickly; ensure no race conditions in CSS application
- **Partial render**: Some components slow to update when theme changes; should complete within 200ms

---

## STORY-002: Customize Chat Appearance with Font & Density

**Type**: medium  
**Topic**: Settings Panel > Appearance  
**Persona**: Accessibility-focused user with vision impairment  
**Goal**: Increase font size and select monospace font for better readability  
**Preconditions**: Settings panel open on Appearance tab

### Steps
1. Adjust "Font Size" slider from 14px to 18px → see preview update in real-time
2. Change "Chat Font" from Proportional to Monospace
3. Select "Menlo" from "Monospace Family" dropdown
4. Adjust "Chat Density" from Comfortable to Compact to fit more on screen
5. Close settings and verify chat messages render with new font at 18px in monospace

### Variations
- **Wide chat mode**: User also selects "Chat Width" = "Wide" to maximize message space
- **Tab density**: User also adjusts settings tabs density to compact

### Edge Cases
- **Font fallback**: If Menlo unavailable on system, should gracefully fall back to System Mono
- **Extreme slider values**: Font size 24px with Compact density might cause layout shifts

---

## STORY-003: Configure Workspace Branch Prefix

**Type**: short  
**Topic**: Settings Panel > Git Integration  
**Persona**: Team lead managing multiple projects  
**Goal**: Set custom branch prefix for workspace creation  
**Preconditions**: Settings panel open, Git tab visible

### Steps
1. Navigate to Git tab
2. See "Workspace Branch Prefix" input with current value "workspace"
3. Clear field and type "feat"
4. Close settings
5. Create new workspace from Linear issue → branch name is "feat/PROJ-123-description"

### Variations
- **Multi-word prefix**: User enters "my-feature" as prefix
- **Special characters**: User tries "test-@" → should sanitize or reject

### Edge Cases
- **Empty prefix**: User clears field and closes; should either revert to default or allow empty
- **Git invalid chars**: User enters "/" or "@" → should validate and warn

---

## STORY-004: Enable and Test Notification Sounds

**Type**: medium  
**Topic**: Settings Panel > Notifications  
**Persona**: Background task monitor  
**Goal**: Configure notification alerts for task completion  
**Preconditions**: Notification permissions already granted in browser

### Steps
1. Navigate to Notifications tab
2. Toggle "Desktop Notifications" to ON
3. Under "Notification Sound", select "Chime" from dropdown
4. Click "Test" button → hear notification sound play
5. Change sound to "Beep" and test again
6. Close settings → when task completes, receive desktop notification with beep

### Variations
- **Sound disabled**: User selects "None" and test button becomes disabled (grayed out)
- **Permission denied**: User has denied browser permission; see red status and "Request permission" button

### Edge Cases
- **Browser muted**: System is muted; sound plays but inaudible
- **Multiple notifications**: Rapid task completions trigger multiple sounds overlapping

---

## STORY-005: Manage Memory Files with Search and Edit

**Type**: long  
**Topic**: Settings Panel > Memory Panel  
**Persona**: Research analyst building persistent project knowledge base  
**Goal**: Create memory files, search across them, and update project context  
**Preconditions**: Settings open on Memory tab, memory directory initialized

### Steps
1. See list of existing memory files with file size and entrypoint badges
2. Click "+ Add Memory File" button
3. Enter filename "project-architecture.md" in text input
4. Type markdown content about system design in textarea
5. Click "Create" button → file saved, list updates
6. Use "Memory" search input, type "microservices" → search results show matching lines
7. Click on search result for "project-architecture.md" line 5
8. See file selected and content previewed below
9. Click "Edit" button → content becomes editable textarea
10. Modify architecture notes, click "Save"
11. Confirm changes persisted and list updates timestamp

### Variations
- **Auto-memory integration**: Memory update from chat automatically prepends content to existing file
- **Delete file**: User clicks delete button on non-entrypoint file, confirms deletion

### Edge Cases
- **Entrypoint file**: Cannot delete entrypoint memory file; delete button hidden
- **Large file**: Previewing 500KB file might be slow; show truncation indicator
- **Search performance**: Searching 50 files simultaneously; debounce and show loading state

---

## STORY-006: Add MCP Server with Preset

**Type**: medium  
**Topic**: Settings Panel > MCP Servers  
**Persona**: Tool integrator setting up browser automation  
**Goal**: Install Playwright MCP server from preset with one click  
**Preconditions**: Settings open on MCP tab

### Steps
1. See "MCP Presets" section with "Playwright Browser" card
2. Read description: "Launch headed Chrome for testing, screenshots, console inspection..."
3. Click "Install" button on Playwright preset
4. See "Installing..." state, then success confirmation
5. Observe "Playwright" appears in MCP Servers list below as enabled
6. See server config shows type "stdio" and full command
7. Verify Playwright tools available in chat after setting saves

### Variations
- **Custom server**: User clicks "+ Add Server" and manually enters command, args, env vars
- **Edit existing**: User clicks edit icon on Playwright, modifies args, saves

### Edge Cases
- **Installation fails**: Backend error; show red error message with retry option
- **Server startup fails**: Server command not found; status shows "error" with explanation
- **Multiple servers**: User installs Playwright + Agentation; both listed and status monitored

---

## STORY-007: Create and Edit Custom Instructions File

**Type**: medium  
**Topic**: Settings Panel > Instructions Panel  
**Persona**: Project maintainer documenting coding standards  
**Goal**: Create project-level CLAUDE.md with custom system instructions  
**Preconditions**: Settings open on Instructions tab, no project-level file yet

### Steps
1. See list of instruction files showing "Global" and "User" level (from ~/.claude and ~/.zshrc)
2. See "Project" level marked with "(not found)"
3. Click "+ Create CLAUDE.md" button
4. TextArea appears with placeholder "# Project Instructions..."
5. Type custom instructions: "Use React hooks only. No class components. Enforce TypeScript strict mode."
6. Click "Create" button → file saved to .claude/CLAUDE.md
7. List updates showing "Project" level now "exists" with green edit button
8. Click "Edit" on Project file
9. Modify instructions, add new section "## API Standards"
10. Click "Save" → updates saved, editor closes
11. See preview panel shows updated content

### Variations
- **Edit existing file**: User directly clicks "Edit" on Project level file that already exists
- **View other levels**: User clicks Global or User files to preview their content

### Edge Cases
- **Large file**: Instructions with 10,000+ chars; ensure editor doesn't freeze
- **Conflict resolution**: Multiple editor windows open on same file; last save wins (or warn)

---

## STORY-008: Configure Advanced Model Parameters

**Type**: medium  
**Topic**: Settings Panel > Advanced & Model Tabs  
**Persona**: Power user fine-tuning AI behavior  
**Goal**: Adjust temperature, thinking budget, and permission mode for careful edits  
**Preconditions**: Settings open, Model and Advanced tabs accessible

### Steps
1. Navigate to Model tab
2. See "Temperature" field at default 1.0
3. Adjust slider to 0.5 for more deterministic outputs
4. Set "Thinking Budget Tokens" to 8000 (reduced from 16000) for faster responses
5. Leave "Max Tokens" at 4096
6. Navigate to Advanced tab
7. Set "Permission Mode" to "Plan" (requires explicit approval for actions)
8. Toggle "Auto-Compact" ON to reduce context when needed
9. Set "Max Turns" to 10 (reduced from 25) to limit agentic loops
10. Toggle "Enterprise Privacy Mode" ON to disable AI-generated titles
11. Close settings → new sessions use these parameters

### Variations
- **Fast mode**: User toggles "Fast Mode" for lower latency at cost of reasoning
- **Code review model**: User changes PR review and code review model selections

### Edge Cases
- **Thinking budget exceeds max tokens**: 32,000 thinking + 4,096 max tokens may exceed rate limits; show warning
- **Temperature 0 with fast mode**: Contradictory settings; allow but note implications

---

## STORY-009: Configure Hooks for Automated Workflows

**Type**: long  
**Topic**: Settings Panel > Hooks Panel  
**Persona**: DevOps engineer automating CI/CD triggers  
**Goal**: Create a hook to run bash command when chat session starts  
**Preconditions**: Settings open on Hooks tab, events list loaded

### Steps
1. See list of hook events: "SessionStart", "SessionEnd", "PreToolUse", "PostToolUse", etc.
2. Click "+ Add Hook" button
3. In form: select event "SessionStart"
4. Enter matcher pattern (e.g., "**/*.ts") to scope hook
5. Select handler type "command"
6. Enter command "echo 'Session started with TypeScript files'" 
7. Set timeout to "30" seconds
8. Click "Create" → hook saved and added to list
9. See hook config shows event, command, handler type as badges
10. Click hook row to see execution logs (empty initially)
11. Edit hook: click edit icon, change command to "npm run typecheck"
12. Click "Save" → hook updated
13. Start new session → hook executes and logs success in execution history

### Variations
- **HTTP handler**: User selects "http" type and provides POST URL and headers
- **Prompt handler**: User selects "prompt" type to trigger Claude with a prompt on event
- **Delete hook**: User clicks delete icon, confirms removal

### Edge Cases
- **Hook timeout**: Command takes > 30 seconds; shows timeout error in logs
- **Invalid matcher**: Malformed glob pattern; validate and show error before save
- **Circular hooks**: SessionStart hook triggers another SessionStart; guard against loops

---

## STORY-010: Set Git Provider Credentials (Bedrock/Vertex)

**Type**: medium  
**Topic**: Settings Panel > General (Provider Config)  
**Persona**: AWS-based enterprise user  
**Goal**: Configure AWS Bedrock as AI provider instead of Anthropic  
**Preconditions**: Settings panel open on General tab, user has AWS credentials

### Steps
1. Scroll to "Provider" dropdown (currently "Anthropic")
2. Click and select "Bedrock"
3. New fields appear: "Bedrock Base URL" and "Bedrock Project ID"
4. Enter AWS region URL: "https://bedrock.us-west-2.amazonaws.com"
5. Enter Bedrock Project ID: "my-bedrock-project"
6. API Key field remains for authentication
7. Model dropdown now shows Bedrock-compatible models
8. Select "anthropic.claude-sonnet-4-20250514-v1:0"
9. Close settings → chat uses Bedrock as backend

### Variations
- **Vertex AI**: User selects "Vertex" provider and enters Google Cloud project/base URL
- **Custom provider**: User selects "Custom" and provides custom base URL

### Edge Cases
- **Invalid credentials**: Bedrock URL or project unreachable; show connection error when saving
- **Model mismatch**: Selected model incompatible with provider; warn or auto-switch

---

## STORY-011: Request Browser Notification Permission

**Type**: short  
**Topic**: Settings Panel > Notifications  
**Persona**: Distracted user needing task completion alerts  
**Goal**: Grant desktop notification permission to receive system alerts  
**Preconditions**: Settings open on Notifications tab, permission not yet granted

### Steps
1. See "Browser Permission" status: "Not requested"
2. Click "Request permission" button
3. Browser shows native permission dialog
4. User clicks "Allow" in dialog
5. Status updates to "Granted" (green)
6. "Request permission" button disappears
7. "Desktop Notifications" toggle becomes enabled
8. Toggle ON to activate notifications

### Variations
- **Permission denied**: User clicks "Don't Allow" in dialog → status shows "Denied" (red) and button disappears
- **Already granted**: User visits tab with permission already granted → status shows "Granted", no button shown

### Edge Cases
- **Browser doesn't support**: Notification API unavailable; status shows "Denied" and message explains unsupported

---

## STORY-012: Workflow Template Customization

**Type**: medium  
**Topic**: Settings Panel > Workflows Tab  
**Persona**: Template designer optimizing workflow patterns  
**Goal**: Customize default workflow prompts for code review and PR workflows  
**Preconditions**: Settings open on Workflows tab

### Steps
1. See four workflow templates with textareas:
   - "Code Review Workflow"
   - "PR Review Workflow"
   - "Branch Naming Workflow"
   - "Browser Automation Workflow"
2. Click into "Code Review Workflow" textarea
3. Edit the default prompt: replace "Be thorough" with "Focus on security issues"
4. Click "Save to repository" button (gray during idle)
5. See "Saving repository prompts..." status
6. After 2 seconds: "Repository prompts saved." (green) confirmation
7. Click "Use defaults" button to revert all to defaults
8. Confirm reset, prompts revert to original values

### Variations
- **Empty prompt**: User clears workflow text → uses global defaults when workflow triggered
- **Repository overrides**: User has .claude/workflows.json in repo; those override saved settings

### Edge Cases
- **Save error**: Network or permission error saving to repository; show "Failed to save" with retry
- **Concurrent saves**: User clicks save multiple times; debounce and show single save state

---

## STORY-013: View System Status and Runtime Info

**Type**: short  
**Topic**: Settings Panel > Status Tab  
**Persona**: Troubleshooting user checking app health  
**Goal**: Verify app configuration and session runtime details  
**Preconditions**: Settings open on Status tab, active chat session exists

### Steps
1. See read-only sections:
   - **Account**: Email address and plan type (if authenticated)
   - **Session Runtime**: Current model, active tools, MCP servers with status, Claude Code version
   - **App Config**: Provider (Anthropic/Bedrock/etc), theme, font settings
2. Observe MCP servers list shows real-time status: "connected", "error", "starting"
3. If error present on server, see tooltip explaining issue
4. Can reference this info for support tickets or debugging

### Variations
- **No active session**: Status tab shows placeholder "No active session"
- **Multiple MCP servers**: List shows Playwright (connected), Agentation (error) with details

### Edge Cases
- **Server flaky**: Status rapidly toggles between connected/error; show last known state + refresh button
- **Sensitive info**: Email visible in Account section; consider masking if shared screen

---

## STORY-014: Search and Navigate Settings Tabs Efficiently

**Type**: short  
**Topic**: Settings Panel > Navigation  
**Persona**: User with many settings tabs  
**Goal**: Quickly jump to desired settings without scrolling  
**Preconditions**: Settings panel open with many tabs visible

### Steps
1. See grouped tabs in left sidebar: General, AI & Model, Data & Context, Integrations, Status
2. Click on "Data & Context" group header
3. See four tabs under it: Instructions, Memory, MCP, Hooks
4. Click "Memory" tab directly
5. Jump to Memory Panel content on right side
6. Content scrolls/renders instantly

### Variations
- **Overflow tabs**: If tabs exceed viewport, sidebar scrolls to reveal more
- **Deep link**: User visits `/settings?tab=mcp` → Settings opens directly to MCP tab

### Edge Cases
- **Tab not found**: User tries invalid tab name; fallback to General
- **Permission denied**: User lacks access to certain tabs; should hide or disable them

---

## STORY-015: Handle Settings Persistence and Defaults Reset

**Type**: medium  
**Topic**: Settings Panel > Data Persistence  
**Persona**: User troubleshooting app behavior  
**Goal**: Save all settings changes locally and optionally reset to defaults  
**Preconditions**: User has modified multiple settings across tabs

### Steps
1. Change theme to Light, font size to 18, accent to Blue
2. Navigate away from Settings panel
3. Return to Settings → all changes preserved (read from localStorage)
4. In any tab, settings are always in-memory and auto-saved on change
5. Restart app completely → settings still persist
6. (Optional) Factory reset: in General tab, click "Reset to Defaults" button
7. Confirm dialog: "Are you sure? This cannot be undone."
8. All settings revert to defaults (apiKey, theme, fonts, etc.)
9. App re-renders with default theme (Dark) and layout

### Variations
- **Selective reset**: User resets only Appearance settings, keeps API key
- **Backup/export**: User exports settings JSON before reset for safe restore

### Edge Cases
- **Corrupt localStorage**: Retrieved settings missing required keys; merge with defaults gracefully
- **Migration**: App updates add new settings keys; should populate with defaults for missing keys

---
